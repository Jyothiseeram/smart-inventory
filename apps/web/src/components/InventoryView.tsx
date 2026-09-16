import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import {
  productsApi,
  type InventoryOverviewItem,
  type StockMovement,
} from "../api/products.api";

export const InventoryView: React.FC = () => {
  const { activeMembership, hasPermission } = useAuth();

  const [items, setItems] = useState<InventoryOverviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK">("ALL");

  // Adjustment Modal
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustItem, setAdjustItem] = useState<InventoryOverviewItem | null>(null);
  const [adjustDelta, setAdjustDelta] = useState<string>("");
  const [adjustType, setAdjustType] = useState<
    "ADJUSTMENT" | "DAMAGE" | "RETURN" | "PURCHASE" | "SALE"
  >("ADJUSTMENT");
  const [adjustReason, setAdjustReason] = useState<string>("");
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  // Movement History Modal
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyItem, setHistoryItem] = useState<InventoryOverviewItem | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [isLoadingMovements, setIsLoadingMovements] = useState(false);

  const loadInventory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await productsApi.getInventory({
        search: search || undefined,
        lowStock: statusFilter === "LOW_STOCK" ? true : undefined,
      });
      let data = res.data || [];
      if (statusFilter === "OUT_OF_STOCK") {
        data = data.filter((i) => i.stockStatus === "OUT_OF_STOCK");
      } else if (statusFilter === "IN_STOCK") {
        data = data.filter((i) => i.stockStatus === "IN_STOCK");
      }
      setItems(data);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Failed to load inventory data");
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    if (activeMembership) {
      loadInventory();
    }
  }, [activeMembership, loadInventory]);

  const showToast = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const openAdjustModal = (item: InventoryOverviewItem) => {
    setAdjustItem(item);
    setAdjustDelta("");
    setAdjustType("ADJUSTMENT");
    setAdjustReason("");
    setAdjustError(null);
    setShowAdjustModal(true);
  };

  const openHistoryModal = async (item: InventoryOverviewItem) => {
    setHistoryItem(item);
    setShowHistoryModal(true);
    setIsLoadingMovements(true);
    try {
      const res = await productsApi.getStockMovements(item.productId);
      setMovements(res.data.movements || []);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Failed to load stock movements");
    } finally {
      setIsLoadingMovements(false);
    }
  };

  const handleExecuteAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustItem) return;

    const delta = parseInt(adjustDelta, 10);
    if (isNaN(delta) || delta === 0) {
      setAdjustError("Quantity change must be a non-zero integer (e.g. +10 or -5)");
      return;
    }

    if (!adjustReason.trim()) {
      setAdjustError("A reason is required for auditing inventory adjustments");
      return;
    }

    const projected = adjustItem.currentQuantity + delta;
    if (projected < 0) {
      setAdjustError(
        `Insufficient stock: reducing by ${Math.abs(
          delta
        )} would result in negative stock (${projected}). Current stock is ${adjustItem.currentQuantity}.`
      );
      return;
    }

    setIsAdjusting(true);
    setAdjustError(null);

    try {
      const res = await productsApi.adjustStock(adjustItem.productId, {
        quantity: delta,
        movementType: adjustType,
        reason: adjustReason.trim(),
      });

      showToast(
        `Stock adjusted for '${adjustItem.name}': ${res.data.movement.previousQuantity} → ${res.data.movement.resultingQuantity} (${delta > 0 ? `+${delta}` : delta})`
      );
      setShowAdjustModal(false);
      loadInventory();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setAdjustError(e.message || "Failed to adjust stock");
    } finally {
      setIsAdjusting(false);
    }
  };

  // Metrics Calculations
  const totalTracked = items.length;
  const inStockCount = items.filter((i) => i.stockStatus === "IN_STOCK").length;
  const lowStockCount = items.filter((i) => i.stockStatus === "LOW_STOCK").length;
  const outOfStockCount = items.filter((i) => i.stockStatus === "OUT_OF_STOCK").length;

  // Projected stock for adjustment modal
  const numericDelta = parseInt(adjustDelta, 10) || 0;
  const currentQuantity = adjustItem?.currentQuantity ?? 0;
  const resultingQuantity = currentQuantity + numericDelta;
  const isNegative = resultingQuantity < 0;

  return (
    <div className="inventory-container">
      {/* View Header */}
      <div className="view-header">
        <div>
          <h2>📊 Inventory Management & Stock Auditing</h2>
          <p className="view-subtitle">
            Real-time stock level monitoring, atomic quantity adjustments, and auditable movement history.
          </p>
        </div>
        <div className="view-actions">
          <button className="btn btn-secondary" onClick={loadInventory}>
            🔄 Refresh Stock
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && <div className="alert alert-error">{error}</div>}
      {successMessage && <div className="alert alert-success">{successMessage}</div>}

      {/* KPI Metrics */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Tracked Products</span>
          <span className="stat-value">{totalTracked}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">In Stock Items</span>
          <span className="stat-value stat-success">{inStockCount}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Low Stock Warnings</span>
          <span className="stat-value stat-warning">{lowStockCount}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Out of Stock</span>
          <span className="stat-value stat-danger">{outOfStockCount}</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="filter-toolbar">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search stock by product name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-search"
          />
        </div>

        <div className="button-group">
          <button
            className={`btn btn-sm ${statusFilter === "ALL" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setStatusFilter("ALL")}
          >
            All Products ({totalTracked})
          </button>
          <button
            className={`btn btn-sm ${statusFilter === "IN_STOCK" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setStatusFilter("IN_STOCK")}
          >
            In Stock ({inStockCount})
          </button>
          <button
            className={`btn btn-sm ${statusFilter === "LOW_STOCK" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setStatusFilter("LOW_STOCK")}
          >
            ⚠️ Low Stock ({lowStockCount})
          </button>
          <button
            className={`btn btn-sm ${statusFilter === "OUT_OF_STOCK" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setStatusFilter("OUT_OF_STOCK")}
          >
            🛑 Out of Stock ({outOfStockCount})
          </button>
        </div>
      </div>

      {/* Stock Table */}
      {isLoading ? (
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading inventory stock records...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <p className="empty-title">No inventory records found</p>
          <p className="empty-desc">
            {search || statusFilter !== "ALL"
              ? "No items match your filter criteria."
              : "Products added to your catalogue will display their current stock here."}
          </p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product</th>
                <th>Classification</th>
                <th>Current Stock</th>
                <th>Reserved</th>
                <th>Available</th>
                <th>Reorder Level</th>
                <th>Stock Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.productId}>
                  <td>
                    <span className="sku-tag">{item.sku}</span>
                  </td>
                  <td>
                    <strong>{item.name}</strong>
                  </td>
                  <td>
                    <div className="tag-group">
                      {item.category && <span className="pill pill-category">{item.category}</span>}
                      {item.brand && <span className="pill pill-brand">{item.brand}</span>}
                      {!item.category && !item.brand && <span className="text-muted">—</span>}
                    </div>
                  </td>
                  <td>
                    <strong className="text-large">
                      {item.currentQuantity} {item.unitCode || "units"}
                    </strong>
                  </td>
                  <td>{item.reservedQuantity}</td>
                  <td>
                    <strong>
                      {item.availableQuantity} {item.unitCode || "units"}
                    </strong>
                  </td>
                  <td>{item.reorderLevel}</td>
                  <td>
                    <span
                      className={`badge ${
                        item.stockStatus === "IN_STOCK"
                          ? "badge-success"
                          : item.stockStatus === "LOW_STOCK"
                          ? "badge-warning"
                          : "badge-danger"
                      }`}
                    >
                      {item.stockStatus === "IN_STOCK"
                        ? "✓ In Stock"
                        : item.stockStatus === "LOW_STOCK"
                        ? "⚠️ Low Stock"
                        : "🛑 Out of Stock"}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      {hasPermission("STOCK_ADJUST") && (
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => openAdjustModal(item)}
                          title="Adjust stock quantity"
                        >
                          ⚡ Adjust Stock
                        </button>
                      )}
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => openHistoryModal(item)}
                        title="View audit movement trail"
                      >
                        📜 History
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: CONTROLLED STOCK ADJUSTMENT */}
      {/* ------------------------------------------------------------- */}
      {showAdjustModal && adjustItem && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3>⚡ Stock Adjustment: {adjustItem.name}</h3>
              <button className="btn-close" onClick={() => setShowAdjustModal(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleExecuteAdjustment}>
              <div className="modal-body">
                {adjustError && <div className="alert alert-error">{adjustError}</div>}

                {/* Current vs Resulting Live Calculation */}
                <div className="adjustment-preview-card">
                  <div className="preview-item">
                    <span className="preview-label">Current Stock</span>
                    <span className="preview-number">{currentQuantity}</span>
                  </div>
                  <div className="preview-symbol">
                    {numericDelta >= 0 ? "+" : "−"}
                  </div>
                  <div className="preview-item">
                    <span className="preview-label">Change</span>
                    <span className="preview-number">{Math.abs(numericDelta)}</span>
                  </div>
                  <div className="preview-symbol">=</div>
                  <div className="preview-item">
                    <span className="preview-label">Resulting Stock</span>
                    <span
                      className={`preview-number ${
                        isNegative ? "text-danger" : "text-success"
                      }`}
                    >
                      {resultingQuantity} {adjustItem.unitCode || "units"}
                    </span>
                  </div>
                </div>

                {isNegative && (
                  <div className="alert alert-error">
                    🚫 Strict Negative Stock Rule: Inventory cannot fall below zero.
                  </div>
                )}

                <div className="form-group">
                  <label>Quantity Change (+ or −) *</label>
                  <input
                    type="number"
                    step="1"
                    required
                    placeholder="e.g. +20 to restock, or -5 to write off"
                    value={adjustDelta}
                    onChange={(e) => setAdjustDelta(e.target.value)}
                  />
                  <span className="table-subtext">
                    Use positive numbers to increase stock, negative numbers to decrease.
                  </span>
                </div>

                <div className="form-group">
                  <label>Movement Reason Category *</label>
                  <select
                    value={adjustType}
                    onChange={(e) =>
                      setAdjustType(
                        e.target.value as "ADJUSTMENT" | "DAMAGE" | "RETURN" | "PURCHASE" | "SALE"
                      )
                    }
                  >
                    <option value="ADJUSTMENT">Inventory Count Audit / Recount</option>
                    <option value="DAMAGE">Damaged / Expired Goods Write-off</option>
                    <option value="RETURN">Customer or Supplier Return</option>
                    <option value="PURCHASE">Direct Stock Intake</option>
                    <option value="SALE">Manual Sales Issue</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Audit Reason Note *</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Provide a mandatory reason for this stock adjustment..."
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAdjustModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isAdjusting || isNegative || numericDelta === 0}
                >
                  {isAdjusting ? "Executing..." : "Confirm Stock Adjustment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: STOCK MOVEMENT AUDIT TRAIL */}
      {/* ------------------------------------------------------------- */}
      {showHistoryModal && historyItem && (
        <div className="modal-backdrop">
          <div className="modal-dialog modal-lg">
            <div className="modal-header">
              <h3>📜 Movement Audit Trail: {historyItem.name}</h3>
              <button className="btn-close" onClick={() => setShowHistoryModal(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="details-header">
                <div>
                  <h4>{historyItem.name}</h4>
                  <p className="table-subtext">SKU: {historyItem.sku}</p>
                </div>
                <div>
                  <span className="badge badge-business">
                    Current: {historyItem.currentQuantity} {historyItem.unitCode || "units"}
                  </span>
                </div>
              </div>

              {isLoadingMovements ? (
                <div className="loading-state">
                  <div className="spinner" />
                  <p>Loading historical audit movements...</p>
                </div>
              ) : movements.length === 0 ? (
                <div className="empty-state">
                  <p className="empty-title">No stock movements recorded yet</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date & Time</th>
                        <th>Movement Type</th>
                        <th>Quantity Delta</th>
                        <th>Stock Transition</th>
                        <th>Reason / Reference</th>
                        <th>Authorized By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.map((m) => (
                        <tr key={m.id}>
                          <td>{new Date(m.createdAt).toLocaleString()}</td>
                          <td>
                            <span
                              className={`pill ${
                                m.movementType === "OPENING_STOCK"
                                  ? "pill-category"
                                  : m.movementType === "DAMAGE"
                                  ? "pill-brand"
                                  : "badge-business"
                              }`}
                            >
                              {m.movementType}
                            </span>
                          </td>
                          <td>
                            <strong
                              className={m.quantity >= 0 ? "text-success" : "text-danger"}
                            >
                              {m.quantity >= 0 ? `+${m.quantity}` : m.quantity}
                            </strong>
                          </td>
                          <td>
                            <span className="text-muted">
                              {m.previousQuantity} →{" "}
                              <strong className="text-white">{m.resultingQuantity}</strong>
                            </span>
                          </td>
                          <td>{m.reason}</td>
                          <td>
                            {m.createdByUser ? (
                              <div className="user-pill">
                                <span>{m.createdByUser.name}</span>
                                <span className="table-subtext">{m.createdByUser.email}</span>
                              </div>
                            ) : (
                              <span className="text-muted">System</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowHistoryModal(false)}>
                Close Audit Trail
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
