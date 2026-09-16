import { Router, type Request, type Response, type NextFunction } from "express";
import { requireAuth } from "../middleware/authenticate.js";
import { requireOrgMembership, requirePermission } from "../middleware/authorization.js";
import { validate } from "../middleware/validate.js";
import { ApiResponse } from "../common/response/api-response.js";
import { ClassificationService } from "../modules/catalogue/classification.service.js";
import {
  createCategorySchema,
  updateCategorySchema,
  createBrandSchema,
  updateBrandSchema,
  createUnitSchema,
  updateUnitSchema,
  idParamsSchema,
} from "../modules/catalogue/catalogue.validation.js";

// Router for categories
export const categoryRouter = Router({ mergeParams: true });
categoryRouter.use(requireAuth, requireOrgMembership);

categoryRouter.get("/", requirePermission("PRODUCT_VIEW"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    const categories = await ClassificationService.listCategories(orgId);
    ApiResponse.success(res, categories);
  } catch (error) {
    next(error);
  }
});

categoryRouter.get("/:id", requirePermission("PRODUCT_VIEW"), validate({ params: idParamsSchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    const category = await ClassificationService.getCategoryById(orgId, req.params.id as string);
    ApiResponse.success(res, category);
  } catch (error) {
    next(error);
  }
});

categoryRouter.post("/", requirePermission("PRODUCT_CREATE"), validate({ body: createCategorySchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    const category = await ClassificationService.createCategory(orgId, req.body);
    ApiResponse.success(res, category, 201, "Category created successfully");
  } catch (error) {
    next(error);
  }
});

categoryRouter.patch("/:id", requirePermission("PRODUCT_UPDATE"), validate({ params: idParamsSchema, body: updateCategorySchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    const category = await ClassificationService.updateCategory(orgId, req.params.id as string, req.body);
    ApiResponse.success(res, category, 200, "Category updated successfully");
  } catch (error) {
    next(error);
  }
});

categoryRouter.delete("/:id", requirePermission("PRODUCT_DELETE"), validate({ params: idParamsSchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    await ClassificationService.deleteCategory(orgId, req.params.id as string);
    ApiResponse.success(res, { id: req.params.id }, 200, "Category deleted successfully");
  } catch (error) {
    next(error);
  }
});

// Router for brands
export const brandRouter = Router({ mergeParams: true });
brandRouter.use(requireAuth, requireOrgMembership);

brandRouter.get("/", requirePermission("PRODUCT_VIEW"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    const brands = await ClassificationService.listBrands(orgId);
    ApiResponse.success(res, brands);
  } catch (error) {
    next(error);
  }
});

brandRouter.get("/:id", requirePermission("PRODUCT_VIEW"), validate({ params: idParamsSchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    const brand = await ClassificationService.getBrandById(orgId, req.params.id as string);
    ApiResponse.success(res, brand);
  } catch (error) {
    next(error);
  }
});

brandRouter.post("/", requirePermission("PRODUCT_CREATE"), validate({ body: createBrandSchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    const brand = await ClassificationService.createBrand(orgId, req.body);
    ApiResponse.success(res, brand, 201, "Brand created successfully");
  } catch (error) {
    next(error);
  }
});

brandRouter.patch("/:id", requirePermission("PRODUCT_UPDATE"), validate({ params: idParamsSchema, body: updateBrandSchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    const brand = await ClassificationService.updateBrand(orgId, req.params.id as string, req.body);
    ApiResponse.success(res, brand, 200, "Brand updated successfully");
  } catch (error) {
    next(error);
  }
});

brandRouter.delete("/:id", requirePermission("PRODUCT_DELETE"), validate({ params: idParamsSchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    await ClassificationService.deleteBrand(orgId, req.params.id as string);
    ApiResponse.success(res, { id: req.params.id }, 200, "Brand deleted successfully");
  } catch (error) {
    next(error);
  }
});

// Router for units
export const unitRouter = Router({ mergeParams: true });
unitRouter.use(requireAuth, requireOrgMembership);

unitRouter.get("/", requirePermission("PRODUCT_VIEW"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    const units = await ClassificationService.listUnits(orgId);
    ApiResponse.success(res, units);
  } catch (error) {
    next(error);
  }
});

unitRouter.get("/:id", requirePermission("PRODUCT_VIEW"), validate({ params: idParamsSchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    const unit = await ClassificationService.getUnitById(orgId, req.params.id as string);
    ApiResponse.success(res, unit);
  } catch (error) {
    next(error);
  }
});

unitRouter.post("/", requirePermission("PRODUCT_CREATE"), validate({ body: createUnitSchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    const unit = await ClassificationService.createUnit(orgId, req.body);
    ApiResponse.success(res, unit, 201, "Unit created successfully");
  } catch (error) {
    next(error);
  }
});

unitRouter.patch("/:id", requirePermission("PRODUCT_UPDATE"), validate({ params: idParamsSchema, body: updateUnitSchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    const unit = await ClassificationService.updateUnit(orgId, req.params.id as string, req.body);
    ApiResponse.success(res, unit, 200, "Unit updated successfully");
  } catch (error) {
    next(error);
  }
});

unitRouter.delete("/:id", requirePermission("PRODUCT_DELETE"), validate({ params: idParamsSchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    await ClassificationService.deleteUnit(orgId, req.params.id as string);
    ApiResponse.success(res, { id: req.params.id }, 200, "Unit deleted successfully");
  } catch (error) {
    next(error);
  }
});
