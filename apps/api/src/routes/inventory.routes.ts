import { Router, type Request, type Response, type NextFunction } from "express";
import { requireAuth } from "../middleware/authenticate.js";
import { requireOrgMembership, requirePermission } from "../middleware/authorization.js";
import { validate } from "../middleware/validate.js";
import { ApiResponse } from "../common/response/api-response.js";
import { InventoryService } from "../modules/inventory/inventory.service.js";
import {
  adjustStockSchema,
  productIdParamsSchema,
} from "../modules/catalogue/catalogue.validation.js";

const inventoryRouter = Router({ mergeParams: true });
inventoryRouter.use(requireAuth, requireOrgMembership);

/**
 * GET /api/v1/inventory
 * Retrieves overall inventory summary and stock levels for an organization.
 */
inventoryRouter.get(
  "/",
  requirePermission("STOCK_VIEW"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.organizationId!;
      const lowStockOnly = req.query.lowStock === "true";
      const search = typeof req.query.search === "string" ? req.query.search : undefined;

      const items = await InventoryService.getInventoryOverview(orgId, {
        lowStockOnly,
        search,
      });

      ApiResponse.success(res, items);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/inventory/:productId
 * Retrieves inventory details and stock levels for a specific product.
 */
inventoryRouter.get(
  "/:productId",
  requirePermission("STOCK_VIEW"),
  validate({ params: productIdParamsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.organizationId!;
      const data = await InventoryService.getProductInventory(orgId, req.params.productId as string);
      ApiResponse.success(res, data);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/inventory/:productId/adjust
 * Performs an atomic inventory stock adjustment with negative stock validation.
 */
inventoryRouter.post(
  "/:productId/adjust",
  requirePermission("STOCK_ADJUST"),
  validate({ params: productIdParamsSchema, body: adjustStockSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.organizationId!;
      const userId = req.user?.id;
      const { quantity, movementType, reason, referenceType, referenceId } = req.body;

      const result = await InventoryService.adjustStock({
        organizationId: orgId,
        productId: req.params.productId as string,
        quantityChange: quantity,
        movementType,
        reason,
        referenceType,
        referenceId,
        userId,
      });

      ApiResponse.success(res, result, 200, "Stock adjusted successfully");
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/inventory/:productId/movements
 * Retrieves auditable stock movements for a specific product.
 */
inventoryRouter.get(
  "/:productId/movements",
  requirePermission("STOCK_VIEW"),
  validate({ params: productIdParamsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.organizationId!;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

      const data = await InventoryService.getStockMovements(
        orgId,
        req.params.productId as string,
        limit
      );

      ApiResponse.success(res, data);
    } catch (error) {
      next(error);
    }
  }
);

export default inventoryRouter;
