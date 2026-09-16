import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import {
  productsApi,
  type Product,
  type Category,
  type Brand,
  type Unit,
} from "../api/products.api";

type TabType = "products" | "categories" | "brands" | "units";

export const ProductsView: React.FC = () => {
  const { activeMembership, hasPermission } = useAuth();

  const [currentTab, setCurrentTab] = useState<TabType>("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [lowStockFilter, setLowStockFilter] = useState(false);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Create Product Form State
  const [newProductName, setNewProductName] = useState("");
  const [newProductSku, setNewProductSku] = useState("");
  const [newProductBarcode, setNewProductBarcode] = useState("");
  const [newProductDescription, setNewProductDescription] = useState("");
  const [newProductCategoryId, setNewProductCategoryId] = useState("");
  const [newProductBrandId, setNewProductBrandId] = useState("");
  const [newProductUnitId, setNewProductUnitId] = useState("");
  const [newProductCostPrice, setNewProductCostPrice] = useState("0");
  const [newProductSellingPrice, setNewProductSellingPrice] = useState("0");
  const [newProductReorderLevel, setNewProductReorderLevel] = useState("10");
  const [newProductInitialStock, setNewProductInitialStock] = useState("0");

  // Edit Product Form State
  const [editName, setEditName] = useState("");
  const [editSku, setEditSku] = useState("");
  const [editBarcode, setEditBarcode] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editBrandId, setEditBrandId] = useState("");
  const [editUnitId, setEditUnitId] = useState("");
  const [editCostPrice, setEditCostPrice] = useState("0");
  const [editSellingPrice, setEditSellingPrice] = useState("0");
  const [editReorderLevel, setEditReorderLevel] = useState("0");
  const [editStatus, setEditStatus] = useState<"ACTIVE" | "INACTIVE" | "ARCHIVED">("ACTIVE");

  // Classification Creation Forms
  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");
  const [newBrandName, setNewBrandName] = useState("");
  const [newBrandDesc, setNewBrandDesc] = useState("");
  const [newUnitName, setNewUnitName] = useState("");
  const [newUnitCode, setNewUnitCode] = useState("");
  const [newUnitDesc, setNewUnitDesc] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchClassifications = useCallback(async () => {
    try {
      const [catsRes, brandsRes, unitsRes] = await Promise.all([
        productsApi.getCategories(),
        productsApi.getBrands(),
        productsApi.getUnits(),
      ]);
      setCategories(catsRes.data || []);
      setBrands(brandsRes.data || []);
      setUnits(unitsRes.data || []);
    } catch (err: unknown) {
      console.error("Failed to load classifications:", err);
    }
  }, []);

  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await productsApi.getProducts({
        search: search || undefined,
        categoryId: categoryFilter || undefined,
        brandId: brandFilter || undefined,
        status: statusFilter || undefined,
        lowStock: lowStockFilter || undefined,
      });
      setProducts(res.data || []);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Failed to load products");
    } finally {
      setIsLoading(false);
    }
  }, [search, categoryFilter, brandFilter, statusFilter, lowStockFilter]);

  useEffect(() => {
    if (activeMembership) {
      fetchClassifications();
      loadProducts();
    }
  }, [activeMembership, fetchClassifications, loadProducts]);

  const showToast = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await productsApi.createProduct({
        name: newProductName,
        sku: newProductSku,
        barcode: newProductBarcode || undefined,
        description: newProductDescription || undefined,
        categoryId: newProductCategoryId || null,
        brandId: newProductBrandId || null,
        unitId: newProductUnitId || null,
        costPrice: parseFloat(newProductCostPrice) || 0,
        sellingPrice: parseFloat(newProductSellingPrice) || 0,
        reorderLevel: parseInt(newProductReorderLevel, 10) || 0,
        initialStock: parseInt(newProductInitialStock, 10) || 0,
      });

      showToast(`Product '${newProductName}' created successfully`);
      setShowCreateModal(false);
      resetCreateForm();
      loadProducts();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Failed to create product");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetCreateForm = () => {
    setNewProductName("");
    setNewProductSku("");
    setNewProductBarcode("");
    setNewProductDescription("");
    setNewProductCategoryId("");
    setNewProductBrandId("");
    setNewProductUnitId("");
    setNewProductCostPrice("0");
    setNewProductSellingPrice("0");
    setNewProductReorderLevel("10");
    setNewProductInitialStock("0");
  };

  const openEditModal = (p: Product) => {
    setSelectedProduct(p);
    setEditName(p.name);
    setEditSku(p.sku);
    setEditBarcode(p.barcode || "");
    setEditDescription(p.description || "");
    setEditCategoryId(p.categoryId || "");
    setEditBrandId(p.brandId || "");
    setEditUnitId(p.unitId || "");
    setEditCostPrice(String(p.costPrice));
    setEditSellingPrice(String(p.sellingPrice));
    setEditReorderLevel(String(p.reorderLevel));
    setEditStatus(p.status);
    setShowEditModal(true);
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setIsSubmitting(true);
    setError(null);

    try {
      await productsApi.updateProduct(selectedProduct.id, {
        name: editName,
        sku: editSku,
        barcode: editBarcode || null,
        description: editDescription || null,
        categoryId: editCategoryId || null,
        brandId: editBrandId || null,
        unitId: editUnitId || null,
        costPrice: parseFloat(editCostPrice) || 0,
        sellingPrice: parseFloat(editSellingPrice) || 0,
        reorderLevel: parseInt(editReorderLevel, 10) || 0,
        status: editStatus,
      });

      showToast(`Product '${editName}' updated successfully`);
      setShowEditModal(false);
      loadProducts();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Failed to update product");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProduct = async (p: Product) => {
    if (!window.confirm(`Are you sure you want to deactivate or remove '${p.name}'?`)) return;

    try {
      const res = await productsApi.deleteProduct(p.id);
      showToast(res.message || "Product deactivated successfully");
      loadProducts();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Failed to delete product");
    }
  };

  // Category Actions
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await productsApi.createCategory({ name: newCatName, description: newCatDesc });
      showToast(`Category '${newCatName}' created`);
      setNewCatName("");
      setNewCatDesc("");
      fetchClassifications();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Failed to create category");
    }
  };

  const handleDeleteCategory = async (cat: Category) => {
    if (!window.confirm(`Delete category '${cat.name}'?`)) return;
    try {
      await productsApi.deleteCategory(cat.id);
      showToast(`Category '${cat.name}' deleted`);
      fetchClassifications();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Failed to delete category");
    }
  };

  // Brand Actions
  const handleCreateBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await productsApi.createBrand({ name: newBrandName, description: newBrandDesc });
      showToast(`Brand '${newBrandName}' created`);
      setNewBrandName("");
      setNewBrandDesc("");
      fetchClassifications();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Failed to create brand");
    }
  };

  const handleDeleteBrand = async (brand: Brand) => {
    if (!window.confirm(`Delete brand '${brand.name}'?`)) return;
    try {
      await productsApi.deleteBrand(brand.id);
      showToast(`Brand '${brand.name}' deleted`);
      fetchClassifications();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Failed to delete brand");
    }
  };

  // Unit Actions
  const handleCreateUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await productsApi.createUnit({ name: newUnitName, code: newUnitCode, description: newUnitDesc });
      showToast(`Unit '${newUnitName}' (${newUnitCode}) created`);
      setNewUnitName("");
      setNewUnitCode("");
      setNewUnitDesc("");
      fetchClassifications();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Failed to create unit");
    }
  };

  const handleDeleteUnit = async (u: Unit) => {
    if (!window.confirm(`Delete unit '${u.name}'?`)) return;
    try {
      await productsApi.deleteUnit(u.id);
      showToast(`Unit '${u.name}' deleted`);
      fetchClassifications();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Failed to delete unit");
    }
  };

  // Profit Margin Calculator Helper
  const cost = parseFloat(newProductCostPrice) || 0;
  const selling = parseFloat(newProductSellingPrice) || 0;
  const profitMargin = selling > 0 ? (((selling - cost) / selling) * 100).toFixed(1) : "0.0";

  return (
    <div className="catalogue-container">
      {/* Header & Subnav */}
      <div className="view-header">
        <div>
          <h2>📦 Product Catalogue & Master Data</h2>
          <p className="view-subtitle">
            Manage your organization&apos;s product listings, SKU catalog, classifications, and pricing.
          </p>
        </div>
        <div className="view-actions">
          {hasPermission("PRODUCT_CREATE") && (
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              ➕ Add Product
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {error && <div className="alert alert-error">{error}</div>}
      {successMessage && <div className="alert alert-success">{successMessage}</div>}

      {/* Navigation Sub-Tabs */}
      <div className="subnav-tabs">
        <button
          className={`tab-btn ${currentTab === "products" ? "active" : ""}`}
          onClick={() => setCurrentTab("products")}
        >
          📦 Products ({products.length})
        </button>
        <button
          className={`tab-btn ${currentTab === "categories" ? "active" : ""}`}
          onClick={() => setCurrentTab("categories")}
        >
          🏷️ Categories ({categories.length})
        </button>
        <button
          className={`tab-btn ${currentTab === "brands" ? "active" : ""}`}
          onClick={() => setCurrentTab("brands")}
        >
          ⭐ Brands ({brands.length})
        </button>
        <button
          className={`tab-btn ${currentTab === "units" ? "active" : ""}`}
          onClick={() => setCurrentTab("units")}
        >
          📏 Units of Measure ({units.length})
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: PRODUCTS LIST */}
      {/* ------------------------------------------------------------- */}
      {currentTab === "products" && (
        <div className="tab-pane">
          {/* Quick Stats Banner */}
          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-label">Total Catalogue</span>
              <span className="stat-value">{products.length}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Active Products</span>
              <span className="stat-value stat-success">
                {products.filter((p) => p.status === "ACTIVE").length}
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Low Stock Alerts</span>
              <span className="stat-value stat-warning">
                {
                  products.filter(
                    (p) =>
                      (p.inventory?.currentQuantity ?? 0) <= p.reorderLevel &&
                      (p.inventory?.currentQuantity ?? 0) > 0
                  ).length
                }
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Out of Stock</span>
              <span className="stat-value stat-danger">
                {products.filter((p) => (p.inventory?.currentQuantity ?? 0) <= 0).length}
              </span>
            </div>
          </div>

          {/* Filter Toolbar */}
          <div className="filter-toolbar">
            <div className="search-box">
              <input
                type="text"
                placeholder="Search by name, SKU, or barcode..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-search"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="filter-select"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              className="filter-select"
            >
              <option value="">All Brands</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter-select"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="ARCHIVED">Archived</option>
            </select>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={lowStockFilter}
                onChange={(e) => setLowStockFilter(e.target.checked)}
              />
              <span>⚠️ Low Stock Only</span>
            </label>
          </div>

          {/* Products Table */}
          {isLoading ? (
            <div className="loading-state">
              <div className="spinner" />
              <p>Loading catalogue...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="empty-state">
              <p className="empty-title">No products found</p>
              <p className="empty-desc">
                {search || categoryFilter || brandFilter || lowStockFilter
                  ? "Try clearing filters to view all products."
                  : "Start by clicking '+ Add Product' to build your inventory."}
              </p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>SKU & Barcode</th>
                    <th>Product Name</th>
                    <th>Category / Brand</th>
                    <th>Unit</th>
                    <th>Cost Price</th>
                    <th>Selling Price</th>
                    <th>Current Stock</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const currentStock = p.inventory?.currentQuantity ?? 0;
                    const isLow = currentStock <= p.reorderLevel && currentStock > 0;
                    const isOut = currentStock <= 0;

                    return (
                      <tr key={p.id}>
                        <td>
                          <div className="sku-cell">
                            <span className="sku-tag">{p.sku}</span>
                            {p.barcode && <span className="barcode-tag">{p.barcode}</span>}
                          </div>
                        </td>
                        <td>
                          <strong>{p.name}</strong>
                          {p.description && <p className="table-subtext">{p.description}</p>}
                        </td>
                        <td>
                          <div className="tag-group">
                            {p.category && <span className="pill pill-category">{p.category.name}</span>}
                            {p.brand && <span className="pill pill-brand">{p.brand.name}</span>}
                            {!p.category && !p.brand && <span className="text-muted">—</span>}
                          </div>
                        </td>
                        <td>{p.unit ? `${p.unit.name} (${p.unit.code})` : "—"}</td>
                        <td>${Number(p.costPrice).toFixed(2)}</td>
                        <td>
                          <strong>${Number(p.sellingPrice).toFixed(2)}</strong>
                        </td>
                        <td>
                          <div className="stock-level-cell">
                            <span
                              className={`stock-badge ${
                                isOut ? "stock-out" : isLow ? "stock-low" : "stock-ok"
                              }`}
                            >
                              {currentStock} {p.unit?.code || "units"}
                            </span>
                            {isLow && <span className="sub-badge warning">Min: {p.reorderLevel}</span>}
                            {isOut && <span className="sub-badge danger">Out of Stock</span>}
                          </div>
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              p.status === "ACTIVE"
                                ? "badge-success"
                                : p.status === "INACTIVE"
                                ? "badge-secondary"
                                : "badge-warning"
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td>
                          <div className="action-buttons">
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => {
                                setSelectedProduct(p);
                                setShowDetailsModal(true);
                              }}
                              title="View details"
                            >
                              🔍
                            </button>
                            {hasPermission("PRODUCT_UPDATE") && (
                              <button
                                className="btn btn-sm btn-secondary"
                                onClick={() => openEditModal(p)}
                                title="Edit product"
                              >
                                ✏️
                              </button>
                            )}
                            {hasPermission("PRODUCT_DELETE") && (
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => handleDeleteProduct(p)}
                                title="Deactivate/Delete"
                              >
                                🗑️
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: CATEGORIES */}
      {/* ------------------------------------------------------------- */}
      {currentTab === "categories" && (
        <div className="tab-pane">
          <div className="split-layout">
            <div className="card">
              <h3>Create New Category</h3>
              <form onSubmit={handleCreateCategory} className="form-stack">
                <div className="form-group">
                  <label>Category Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Oral Antibiotics"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    rows={3}
                    placeholder="Category details..."
                    value={newCatDesc}
                    onChange={(e) => setNewCatDesc(e.target.value)}
                  />
                </div>
                {hasPermission("PRODUCT_CREATE") && (
                  <button type="submit" className="btn btn-primary">
                    Create Category
                  </button>
                )}
              </form>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Category Name</th>
                    <th>Description</th>
                    <th>Products Assigned</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.name}</strong>
                      </td>
                      <td>{c.description || "—"}</td>
                      <td>
                        <span className="badge badge-business">{c._count?.products ?? 0}</span>
                      </td>
                      <td>
                        <span className="badge badge-success">{c.status}</span>
                      </td>
                      <td>
                        {hasPermission("PRODUCT_DELETE") && (
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDeleteCategory(c)}
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {categories.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center">
                        No categories defined yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: BRANDS */}
      {/* ------------------------------------------------------------- */}
      {currentTab === "brands" && (
        <div className="tab-pane">
          <div className="split-layout">
            <div className="card">
              <h3>Create New Brand</h3>
              <form onSubmit={handleCreateBrand} className="form-stack">
                <div className="form-group">
                  <label>Brand Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Pfizer, Samsung, Ashley"
                    value={newBrandName}
                    onChange={(e) => setNewBrandName(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    rows={3}
                    placeholder="Manufacturer/Brand details..."
                    value={newBrandDesc}
                    onChange={(e) => setNewBrandDesc(e.target.value)}
                  />
                </div>
                {hasPermission("PRODUCT_CREATE") && (
                  <button type="submit" className="btn btn-primary">
                    Create Brand
                  </button>
                )}
              </form>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Brand Name</th>
                    <th>Description</th>
                    <th>Products Assigned</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {brands.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <strong>{b.name}</strong>
                      </td>
                      <td>{b.description || "—"}</td>
                      <td>
                        <span className="badge badge-business">{b._count?.products ?? 0}</span>
                      </td>
                      <td>
                        <span className="badge badge-success">{b.status}</span>
                      </td>
                      <td>
                        {hasPermission("PRODUCT_DELETE") && (
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDeleteBrand(b)}
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {brands.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center">
                        No brands defined yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 4: UNITS OF MEASURE */}
      {/* ------------------------------------------------------------- */}
      {currentTab === "units" && (
        <div className="tab-pane">
          <div className="split-layout">
            <div className="card">
              <h3>Create Custom Unit</h3>
              <form onSubmit={handleCreateUnit} className="form-stack">
                <div className="form-group">
                  <label>Unit Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Carton, Pack of 10"
                    value={newUnitName}
                    onChange={(e) => setNewUnitName(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Unit Code / Symbol *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ctn, pk10"
                    value={newUnitCode}
                    onChange={(e) => setNewUnitCode(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    rows={2}
                    placeholder="Unit measure description..."
                    value={newUnitDesc}
                    onChange={(e) => setNewUnitDesc(e.target.value)}
                  />
                </div>
                {hasPermission("PRODUCT_CREATE") && (
                  <button type="submit" className="btn btn-primary">
                    Create Unit
                  </button>
                )}
              </form>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Unit Name</th>
                    <th>Code / Symbol</th>
                    <th>Description</th>
                    <th>Products Assigned</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {units.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <strong>{u.name}</strong>
                      </td>
                      <td>
                        <span className="sku-tag">{u.code}</span>
                      </td>
                      <td>{u.description || "—"}</td>
                      <td>
                        <span className="badge badge-business">{u._count?.products ?? 0}</span>
                      </td>
                      <td>
                        <span className="badge badge-success">{u.status}</span>
                      </td>
                      <td>
                        {hasPermission("PRODUCT_DELETE") && (
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDeleteUnit(u)}
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: CREATE PRODUCT */}
      {/* ------------------------------------------------------------- */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog modal-lg">
            <div className="modal-header">
              <h3>📦 Add New Product to Catalogue</h3>
              <button className="btn-close" onClick={() => setShowCreateModal(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateProduct}>
              <div className="modal-body">
                <div className="form-section">
                  <h4 className="section-title">1. Basic Identification</h4>
                  <div className="form-row">
                    <div className="form-group flex-2">
                      <label>Product Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Paracetamol 500mg Tablets"
                        value={newProductName}
                        onChange={(e) => setNewProductName(e.target.value)}
                      />
                    </div>
                    <div className="form-group flex-1">
                      <label>SKU (Stock Keeping Unit) *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. MED-PAR-500"
                        value={newProductSku}
                        onChange={(e) => setNewProductSku(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group flex-1">
                      <label>Barcode (EAN/UPC)</label>
                      <input
                        type="text"
                        placeholder="e.g. 890123456789"
                        value={newProductBarcode}
                        onChange={(e) => setNewProductBarcode(e.target.value)}
                      />
                    </div>
                    <div className="form-group flex-2">
                      <label>Description</label>
                      <input
                        type="text"
                        placeholder="Brief specification..."
                        value={newProductDescription}
                        onChange={(e) => setNewProductDescription(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h4 className="section-title">2. Classification & Measure</h4>
                  <div className="form-row">
                    <div className="form-group flex-1">
                      <label>Category</label>
                      <select
                        value={newProductCategoryId}
                        onChange={(e) => setNewProductCategoryId(e.target.value)}
                      >
                        <option value="">None (Uncategorized)</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group flex-1">
                      <label>Brand / Manufacturer</label>
                      <select
                        value={newProductBrandId}
                        onChange={(e) => setNewProductBrandId(e.target.value)}
                      >
                        <option value="">None (Generic)</option>
                        {brands.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group flex-1">
                      <label>Unit of Measure</label>
                      <select
                        value={newProductUnitId}
                        onChange={(e) => setNewProductUnitId(e.target.value)}
                      >
                        <option value="">Default (Pieces)</option>
                        {units.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.code})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h4 className="section-title">3. Pricing & Financials</h4>
                  <div className="form-row">
                    <div className="form-group flex-1">
                      <label>Cost Price ($) *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={newProductCostPrice}
                        onChange={(e) => setNewProductCostPrice(e.target.value)}
                      />
                    </div>
                    <div className="form-group flex-1">
                      <label>Selling Price ($) *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={newProductSellingPrice}
                        onChange={(e) => setNewProductSellingPrice(e.target.value)}
                      />
                    </div>
                    <div className="form-group flex-1">
                      <label>Est. Gross Margin</label>
                      <div className="margin-indicator">
                        <span className="margin-value">{profitMargin}%</span>
                        <span className="table-subtext">Profit: ${(selling - cost).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h4 className="section-title">4. Initial Inventory</h4>
                  <div className="form-row">
                    <div className="form-group flex-1">
                      <label>Initial Opening Stock</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={newProductInitialStock}
                        onChange={(e) => setNewProductInitialStock(e.target.value)}
                      />
                      <span className="table-subtext">Recorded as OPENING_STOCK movement</span>
                    </div>
                    <div className="form-group flex-1">
                      <label>Reorder Alert Level</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={newProductReorderLevel}
                        onChange={(e) => setNewProductReorderLevel(e.target.value)}
                      />
                      <span className="table-subtext">Triggers Low Stock warning when stock &le; level</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? "Creating..." : "Save Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: EDIT PRODUCT */}
      {/* ------------------------------------------------------------- */}
      {showEditModal && selectedProduct && (
        <div className="modal-backdrop">
          <div className="modal-dialog modal-lg">
            <div className="modal-header">
              <h3>✏️ Edit Product: {selectedProduct.name}</h3>
              <button className="btn-close" onClick={() => setShowEditModal(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleUpdateProduct}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group flex-2">
                    <label>Product Name</label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </div>
                  <div className="form-group flex-1">
                    <label>SKU</label>
                    <input
                      type="text"
                      required
                      value={editSku}
                      onChange={(e) => setEditSku(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group flex-1">
                    <label>Barcode</label>
                    <input
                      type="text"
                      value={editBarcode}
                      onChange={(e) => setEditBarcode(e.target.value)}
                    />
                  </div>
                  <div className="form-group flex-2">
                    <label>Description</label>
                    <input
                      type="text"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group flex-1">
                    <label>Category</label>
                    <select
                      value={editCategoryId}
                      onChange={(e) => setEditCategoryId(e.target.value)}
                    >
                      <option value="">None</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group flex-1">
                    <label>Brand</label>
                    <select
                      value={editBrandId}
                      onChange={(e) => setEditBrandId(e.target.value)}
                    >
                      <option value="">None</option>
                      {brands.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group flex-1">
                    <label>Unit</label>
                    <select
                      value={editUnitId}
                      onChange={(e) => setEditUnitId(e.target.value)}
                    >
                      <option value="">Default</option>
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group flex-1">
                    <label>Cost Price ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editCostPrice}
                      onChange={(e) => setEditCostPrice(e.target.value)}
                    />
                  </div>
                  <div className="form-group flex-1">
                    <label>Selling Price ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editSellingPrice}
                      onChange={(e) => setEditSellingPrice(e.target.value)}
                    />
                  </div>
                  <div className="form-group flex-1">
                    <label>Reorder Level</label>
                    <input
                      type="number"
                      min="0"
                      value={editReorderLevel}
                      onChange={(e) => setEditReorderLevel(e.target.value)}
                    />
                  </div>
                  <div className="form-group flex-1">
                    <label>Status</label>
                    <select
                      value={editStatus}
                      onChange={(e) =>
                        setEditStatus(e.target.value as "ACTIVE" | "INACTIVE" | "ARCHIVED")
                      }
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                      <option value="ARCHIVED">Archived</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: PRODUCT DETAILS */}
      {/* ------------------------------------------------------------- */}
      {showDetailsModal && selectedProduct && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3>🔍 Product Specifications</h3>
              <button className="btn-close" onClick={() => setShowDetailsModal(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="details-header">
                <h4>{selectedProduct.name}</h4>
                <span className="sku-tag">{selectedProduct.sku}</span>
              </div>

              <div className="details-grid">
                <div className="detail-item">
                  <span className="detail-label">Status</span>
                  <span className="badge badge-success">{selectedProduct.status}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Barcode</span>
                  <span>{selectedProduct.barcode || "N/A"}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Category</span>
                  <span>{selectedProduct.category?.name || "Uncategorized"}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Brand</span>
                  <span>{selectedProduct.brand?.name || "Generic"}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Unit of Measure</span>
                  <span>
                    {selectedProduct.unit
                      ? `${selectedProduct.unit.name} (${selectedProduct.unit.code})`
                      : "Pieces (pc)"}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Current Stock</span>
                  <strong className="text-large">
                    {selectedProduct.inventory?.currentQuantity ?? 0}{" "}
                    {selectedProduct.unit?.code || "units"}
                  </strong>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Cost Price</span>
                  <span>${Number(selectedProduct.costPrice).toFixed(2)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Selling Price</span>
                  <span>${Number(selectedProduct.sellingPrice).toFixed(2)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Reorder Level</span>
                  <span>{selectedProduct.reorderLevel}</span>
                </div>
              </div>

              {selectedProduct.description && (
                <div className="detail-description">
                  <span className="detail-label">Description</span>
                  <p>{selectedProduct.description}</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDetailsModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
