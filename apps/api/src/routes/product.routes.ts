import { Router, type Request, type Response, type NextFunction } from "express";
import { requireAuth } from "../middleware/authenticate.js";
import { requireOrgMembership, requirePermission } from "../middleware/authorization.js";
import { validate } from "../middleware/validate.js";
import { ApiResponse } from "../common/response/api-response.js";
import { ProductService } from "../modules/catalogue/product.service.js";
import {
  createProductSchema,
  updateProductSchema,
  listProductsQuerySchema,
  idParamsSchema,
} from "../modules/catalogue/catalogue.validation.js";

const productRouter = Router({ mergeParams: true });
productRouter.use(requireAuth, requireOrgMembership);

/**
 * GET /api/v1/products
 * List products with filters, search, and pagination.
 */
productRouter.get(
  "/",
  requirePermission("PRODUCT_VIEW"),
  validate({ query: listProductsQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.organizationId!;
      const result = await ProductService.listProducts(orgId, req.query as any);
      ApiResponse.success(res, result.products, 200, undefined, result.pagination);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/products/:id
 * Retrieve single product details with inventory and classifications.
 */
productRouter.get(
  "/:id",
  requirePermission("PRODUCT_VIEW"),
  validate({ params: idParamsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.organizationId!;
      const product = await ProductService.getProductById(orgId, req.params.id as string);
      ApiResponse.success(res, product);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/products
 * Create a new product and initialize its inventory.
 */
productRouter.post(
  "/",
  requirePermission("PRODUCT_CREATE"),
  validate({ body: createProductSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.organizationId!;
      const userId = req.user?.id;
      const product = await ProductService.createProduct(orgId, req.body, userId);
      ApiResponse.success(res, product, 201, "Product created successfully");
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/v1/products/:id
 * Update product information.
 */
productRouter.patch(
  "/:id",
  requirePermission("PRODUCT_UPDATE"),
  validate({ params: idParamsSchema, body: updateProductSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.organizationId!;
      const product = await ProductService.updateProduct(orgId, req.params.id as string, req.body);
      ApiResponse.success(res, product, 200, "Product updated successfully");
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/products/:id
 * Deactivates or removes a product preserving historical stock movements.
 */
productRouter.delete(
  "/:id",
  requirePermission("PRODUCT_DELETE"),
  validate({ params: idParamsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.organizationId!;
      const result = await ProductService.deleteOrDeactivateProduct(orgId, req.params.id as string);
      ApiResponse.success(res, result, 200, result.message);
    } catch (error) {
      next(error);
    }
  }
);

export default productRouter;
