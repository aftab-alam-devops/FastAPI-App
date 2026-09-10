import React, { useState, useEffect, useMemo } from 'react';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  TrendingUp,
  AlertCircle,
  X,
  RefreshCw
} from 'lucide-react';

export default function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    price: '',
    status: 'active',
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Toast state
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Fetch products from API
  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/products');
      if (!res.ok) throw new Error('Failed to load products');
      const data = await res.json();
      setProducts(data);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Filtered products calculation
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' ||
        product.status.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [products, searchQuery, statusFilter]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = products.length;
    const active = products.filter((p) => p.status.toLowerCase() === 'active').length;
    const inactive = products.filter((p) => p.status.toLowerCase() === 'inactive').length;
    const totalValue = products.reduce((acc, p) => acc + (Number(p.price) || 0), 0);

    return { total, active, inactive, totalValue };
  }, [products]);

  // Form Validation
  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) {
      errors.name = 'Product name is required';
    } else if (formData.name.trim().length < 2) {
      errors.name = 'Product name must be at least 2 characters';
    }

    if (!formData.sku.trim()) {
      errors.sku = 'SKU is required';
    } else if (formData.sku.trim().length < 2) {
      errors.sku = 'SKU must be at least 2 characters';
    }

    if (formData.price === '' || isNaN(formData.price)) {
      errors.price = 'Price is required';
    } else if (Number(formData.price) < 0) {
      errors.price = 'Price cannot be negative';
    }

    if (!['active', 'inactive'].includes(formData.status)) {
      errors.status = 'Status must be active or inactive';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Open modal for Create or Edit
  const handleOpenModal = (product = null) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        sku: product.sku,
        price: product.price,
        status: product.status,
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        sku: '',
        price: '',
        status: 'active',
      });
    }
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Save product (POST or PUT)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    const payload = {
      name: formData.name.trim(),
      sku: formData.sku.trim(),
      price: parseFloat(formData.price),
      status: formData.status.toLowerCase(),
    };

    try {
      const url = editingProduct
        ? `/api/products/${editingProduct.id}`
        : '/api/products';
      const method = editingProduct ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || 'An error occurred while saving');
      }

      showToast(
        editingProduct
          ? 'Product updated successfully'
          : 'Product created successfully',
        'success'
      );
      setIsModalOpen(false);
      fetchProducts();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirm delete
  const handleDeleteConfirm = async () => {
    if (!deletingProduct) return;
    try {
      const res = await fetch(`/api/products/${deletingProduct.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete product');

      showToast('Product deleted successfully', 'success');
      setIsDeleteModalOpen(false);
      setDeletingProduct(null);
      fetchProducts();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="dashboard-container">
      {/* Toast Notification */}
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            {toast.type === 'success' ? (
              <CheckCircle2 size={18} color="#10b981" />
            ) : (
              <AlertCircle size={18} color="#f43f5e" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="header">
        <div className="brand-wrapper">
          <div className="brand-icon">
            <Package size={26} />
          </div>
          <div>
            <h1 className="brand-title">Product Dashboard</h1>
            <p className="brand-subtitle">FastAPI & React Inventory Management</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="status-indicator">
            <span className="status-dot"></span>
            <span>API Online</span>
          </div>
          <button className="btn-primary" onClick={() => handleOpenModal()}>
            <Plus size={18} />
            <span>Add Product</span>
          </button>
        </div>
      </header>

      {/* KPI Stats Grid */}
      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-info">
            <div className="stat-label">Total Products</div>
            <div className="stat-value">{stats.total}</div>
          </div>
          <div className="stat-icon-bg">
            <Package size={22} color="#6366f1" />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-info">
            <div className="stat-label">Active Items</div>
            <div className="stat-value" style={{ color: '#34d399' }}>
              {stats.active}
            </div>
          </div>
          <div className="stat-icon-bg">
            <CheckCircle2 size={22} color="#10b981" />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-info">
            <div className="stat-label">Inactive Items</div>
            <div className="stat-value" style={{ color: '#fb7185' }}>
              {stats.inactive}
            </div>
          </div>
          <div className="stat-icon-bg">
            <XCircle size={22} color="#f43f5e" />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-info">
            <div className="stat-label">Total Inventory Value</div>
            <div className="stat-value" style={{ color: '#38bdf8' }}>
              ${stats.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="stat-icon-bg">
            <TrendingUp size={22} color="#06b6d4" />
          </div>
        </div>
      </section>

      {/* Toolbar: Search and Status Filter */}
      <section className="toolbar">
        <div className="search-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by Product Name or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-tabs">
          <button
            className={`filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            All ({stats.total})
          </button>
          <button
            className={`filter-btn ${statusFilter === 'active' ? 'active' : ''}`}
            onClick={() => setStatusFilter('active')}
          >
            Active ({stats.active})
          </button>
          <button
            className={`filter-btn ${statusFilter === 'inactive' ? 'active' : ''}`}
            onClick={() => setStatusFilter('inactive')}
          >
            Inactive ({stats.inactive})
          </button>
        </div>
      </section>

      {/* Main Table */}
      <main className="table-card">
        {loading ? (
          <div className="empty-state">
            <RefreshCw size={32} className="empty-state-icon" style={{ animation: 'spin 1s linear infinite' }} />
            <p>Loading inventory items...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="empty-state">
            <Package size={48} className="empty-state-icon" />
            <h3>No products found</h3>
            <p style={{ marginTop: '6px' }}>
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your search query or filter tab.'
                : 'Click "Add Product" above to create your first inventory item.'}
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id}>
                    <td className="product-name-cell">{product.name}</td>
                    <td>
                      <span className="sku-tag">{product.sku}</span>
                    </td>
                    <td className="price-text">${Number(product.price).toFixed(2)}</td>
                    <td>
                      <span
                        className={`badge ${
                          product.status.toLowerCase() === 'active'
                            ? 'badge-active'
                            : 'badge-inactive'
                        }`}
                      >
                        {product.status.toLowerCase() === 'active' ? (
                          <CheckCircle2 size={12} />
                        ) : (
                          <XCircle size={12} />
                        )}
                        {product.status}
                      </span>
                    </td>
                    <td>
                      <div className="actions-cell" style={{ justifyContent: 'flex-end' }}>
                        <button
                          className="icon-btn edit"
                          title="Edit Product"
                          onClick={() => handleOpenModal(product)}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          className="icon-btn delete"
                          title="Delete Product"
                          onClick={() => {
                            setDeletingProduct(product);
                            setIsDeleteModalOpen(true);
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button
                className="icon-btn"
                onClick={() => setIsModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Product Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Wireless Ergonomic Mouse"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                  {formErrors.name && (
                    <div className="form-error">{formErrors.name}</div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">SKU (Stock Keeping Unit) *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. MS-ERGO-01"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  />
                  {formErrors.sku && (
                    <div className="form-error">{formErrors.sku}</div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Price ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input"
                    placeholder="0.00"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  />
                  {formErrors.price && (
                    <div className="form-error">{formErrors.price}</div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Status *</label>
                  <select
                    className="form-select"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  {formErrors.status && (
                    <div className="form-error">{formErrors.status}</div>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? 'Saving...'
                    : editingProduct
                    ? 'Update Product'
                    : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && deletingProduct && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: '#f43f5e' }}>
                Delete Product
              </h3>
              <button
                className="icon-btn"
                onClick={() => setIsDeleteModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6' }}>
                Are you sure you want to delete <strong style={{ color: 'white' }}>{deletingProduct.name}</strong> (SKU: {deletingProduct.sku})? This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setIsDeleteModalOpen(false)}
              >
                Cancel
              </button>
              <button className="btn-danger" onClick={handleDeleteConfirm}>
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
