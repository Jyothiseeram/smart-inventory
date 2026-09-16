import { prisma } from "../../infrastructure/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import { runTransaction } from "../../common/database/transaction.js";
import { NotFoundError, ConflictError, ForbiddenError, ValidationError } from "../../common/errors/app-error.js";
import { ProductStatus, StockMovementType } from "../../generated/prisma/enums.js";

export interface CreateProductInput {
  name: string;
  description?: string | null;
  sku: string;
  barcode?: string | null;
  categoryId?: string | null;
  brandId?: string | null;
  unitId?: string | null;
  costPrice?: number;
  sellingPrice?: number;
  reorderLevel?: number;
  initialStock?: number;
}

export interface UpdateProductInput {
  name?: string;
  description?: string | null;
  sku?: string;
  barcode?: string | null;
  categoryId?: string | null;
  brandId?: string | null;
  unitId?: string | null;
  costPrice?: number;
  sellingPrice?: number;
  reorderLevel?: number;
  status?: ProductStatus;
}

export interface ListProductsQuery {
  search?: string;
  categoryId?: string;
  brandId?: string;
  unitId?: string;
  status?: ProductStatus;
  lowStock?: boolean;
  page?: number;
  limit?: number;
}

export class ProductService {
  /**
   * Validates that foreign classification entities (category, brand, unit)
   * belong to the specified organization to enforce strict multi-tenant isolation.
   */
  private static async validateClassificationsOwnership(
    organizationId: string,
    classifications: { categoryId?: string | null; brandId?: string | null; unitId?: string | null }
  ) {
    if (classifications.categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: classifications.categoryId },
      });
      if (!category) {
        throw new NotFoundError(`Category with ID ${classifications.categoryId} not found`);
      }
      if (category.organizationId !== organizationId) {
        throw new ForbiddenError(
          `Multi-Tenant Isolation Enforced: Category '${classifications.categoryId}' does not belong to organization '${organizationId}'. Access denied.`
        );
      }
    }

    if (classifications.brandId) {
      const brand = await prisma.brand.findUnique({
        where: { id: classifications.brandId },
      });
      if (!brand) {
        throw new NotFoundError(`Brand with ID ${classifications.brandId} not found`);
      }
      if (brand.organizationId !== organizationId) {
        throw new ForbiddenError(
          `Multi-Tenant Isolation Enforced: Brand '${classifications.brandId}' does not belong to organization '${organizationId}'. Access denied.`
        );
      }
    }

    if (classifications.unitId) {
      const unit = await prisma.unit.findUnique({
        where: { id: classifications.unitId },
      });
      if (!unit) {
        throw new NotFoundError(`Unit with ID ${classifications.unitId} not found`);
      }
      if (unit.organizationId !== organizationId) {
        throw new ForbiddenError(
          `Multi-Tenant Isolation Enforced: Unit '${classifications.unitId}' does not belong to organization '${organizationId}'. Access denied.`
        );
      }
    }
  }

  /**
   * Creates a product and initializes its dedicated inventory atomically.
   */
  static async createProduct(organizationId: string, input: CreateProductInput, userId?: string) {
    // 1. Validate tenant ownership of classification entities
    await this.validateClassificationsOwnership(organizationId, {
      categoryId: input.categoryId,
      brandId: input.brandId,
      unitId: input.unitId,
    });

    const skuNormalized = input.sku.trim().toUpperCase();

    // 2. Enforce organization-scoped SKU uniqueness
    const existingSku = await prisma.product.findUnique({
      where: {
        organizationId_sku: {
          organizationId,
          sku: skuNormalized,
        },
      },
    });

    if (existingSku) {
      throw new ConflictError(
        `A product with SKU '${skuNormalized}' already exists in this organization`
      );
    }

    // 3. Enforce organization-scoped Barcode uniqueness if barcode is provided
    if (input.barcode && input.barcode.trim().length > 0) {
      const barcodeNormalized = input.barcode.trim();
      const existingBarcode = await prisma.product.findUnique({
        where: {
          organizationId_barcode: {
            organizationId,
            barcode: barcodeNormalized,
          },
        },
      });

      if (existingBarcode) {
        throw new ConflictError(
          `A product with barcode '${barcodeNormalized}' already exists in this organization`
        );
      }
    }

    const initialStock = Math.max(0, Math.floor(input.initialStock ?? 0));
    const costPriceDecimal = new Prisma.Decimal(input.costPrice ?? 0);
    const sellingPriceDecimal = new Prisma.Decimal(input.sellingPrice ?? 0);

    // 4. Atomic transaction: create product, inventory, and initial stock movement
    return runTransaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          organizationId,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          sku: skuNormalized,
          barcode: input.barcode?.trim() || null,
          categoryId: input.categoryId || null,
          brandId: input.brandId || null,
          unitId: input.unitId || null,
          costPrice: costPriceDecimal,
          sellingPrice: sellingPriceDecimal,
          reorderLevel: Math.max(0, Math.floor(input.reorderLevel ?? 0)),
          status: ProductStatus.ACTIVE,
        },
      });

      const inventory = await tx.inventory.create({
        data: {
          organizationId,
          productId: product.id,
          currentQuantity: initialStock,
          reservedQuantity: 0,
        },
      });

      if (initialStock > 0) {
        await tx.stockMovement.create({
          data: {
            organizationId,
            productId: product.id,
            quantity: initialStock,
            movementType: StockMovementType.OPENING_STOCK,
            previousQuantity: 0,
            resultingQuantity: initialStock,
            reason: "Initial stock on product creation",
            createdBy: userId || null,
          },
        });
      }

      // Re-fetch product with relations
      return tx.product.findUnique({
        where: { id: product.id },
        include: {
          category: true,
          brand: true,
          unit: true,
          inventory: true,
        },
      });
    });
  }

  /**
   * Retrieves single product details with inventory and classification metadata.
   */
  static async getProductById(organizationId: string, productId: string) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
        brand: true,
        unit: true,
        inventory: true,
      },
    });

    if (!product) {
      throw new NotFoundError(`Product with ID ${productId} not found`);
    }

    if (product.organizationId !== organizationId) {
      throw new ForbiddenError(
        `Multi-Tenant Isolation Enforced: Product does not belong to organization '${organizationId}'. Access denied.`
      );
    }

    return product;
  }

  /**
   * Lists products for an organization with searching, filtering, and pagination.
   */
  static async listProducts(organizationId: string, query: ListProductsQuery) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 50));
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      organizationId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.brandId ? { brandId: query.brandId } : {}),
      ...(query.unitId ? { unitId: query.unitId } : {}),
    };

    if (query.search && query.search.trim().length > 0) {
      const search = query.search.trim();
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
        { barcode: { contains: search, mode: "insensitive" } },
      ];
    }

    // Low stock filter
    if (query.lowStock) {
      const lowStockRows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT p.id 
        FROM products p 
        JOIN inventories i ON p.id = i.product_id 
        WHERE p.organization_id = ${organizationId}::uuid 
          AND i.current_quantity <= p.reorder_level
      `;
      const ids = lowStockRows.map((r) => r.id);
      where.id = { in: ids };
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: true,
          brand: true,
          unit: true,
          inventory: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    return {
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Updates an existing product.
   */
  static async updateProduct(organizationId: string, productId: string, input: UpdateProductInput) {
    const current = await this.getProductById(organizationId, productId);

    // Validate classification ownership if updated
    await this.validateClassificationsOwnership(organizationId, {
      categoryId: input.categoryId,
      brandId: input.brandId,
      unitId: input.unitId,
    });

    // Check SKU uniqueness if changed
    if (input.sku) {
      const normalizedSku = input.sku.trim().toUpperCase();
      if (normalizedSku !== current.sku) {
        const existingSku = await prisma.product.findUnique({
          where: {
            organizationId_sku: {
              organizationId,
              sku: normalizedSku,
            },
          },
        });

        if (existingSku && existingSku.id !== productId) {
          throw new ConflictError(
            `A product with SKU '${normalizedSku}' already exists in this organization`
          );
        }
      }
    }

    // Check Barcode uniqueness if changed
    if (input.barcode !== undefined && input.barcode !== null && input.barcode.trim().length > 0) {
      const normalizedBarcode = input.barcode.trim();
      if (normalizedBarcode !== current.barcode) {
        const existingBarcode = await prisma.product.findUnique({
          where: {
            organizationId_barcode: {
              organizationId,
              barcode: normalizedBarcode,
            },
          },
        });

        if (existingBarcode && existingBarcode.id !== productId) {
          throw new ConflictError(
            `A product with barcode '${normalizedBarcode}' already exists in this organization`
          );
        }
      }
    }

    const updateData: Prisma.ProductUpdateInput = {
      ...(input.name ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
      ...(input.sku ? { sku: input.sku.trim().toUpperCase() } : {}),
      ...(input.barcode !== undefined ? { barcode: input.barcode?.trim() || null } : {}),
      ...(input.categoryId !== undefined
        ? input.categoryId
          ? { category: { connect: { id: input.categoryId } } }
          : { category: { disconnect: true } }
        : {}),
      ...(input.brandId !== undefined
        ? input.brandId
          ? { brand: { connect: { id: input.brandId } } }
          : { brand: { disconnect: true } }
        : {}),
      ...(input.unitId !== undefined
        ? input.unitId
          ? { unit: { connect: { id: input.unitId } } }
          : { unit: { disconnect: true } }
        : {}),
      ...(input.costPrice !== undefined ? { costPrice: new Prisma.Decimal(input.costPrice) } : {}),
      ...(input.sellingPrice !== undefined ? { sellingPrice: new Prisma.Decimal(input.sellingPrice) } : {}),
      ...(input.reorderLevel !== undefined ? { reorderLevel: Math.max(0, Math.floor(input.reorderLevel)) } : {}),
      ...(input.status ? { status: input.status } : {}),
    };

    return prisma.product.update({
      where: { id: productId },
      data: updateData,
      include: {
        category: true,
        brand: true,
        unit: true,
        inventory: true,
      },
    });
  }

  /**
   * Deactivates or removes a product, preserving historical stock movements.
   * If stock movements exist or current stock > 0, performs soft deactivation (INACTIVE).
   * If zero movements and zero stock, safely purges the product.
   */
  static async deleteOrDeactivateProduct(organizationId: string, productId: string) {
    const product = await this.getProductById(organizationId, productId);

    const movementCount = await prisma.stockMovement.count({
      where: { productId, organizationId },
    });

    const currentStock = product.inventory?.currentQuantity ?? 0;

    if (movementCount > 0 || currentStock > 0) {
      // Soft deactivation to preserve historical audit trail
      const deactivated = await prisma.product.update({
        where: { id: productId },
        data: { status: ProductStatus.INACTIVE },
        include: { inventory: true },
      });

      return {
        action: "DEACTIVATED",
        message: `Product '${product.name}' deactivated to preserve ${movementCount} historical stock movement record(s).`,
        product: deactivated,
      };
    }

    // No historical records exist, safe to delete physically
    await prisma.product.delete({
      where: { id: productId },
    });

    return {
      action: "DELETED",
      message: `Product '${product.name}' deleted successfully.`,
    };
  }
}
