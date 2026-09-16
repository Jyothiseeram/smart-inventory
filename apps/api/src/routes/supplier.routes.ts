import { Router, type Request, type Response, type NextFunction } from "express";
import { requireAuth } from "../middleware/authenticate.js";
import { requireOrgMembership, requirePermission } from "../middleware/authorization.js";
import { validate } from "../middleware/validate.js";
import { ApiResponse } from "../common/response/api-response.js";
import { SupplierService } from "../modules/catalogue/supplier.service.js";
import {
  createSupplierSchema,
  updateSupplierSchema,
  listSuppliersQuerySchema,
  supplierIdParamsSchema,
} from "../modules/catalogue/supplier.validation.js";

const supplierRouter = Router({ mergeParams: true });
supplierRouter.use(requireAuth, requireOrgMembership);

/**
 * GET /api/v1/suppliers
 * Lists suppliers with search, status filtering, pagination, and KPI counts.
 */
supplierRouter.get(
  "/",
  requirePermission("SUPPLIER_VIEW"),
  validate({ query: listSuppliersQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.organizationId!;
      const result = await SupplierService.listSuppliers(orgId, req.query as any);
      ApiResponse.success(
        res,
        result.suppliers,
        200,
        undefined,
        result.pagination,
        { metrics: result.metrics }
      );
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/suppliers/:id
 * Retrieves single supplier profile details.
 */
supplierRouter.get(
  "/:id",
  requirePermission("SUPPLIER_VIEW"),
  validate({ params: supplierIdParamsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.organizationId!;
      const supplier = await SupplierService.getSupplierById(orgId, req.params.id as string);
      ApiResponse.success(res, supplier);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/suppliers
 * Onboards and registers a new supplier within the authenticated organization.
 */
supplierRouter.post(
  "/",
  requirePermission("SUPPLIER_CREATE"),
  validate({ body: createSupplierSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.organizationId!;
      const supplier = await SupplierService.createSupplier(orgId, req.body);
      ApiResponse.success(res, supplier, 201, "Supplier created successfully");
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/v1/suppliers/:id
 * Updates supplier master details or status.
 */
supplierRouter.patch(
  "/:id",
  requirePermission("SUPPLIER_UPDATE"),
  validate({ params: supplierIdParamsSchema, body: updateSupplierSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.organizationId!;
      const supplier = await SupplierService.updateSupplier(
        orgId,
        req.params.id as string,
        req.body
      );
      ApiResponse.success(res, supplier, 200, "Supplier updated successfully");
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/suppliers/:id
 * Deactivates or removes a supplier from the catalogue.
 */
supplierRouter.delete(
  "/:id",
  requirePermission("SUPPLIER_UPDATE"),
  validate({ params: supplierIdParamsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.organizationId!;
      const result = await SupplierService.deleteOrDeactivateSupplier(
        orgId,
        req.params.id as string
      );
      ApiResponse.success(res, result, 200, result.message);
    } catch (error) {
      next(error);
    }
  }
);

export default supplierRouter;
