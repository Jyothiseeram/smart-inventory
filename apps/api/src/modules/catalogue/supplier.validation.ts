import { z } from "zod";

export const uuidParamSchema = z.string().uuid("Invalid UUID format");

export const supplierIdParamsSchema = z.object({
  id: uuidParamSchema,
});

export const createSupplierSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Supplier name is required")
    .max(200, "Supplier name too long"),
  contactPerson: z
    .string()
    .trim()
    .max(100, "Contact person name too long")
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
  email: z
    .string()
    .trim()
    .email("Invalid email format")
    .max(255, "Email too long")
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  phone: z
    .string()
    .trim()
    .max(50, "Phone number too long")
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
  address: z
    .string()
    .trim()
    .max(500, "Address too long")
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
  taxId: z
    .string()
    .trim()
    .max(50, "Tax identifier too long")
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
  notes: z
    .string()
    .trim()
    .max(2000, "Notes too long")
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional().default("ACTIVE"),
});

export const updateSupplierSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Supplier name cannot be empty")
    .max(200, "Supplier name too long")
    .optional(),
  contactPerson: z
    .string()
    .trim()
    .max(100, "Contact person name too long")
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
  email: z
    .string()
    .trim()
    .email("Invalid email format")
    .max(255, "Email too long")
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  phone: z
    .string()
    .trim()
    .max(50, "Phone number too long")
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
  address: z
    .string()
    .trim()
    .max(500, "Address too long")
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
  taxId: z
    .string()
    .trim()
    .max(50, "Tax identifier too long")
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
  notes: z
    .string()
    .trim()
    .max(2000, "Notes too long")
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const listSuppliersQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
