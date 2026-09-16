import { z } from "zod";

export const uuidParamSchema = z.string().uuid("Invalid UUID format");

export const idParamsSchema = z.object({
  id: uuidParamSchema,
});

export const productIdParamsSchema = z.object({
  productId: uuidParamSchema,
});

// Category validation
export const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Category name is required").max(100, "Category name too long"),
  description: z.string().trim().max(500).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional().default("ACTIVE"),
});

export const updateCategorySchema = z.object({
  name: z.string().trim().min(1, "Category name is required").max(100).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

// Brand validation
export const createBrandSchema = z.object({
  name: z.string().trim().min(1, "Brand name is required").max(100, "Brand name too long"),
  description: z.string().trim().max(500).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional().default("ACTIVE"),
});

export const updateBrandSchema = z.object({
  name: z.string().trim().min(1, "Brand name is required").max(100).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

// Unit of measure validation
export const createUnitSchema = z.object({
  name: z.string().trim().min(1, "Unit name is required").max(100, "Unit name too long"),
  code: z.string().trim().min(1, "Unit code is required").max(20, "Unit code too long"),
  description: z.string().trim().max(500).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional().default("ACTIVE"),
});

export const updateUnitSchema = z.object({
  name: z.string().trim().min(1, "Unit name is required").max(100).optional(),
  code: z.string().trim().min(1, "Unit code is required").max(20).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

// Product validation
export const createProductSchema = z.object({
  name: z.string().trim().min(1, "Product name is required").max(200, "Product name too long"),
  description: z.string().trim().max(2000).optional(),
  sku: z
    .string()
    .trim()
    .min(1, "SKU is required")
    .max(100, "SKU too long")
    .regex(/^[A-Za-z0-9-_.]+$/, "SKU may only contain letters, numbers, hyphens, underscores, and periods"),
  barcode: z.string().trim().max(100).optional().nullable(),
  categoryId: z.string().uuid("Invalid category ID format").optional().nullable(),
  brandId: z.string().uuid("Invalid brand ID format").optional().nullable(),
  unitId: z.string().uuid("Invalid unit ID format").optional().nullable(),
  costPrice: z.coerce.number().min(0, "Cost price cannot be negative").default(0),
  sellingPrice: z.coerce.number().min(0, "Selling price cannot be negative").default(0),
  reorderLevel: z.coerce.number().int("Reorder level must be an integer").min(0, "Reorder level cannot be negative").default(0),
  initialStock: z.coerce.number().int("Initial stock must be an integer").min(0, "Initial stock cannot be negative").default(0),
});

export const updateProductSchema = z.object({
  name: z.string().trim().min(1, "Product name cannot be empty").max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  sku: z
    .string()
    .trim()
    .min(1, "SKU cannot be empty")
    .max(100)
    .regex(/^[A-Za-z0-9-_.]+$/, "SKU may only contain letters, numbers, hyphens, underscores, and periods")
    .optional(),
  barcode: z.string().trim().max(100).nullable().optional(),
  categoryId: z.string().uuid("Invalid category ID format").nullable().optional(),
  brandId: z.string().uuid("Invalid brand ID format").nullable().optional(),
  unitId: z.string().uuid("Invalid unit ID format").nullable().optional(),
  costPrice: z.coerce.number().min(0, "Cost price cannot be negative").optional(),
  sellingPrice: z.coerce.number().min(0, "Selling price cannot be negative").optional(),
  reorderLevel: z.coerce.number().int("Reorder level must be an integer").min(0, "Reorder level cannot be negative").optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).optional(),
});

// Stock adjustment validation
export const adjustStockSchema = z.object({
  quantity: z
    .coerce
    .number()
    .int("Adjustment quantity must be a non-zero integer")
    .refine((val) => val !== 0, "Adjustment quantity cannot be zero"),
  movementType: z.enum(["ADJUSTMENT", "DAMAGE", "RETURN", "PURCHASE", "SALE", "OPENING_STOCK"]).default("ADJUSTMENT"),
  reason: z.string().trim().min(1, "Reason is required for inventory adjustments").max(500, "Reason is too long"),
  referenceType: z.string().trim().max(100).optional(),
  referenceId: z.string().trim().max(100).optional(),
});

export const listProductsQuerySchema = z.object({
  search: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  brandId: z.string().uuid().optional(),
  unitId: z.string().uuid().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).optional(),
  lowStock: z
    .string()
    .optional()
    .transform((val) => val === "true"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
