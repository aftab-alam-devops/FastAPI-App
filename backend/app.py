import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlmodel import Field as SQLField, Session, SQLModel, create_engine, select


class Settings(BaseSettings):
    database_url: str = "sqlite:////data/products.db"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()

# Cross-platform SQLite path handling for Windows local dev and Docker container
db_url = settings.database_url
if db_url.startswith("sqlite"):
    clean_path = db_url.replace("sqlite:////", "").replace("sqlite:///", "")
    dir_name = os.path.dirname(clean_path)
    if dir_name:
        os.makedirs(dir_name, exist_ok=True)
    if os.name == "nt" and db_url.startswith("sqlite:////"):
        db_url = f"sqlite:///./{clean_path}"

connect_args = {"check_same_thread": False} if db_url.startswith("sqlite") else {}
engine = create_engine(db_url, connect_args=connect_args)


class Product(SQLModel, table=True):
    id: Optional[int] = SQLField(default=None, primary_key=True)
    name: str = SQLField(index=True)
    sku: str = SQLField(index=True, unique=True)
    price: float
    status: str
    created_at: datetime = SQLField(default_factory=lambda: datetime.now(timezone.utc))


class ProductCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    sku: str = Field(min_length=2, max_length=50)
    price: float = Field(ge=0)
    status: str

    @field_validator("name", "sku", "status")
    @classmethod
    def not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Field cannot be empty or blank")
        return value

    @field_validator("status")
    @classmethod
    def valid_status(cls, value: str) -> str:
        value = value.lower()
        if value not in {"active", "inactive"}:
            raise ValueError("Status must be either 'active' or 'inactive'")
        return value


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    sku: Optional[str] = Field(default=None, min_length=2, max_length=50)
    price: Optional[float] = Field(default=None, ge=0)
    status: Optional[str] = None

    @field_validator("name", "sku", "status")
    @classmethod
    def not_blank(cls, value: Optional[str]) -> Optional[str]:
        if value is not None:
            value = value.strip()
            if not value:
                raise ValueError("Field cannot be empty or blank")
        return value

    @field_validator("status")
    @classmethod
    def valid_status(cls, value: Optional[str]) -> Optional[str]:
        if value is not None:
            value = value.lower()
            if value not in {"active", "inactive"}:
                raise ValueError("Status must be either 'active' or 'inactive'")
        return value


def seed_initial_data(session: Session):
    existing = session.exec(select(Product)).first()
    if not existing:
        sample_products = [
            Product(
                name="Wireless Noise-Canceling Headphones",
                sku="HD-WIFI-01",
                price=199.99,
                status="active",
            ),
            Product(
                name="Mechanical RGB Gaming Keyboard",
                sku="KB-MECH-02",
                price=129.50,
                status="active",
            ),
            Product(
                name="Ergonomic Optical Wireless Mouse",
                sku="MS-ERGO-03",
                price=49.99,
                status="active",
            ),
            Product(
                name="UltraWide 4K Gaming Monitor 32-inch",
                sku="MN-4K-04",
                price=450.00,
                status="inactive",
            ),
            Product(
                name="USB-C Dual 4K Docking Station",
                sku="DK-USBC-05",
                price=89.95,
                status="active",
            ),
        ]
        session.add_all(sample_products)
        session.commit()


@asynccontextmanager
async def lifespan(app_instance: FastAPI):
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        seed_initial_data(session)
    yield


app = FastAPI(
    title="Product Dashboard API",
    description="RESTful API for managing inventory products",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/api/products", response_model=List[Product])
def get_products(
    search: Optional[str] = Query(None, description="Search by name or SKU"),
    status: Optional[str] = Query(None, description="Filter by status (active/inactive)"),
):
    with Session(engine) as session:
        statement = select(Product).order_by(Product.id.desc())
        results = session.exec(statement).all()

        if search:
            query = search.strip().lower()
            results = [
                p for p in results if query in p.name.lower() or query in p.sku.lower()
            ]

        if status and status.lower() != "all":
            target_status = status.strip().lower()
            results = [p for p in results if p.status.lower() == target_status]

        return results


@app.get("/api/products/{product_id}", response_model=Product)
def get_product(product_id: int):
    with Session(engine) as session:
        product = session.get(Product, product_id)
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        return product


@app.post("/api/products", response_model=Product, status_code=210 if False else 201)
def create_product(payload: ProductCreate):
    with Session(engine) as session:
        # Check SKU uniqueness
        existing_sku = session.exec(
            select(Product).where(Product.sku == payload.sku.strip())
        ).first()
        if existing_sku:
            raise HTTPException(
                status_code=409, detail=f"Product with SKU '{payload.sku}' already exists"
            )

        product = Product(
            name=payload.name.strip(),
            sku=payload.sku.strip(),
            price=payload.price,
            status=payload.status.lower(),
        )
        session.add(product)
        session.commit()
        session.refresh(product)
        return product


@app.put("/api/products/{product_id}", response_model=Product)
def update_product(product_id: int, payload: ProductUpdate):
    with Session(engine) as session:
        product = session.get(Product, product_id)
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        # Check SKU collision with another product
        if payload.sku and payload.sku.strip().lower() != product.sku.lower():
            existing_sku = session.exec(
                select(Product).where(
                    Product.sku == payload.sku.strip(), Product.id != product_id
                )
            ).first()
            if existing_sku:
                raise HTTPException(
                    status_code=409, detail=f"Product with SKU '{payload.sku}' already exists"
                )

        update_data = payload.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            if value is not None:
                if isinstance(value, str):
                    value = value.strip()
                if key == "status":
                    value = value.lower()
                setattr(product, key, value)

        session.add(product)
        session.commit()
        session.refresh(product)
        return product


@app.delete("/api/products/{product_id}")
def delete_product(product_id: int):
    with Session(engine) as session:
        product = session.get(Product, product_id)
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        session.delete(product)
        session.commit()
        return {"message": "Product deleted successfully", "id": product_id}
