import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import {
  suppliersApi,
  type Supplier,
  type SuppliersMetrics,
  type CreateSupplierDto,
  type UpdateSupplierDto,
} from "../api/suppliers.api";

export const SuppliersView: React.FC = () => {
  const { activeMembership, hasPermission } = useAuth();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [metrics, setMetrics] = useState<SuppliersMetrics>({
    total: 0,
    active: 0,
    inactive: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  // Create Form State
  const [createForm, setCreateForm] = useState<CreateSupplierDto>({
    name: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
    taxId: "",
    notes: "",
    status: "ACTIVE",
  });

  // Edit Form State
  const [editForm, setEditForm] = useState<UpdateSupplierDto>({
    name: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
    taxId: "",
    notes: "",
    status: "ACTIVE",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const loadSuppliers = useCallback(async () => {
    setError(null);
    try {
      const res = await suppliersApi.getSuppliers({
        search: search || undefined,
        status: statusFilter || undefined,
      });
      setSuppliers(res.data || []);
      if (res.metrics) {
        setMetrics(res.metrics);
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Failed to load suppliers");
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    let active = true;
    if (activeMembership) {
      suppliersApi
        .getSuppliers({
          search: search || undefined,
          status: statusFilter || undefined,
        })
        .then((res) => {
          if (!active) return;
          setSuppliers(res.data || []);
          if (res.metrics) setMetrics(res.metrics);
          setIsLoading(false);
        })
        .catch((err: unknown) => {
          if (!active) return;
          const e = err as { message?: string };
          setError(e.message || "Failed to load suppliers");
          setIsLoading(false);
        });
    }
    return () => {
      active = false;
    };
  }, [activeMembership, search, statusFilter]);

  // Handle Create
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim()) {
      setFormError("Supplier name is required");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      await suppliersApi.createSupplier({
        name: createForm.name.trim(),
        contactPerson: createForm.contactPerson?.trim() || null,
        email: createForm.email?.trim() || null,
        phone: createForm.phone?.trim() || null,
        address: createForm.address?.trim() || null,
        taxId: createForm.taxId?.trim() || null,
        notes: createForm.notes?.trim() || null,
        status: createForm.status || "ACTIVE",
      });

      setShowCreateModal(false);
      setCreateForm({
        name: "",
        contactPerson: "",
        email: "",
        phone: "",
        address: "",
        taxId: "",
        notes: "",
        status: "ACTIVE",
      });
      showToast("Supplier created successfully");
      loadSuppliers();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setFormError(e.message || "Failed to create supplier");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setEditForm({
      name: supplier.name,
      contactPerson: supplier.contactPerson || "",
      email: supplier.email || "",
      phone: supplier.phone || "",
      address: supplier.address || "",
      taxId: supplier.taxId || "",
      notes: supplier.notes || "",
      status: supplier.status,
    });
    setFormError(null);
    setShowEditModal(true);
  };

  // Handle Edit Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier) return;
    if (!editForm.name?.trim()) {
      setFormError("Supplier name cannot be empty");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      await suppliersApi.updateSupplier(selectedSupplier.id, {
        name: editForm.name.trim(),
        contactPerson: editForm.contactPerson?.trim() || null,
        email: editForm.email?.trim() || null,
        phone: editForm.phone?.trim() || null,
        address: editForm.address?.trim() || null,
        taxId: editForm.taxId?.trim() || null,
        notes: editForm.notes?.trim() || null,
        status: editForm.status,
      });

      setShowEditModal(false);
      setSelectedSupplier(null);
      showToast("Supplier updated successfully");
      loadSuppliers();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setFormError(e.message || "Failed to update supplier");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Status (Quick Activate / Deactivate)
  const handleToggleStatus = async (supplier: Supplier) => {
    const nextStatus = supplier.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const confirmMsg =
      supplier.status === "ACTIVE"
        ? `Deactivate supplier '${supplier.name}'? Historical records will remain intact.`
        : `Reactivate supplier '${supplier.name}'?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await suppliersApi.updateSupplier(supplier.id, { status: nextStatus });
      showToast(
        nextStatus === "INACTIVE"
          ? `Supplier '${supplier.name}' deactivated`
          : `Supplier '${supplier.name}' reactivated`
      );
      loadSuppliers();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Failed to change supplier status");
    }
  };

  // Handle Delete
  const handleDelete = async (supplier: Supplier) => {
    if (!window.confirm(`Permanently delete supplier '${supplier.name}'?`)) return;

    try {
      const res = await suppliersApi.deleteSupplier(supplier.id);
      showToast(res.message || `Supplier '${supplier.name}' deleted`);
      loadSuppliers();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Failed to delete supplier");
    }
  };

  // Open Details Modal
  const handleOpenDetails = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setShowDetailsModal(true);
  };

  return (
    <div className="catalogue-container">
      {/* Header */}
      <div className="view-header">
        <div>
          <h2>🚚 Supplier Master Catalogue</h2>
          <p className="view-subtitle">
            Manage your organization&apos;s verified vendors, procurement contacts, and master supplier catalogue.
          </p>
        </div>
        <div className="view-actions">
          {hasPermission("SUPPLIER_CREATE") && (
            <button
              className="btn btn-primary"
              onClick={() => {
                setFormError(null);
                setShowCreateModal(true);
              }}
            >
              ➕ Add Supplier
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {error && <div className="alert alert-error">{error}</div>}
      {successMessage && <div className="alert alert-success">{successMessage}</div>}

      {/* Summary KPI Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Total Suppliers</span>
          <span className="stat-value">{metrics.total}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Active Suppliers</span>
          <span className="stat-value stat-success">{metrics.active}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Inactive Suppliers</span>
          <span className="stat-value stat-warning">{metrics.inactive}</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="filter-toolbar">
        <input
          type="text"
          className="input-search flex-1"
          placeholder="Search by supplier name, contact, email, phone, tax ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active Only</option>
          <option value="INACTIVE">Inactive Only</option>
        </select>
        {(search || statusFilter) && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setSearch("");
              setStatusFilter("");
            }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Suppliers Table */}
      <div className="table-responsive">
        {isLoading ? (
          <div className="app-loading-screen" style={{ minHeight: "200px" }}>
            <div className="spinner" />
            <p>Loading suppliers...</p>
          </div>
        ) : suppliers.length === 0 ? (
          <div className="empty-state-card" style={{ padding: "40px", textAlign: "center" }}>
            <span style={{ fontSize: "40px" }}>🚚</span>
            <h3 style={{ marginTop: "12px", color: "var(--text-main)" }}>No Suppliers Found</h3>
            <p style={{ color: "var(--text-muted)", marginTop: "4px" }}>
              {search || statusFilter
                ? "No suppliers match your active search filters."
                : "Your organization does not have any registered suppliers yet."}
            </p>
            {hasPermission("SUPPLIER_CREATE") && !search && !statusFilter && (
              <button
                className="btn btn-primary"
                style={{ marginTop: "16px" }}
                onClick={() => setShowCreateModal(true)}
              >
                ➕ Add First Supplier
              </button>
            )}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Contact Person</th>
                <th>Contact Details</th>
                <th>Address</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((supplier) => (
                <tr key={supplier.id}>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <strong
                        style={{
                          color: "var(--color-primary, #3b82f6)",
                          cursor: "pointer",
                        }}
                        onClick={() => handleOpenDetails(supplier)}
                        title="Click to view details"
                      >
                        {supplier.name}
                      </strong>
                      {supplier.taxId && (
                        <span className="sku-tag" style={{ width: "fit-content" }}>
                          TAX: {supplier.taxId}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>{supplier.contactPerson || <span className="text-muted">—</span>}</td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "12px" }}>
                      {supplier.email && (
                        <a href={`mailto:${supplier.email}`} style={{ color: "inherit" }}>
                          ✉️ {supplier.email}
                        </a>
                      )}
                      {supplier.phone && (
                        <a href={`tel:${supplier.phone}`} style={{ color: "inherit" }}>
                          📞 {supplier.phone}
                        </a>
                      )}
                      {!supplier.email && !supplier.phone && <span className="text-muted">—</span>}
                    </div>
                  </td>
                  <td style={{ maxWidth: "200px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {supplier.address || <span className="text-muted">—</span>}
                  </td>
                  <td>
                    <span
                      className={`stock-badge ${
                        supplier.status === "ACTIVE" ? "stock-ok" : "stock-low"
                      }`}
                    >
                      {supplier.status}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleOpenDetails(supplier)}
                        title="Inspect supplier"
                      >
                        View
                      </button>
                      {hasPermission("SUPPLIER_UPDATE") && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenEdit(supplier)}
                          title="Edit supplier"
                        >
                          Edit
                        </button>
                      )}
                      {hasPermission("SUPPLIER_UPDATE") && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleToggleStatus(supplier)}
                          title={supplier.status === "ACTIVE" ? "Deactivate" : "Activate"}
                        >
                          {supplier.status === "ACTIVE" ? "Deactivate" : "Activate"}
                        </button>
                      )}
                      {hasPermission("SUPPLIER_UPDATE") && (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(supplier)}
                          title="Delete supplier"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: ADD SUPPLIER */}
      {/* ------------------------------------------------------------- */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>➕ Add New Supplier</h3>
              <button className="modal-close-btn" onClick={() => setShowCreateModal(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateSubmit}>
              <div className="modal-body">
                {formError && <div className="alert alert-error">{formError}</div>}

                <div className="form-section">
                  <div className="section-title">Supplier Information</div>
                  <div className="form-group">
                    <label>
                      Supplier Name <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="input-search"
                      style={{ width: "100%" }}
                      required
                      placeholder="e.g. Apex Medical Wholesale Ltd."
                      value={createForm.name}
                      onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    />
                  </div>
                  <div className="form-row">
                    <div className="form-group flex-1">
                      <label>Contact Person</label>
                      <input
                        type="text"
                        className="input-search"
                        style={{ width: "100%" }}
                        placeholder="e.g. Suresh Kumar"
                        value={createForm.contactPerson || ""}
                        onChange={(e) =>
                          setCreateForm({ ...createForm, contactPerson: e.target.value })
                        }
                      />
                    </div>
                    <div className="form-group flex-1">
                      <label>Tax / Business ID</label>
                      <input
                        type="text"
                        className="input-search"
                        style={{ width: "100%" }}
                        placeholder="e.g. GSTIN, VAT, or EIN"
                        value={createForm.taxId || ""}
                        onChange={(e) => setCreateForm({ ...createForm, taxId: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <div className="section-title">Contact & Location</div>
                  <div className="form-row">
                    <div className="form-group flex-1">
                      <label>Email Address</label>
                      <input
                        type="email"
                        className="input-search"
                        style={{ width: "100%" }}
                        placeholder="e.g. orders@apexwholesale.com"
                        value={createForm.email || ""}
                        onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                      />
                    </div>
                    <div className="form-group flex-1">
                      <label>Phone Number</label>
                      <input
                        type="tel"
                        className="input-search"
                        style={{ width: "100%" }}
                        placeholder="e.g. +91 98765 43210"
                        value={createForm.phone || ""}
                        onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Physical Address</label>
                    <textarea
                      className="input-search"
                      style={{ width: "100%", minHeight: "60px" }}
                      placeholder="e.g. Suite 400, Industrial Park Avenue, Mumbai, MH"
                      value={createForm.address || ""}
                      onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-section">
                  <div className="section-title">Operational Notes</div>
                  <div className="form-group">
                    <label>Notes & Terms</label>
                    <textarea
                      className="input-search"
                      style={{ width: "100%", minHeight: "60px" }}
                      placeholder="e.g. Payment terms net-30; minimum order 50 units."
                      value={createForm.notes || ""}
                      onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                    />
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
                  {isSubmitting ? "Creating..." : "Save Supplier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: EDIT SUPPLIER */}
      {/* ------------------------------------------------------------- */}
      {showEditModal && selectedSupplier && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✏️ Edit Supplier: {selectedSupplier.name}</h3>
              <button className="modal-close-btn" onClick={() => setShowEditModal(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="modal-body">
                {formError && <div className="alert alert-error">{formError}</div>}

                <div className="form-section">
                  <div className="section-title">Supplier Information</div>
                  <div className="form-row">
                    <div className="form-group flex-2">
                      <label>
                        Supplier Name <span style={{ color: "#ef4444" }}>*</span>
                      </label>
                      <input
                        type="text"
                        className="input-search"
                        style={{ width: "100%" }}
                        required
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      />
                    </div>
                    <div className="form-group flex-1">
                      <label>Status</label>
                      <select
                        className="filter-select"
                        style={{ width: "100%" }}
                        value={editForm.status}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            status: e.target.value as "ACTIVE" | "INACTIVE",
                          })
                        }
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="INACTIVE">INACTIVE</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group flex-1">
                      <label>Contact Person</label>
                      <input
                        type="text"
                        className="input-search"
                        style={{ width: "100%" }}
                        value={editForm.contactPerson || ""}
                        onChange={(e) =>
                          setEditForm({ ...editForm, contactPerson: e.target.value })
                        }
                      />
                    </div>
                    <div className="form-group flex-1">
                      <label>Tax / Business ID</label>
                      <input
                        type="text"
                        className="input-search"
                        style={{ width: "100%" }}
                        value={editForm.taxId || ""}
                        onChange={(e) => setEditForm({ ...editForm, taxId: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <div className="section-title">Contact & Location</div>
                  <div className="form-row">
                    <div className="form-group flex-1">
                      <label>Email Address</label>
                      <input
                        type="email"
                        className="input-search"
                        style={{ width: "100%" }}
                        value={editForm.email || ""}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      />
                    </div>
                    <div className="form-group flex-1">
                      <label>Phone Number</label>
                      <input
                        type="tel"
                        className="input-search"
                        style={{ width: "100%" }}
                        value={editForm.phone || ""}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Physical Address</label>
                    <textarea
                      className="input-search"
                      style={{ width: "100%", minHeight: "60px" }}
                      value={editForm.address || ""}
                      onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-section">
                  <div className="section-title">Operational Notes</div>
                  <div className="form-group">
                    <label>Notes & Terms</label>
                    <textarea
                      className="input-search"
                      style={{ width: "100%", minHeight: "60px" }}
                      value={editForm.notes || ""}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    />
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
      {/* MODAL 3: SUPPLIER DETAILS */}
      {/* ------------------------------------------------------------- */}
      {showDetailsModal && selectedSupplier && (
        <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="modal-card modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <h3>🚚 {selectedSupplier.name}</h3>
                <span
                  className={`stock-badge ${
                    selectedSupplier.status === "ACTIVE" ? "stock-ok" : "stock-low"
                  }`}
                >
                  {selectedSupplier.status}
                </span>
              </div>
              <button className="modal-close-btn" onClick={() => setShowDetailsModal(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="details-grid">
                <div className="detail-item">
                  <span className="detail-label">Supplier ID</span>
                  <span className="sku-tag">{selectedSupplier.id}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Tax / Business ID</span>
                  <span style={{ fontWeight: 600 }}>
                    {selectedSupplier.taxId || <span className="text-muted">Not provided</span>}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Contact Person</span>
                  <span style={{ fontWeight: 600 }}>
                    {selectedSupplier.contactPerson || <span className="text-muted">—</span>}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Status</span>
                  <span style={{ fontWeight: 600 }}>{selectedSupplier.status}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Email</span>
                  <span>
                    {selectedSupplier.email ? (
                      <a href={`mailto:${selectedSupplier.email}`}>{selectedSupplier.email}</a>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Phone</span>
                  <span>
                    {selectedSupplier.phone ? (
                      <a href={`tel:${selectedSupplier.phone}`}>{selectedSupplier.phone}</a>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Onboarded Date</span>
                  <span style={{ fontSize: "12px" }}>
                    {new Date(selectedSupplier.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Last Updated</span>
                  <span style={{ fontSize: "12px" }}>
                    {new Date(selectedSupplier.updatedAt).toLocaleString()}
                  </span>
                </div>
              </div>

              {selectedSupplier.address && (
                <div className="detail-item" style={{ marginTop: "12px" }}>
                  <span className="detail-label">Physical Address</span>
                  <div className="detail-description">{selectedSupplier.address}</div>
                </div>
              )}

              {selectedSupplier.notes && (
                <div className="detail-item" style={{ marginTop: "12px" }}>
                  <span className="detail-label">Operational Notes & Terms</span>
                  <div className="detail-description">{selectedSupplier.notes}</div>
                </div>
              )}

              {/* Clearly marked future procurement section */}
              <div
                style={{
                  marginTop: "20px",
                  padding: "16px",
                  borderRadius: "var(--radius-md, 8px)",
                  backgroundColor: "var(--bg-subtle, #f8fafc)",
                  border: "1px dashed var(--border-color, #cbd5e1)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                  <span style={{ fontSize: "18px" }}>📦</span>
                  <strong style={{ fontSize: "14px", color: "var(--text-main)" }}>
                    Procurement History
                  </strong>
                  <span
                    className="meta-tag"
                    style={{
                      backgroundColor: "rgba(59, 130, 246, 0.1)",
                      color: "#2563eb",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      fontSize: "11px",
                      fontWeight: 600,
                    }}
                  >
                    Coming in Phase 4B
                  </span>
                </div>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>
                  Purchase Orders, receiving shipments, and vendor order analytics will link directly
                  to this supplier master record in Phase 4B.
                </p>
              </div>
            </div>
            <div className="modal-footer">
              {hasPermission("SUPPLIER_UPDATE") && (
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowDetailsModal(false);
                    handleOpenEdit(selectedSupplier);
                  }}
                >
                  Edit Supplier
                </button>
              )}
              <button className="btn btn-primary" onClick={() => setShowDetailsModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
