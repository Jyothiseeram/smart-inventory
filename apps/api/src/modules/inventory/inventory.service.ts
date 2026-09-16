import { prisma } from "../../infrastructure/prisma.js";
import { runTransaction } from "../../common/database/transaction.js";
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
  AppError,
} from "../../common/errors/app-error.js";
import { StockMovementType, ProductStatus } from "../../generated/prisma/enums.js";

export interface AdjustStockInput {
  organizationId: string;
  productId: string;
  quantityChange: number;
  movementType: StockMovementType;
  reason: string;
  referenceType?: string | null;
  referenceId?: string | null;
  userId?: string | null;
}

export class InventoryService {
  /**
   * Retrieves overall inventory summary and stock levels for an organization.
   */
  static async getInventoryOverview(
    organizationId: string,
    options?: { lowStockOnly?: boolean; search?: string }
  ) {
    const products = await prisma.product.findMany({
      where: {
        organizationId,
        ...(options?.search && options.search.trim().length > 0
          ? {
              OR: [
                { name: { contains: options.search.trim(), mode: "insensitive" } },
                { sku: { contains: options.search.trim(), mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: {
        inventory: true,
        category: true,
        brand: true,
        unit: true,
      },
      orderBy: { name: "asc" },
    });

    const items = products.map((p) => {
      const currentQuantity = p.inventory?.currentQuantity ?? 0;
      const reservedQuantity = p.inventory?.reservedQuantity ?? 0;
      const reorderLevel = p.reorderLevel;

      let stockStatus: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" = "IN_STOCK";
      if (currentQuantity <= 0) {
        stockStatus = "OUT_OF_STOCK";
      } else if (currentQuantity <= reorderLevel) {
        stockStatus = "LOW_STOCK";
      }

      return {
        productId: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        status: p.status,
        category: p.category?.name ?? null,
        brand: p.brand?.name ?? null,
        unit: p.unit?.name ?? null,
        unitCode: p.unit?.code ?? null,
        costPrice: Number(p.costPrice),
        sellingPrice: Number(p.sellingPrice),
        currentQuantity,
        reservedQuantity,
        availableQuantity: Math.max(0, currentQuantity - reservedQuantity),
        reorderLevel,
        stockStatus,
        inventoryId: p.inventory?.id ?? null,
        updatedAt: p.inventory?.updatedAt ?? p.updatedAt,
      };
    });

    if (options?.lowStockOnly) {
      return items.filter(
        (item) => item.stockStatus === "LOW_STOCK" || item.stockStatus === "OUT_OF_STOCK"
      );
    }

    return items;
  }

  /**
   * Retrieves stock levels and recent movements for a single product.
   */
  static async getProductInventory(organizationId: string, productId: string) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        inventory: true,
        unit: true,
        category: true,
        brand: true,
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

    const currentQuantity = product.inventory?.currentQuantity ?? 0;
    const reservedQuantity = product.inventory?.reservedQuantity ?? 0;

    let stockStatus: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" = "IN_STOCK";
    if (currentQuantity <= 0) {
      stockStatus = "OUT_OF_STOCK";
    } else if (currentQuantity <= product.reorderLevel) {
      stockStatus = "LOW_STOCK";
    }

    return {
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku,
        status: product.status,
        reorderLevel: product.reorderLevel,
        unit: product.unit,
        category: product.category,
        brand: product.brand,
      },
      inventory: {
        id: product.inventory?.id ?? null,
        currentQuantity,
        reservedQuantity,
        availableQuantity: Math.max(0, currentQuantity - reservedQuantity),
        reorderLevel: product.reorderLevel,
        stockStatus,
        updatedAt: product.inventory?.updatedAt ?? product.updatedAt,
      },
    };
  }

  /**
   * Performs an atomic inventory stock adjustment.
   *
   * Transaction Flow:
   * 1. Validates product existence and organization ownership
   * 2. Reads current inventory
   * 3. Calculates resulting quantity (previousQuantity + delta)
   * 4. Enforces negative stock prevention policy (rejects if resulting < 0)
   * 5. Atomically updates inventory and creates an immutable stock movement record
   * 6. Rolls back completely on any failure
   */
  static async adjustStock(input: AdjustStockInput) {
    const {
      organizationId,
      productId,
      quantityChange,
      movementType,
      reason,
      referenceType,
      referenceId,
      userId,
    } = input;

    if (quantityChange === 0) {
      throw new ValidationError("Stock adjustment quantity change cannot be zero");
    }

    return runTransaction(async (tx) => {
      // 1. Fetch product with organization check
      const product = await tx.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new NotFoundError(`Product with ID ${productId} not found`);
      }

      if (product.organizationId !== organizationId) {
        throw new ForbiddenError(
          `Multi-Tenant Isolation Enforced: Product does not belong to organization '${organizationId}'. Access denied.`
        );
      }

      if (product.status === ProductStatus.INACTIVE || product.status === ProductStatus.ARCHIVED) {
        throw new ValidationError(
          `Cannot adjust stock for product '${product.name}' because its status is ${product.status}. Activate product first.`
        );
      }

      // 2. Fetch or initialize inventory
      let inventory = await tx.inventory.findUnique({
        where: { productId },
      });

      if (!inventory) {
        inventory = await tx.inventory.create({
          data: {
            organizationId,
            productId,
            currentQuantity: 0,
            reservedQuantity: 0,
          },
        });
      }

      const previousQuantity = inventory.currentQuantity;
      const resultingQuantity = previousQuantity + quantityChange;

      // 3. Strict Negative Stock Policy Enforcement
      if (resultingQuantity < 0) {
        throw new AppError(
          `Insufficient stock: adjustment of ${quantityChange} would result in negative stock (${resultingQuantity}). Current stock is ${previousQuantity}.`,
          400,
          "INSUFFICIENT_STOCK",
          true,
          {
            productId,
            currentQuantity: previousQuantity,
            quantityChange,
            resultingQuantity,
          }
        );
      }

      // 4. Update Inventory
      const updatedInventory = await tx.inventory.update({
        where: { id: inventory.id },
        data: {
          currentQuantity: resultingQuantity,
        },
      });

      // 5. Create immutable Stock Movement audit entry
      const movement = await tx.stockMovement.create({
        data: {
          organizationId,
          productId,
          quantity: quantityChange,
          movementType,
          previousQuantity,
          resultingQuantity,
          reason: reason.trim(),
          referenceType: referenceType?.trim() || null,
          referenceId: referenceId?.trim() || null,
          createdBy: userId || null,
        },
        include: {
          createdByUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      return {
        inventory: updatedInventory,
        movement,
      };
    });
  }

  /**
   * Retrieves auditable stock movements for a specific product.
   */
  static async getStockMovements(
    organizationId: string,
    productId: string,
    limit = 50
  ) {
    // Validate product ownership
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundError(`Product with ID ${productId} not found`);
    }

    if (product.organizationId !== organizationId) {
      throw new ForbiddenError(
        `Multi-Tenant Isolation Enforced: Product does not belong to organization '${organizationId}'. Access denied.`
      );
    }

    const movements = await prisma.stockMovement.findMany({
      where: {
        organizationId,
        productId,
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(100, Math.max(1, limit)),
    });

    return {
      productId,
      productName: product.name,
      sku: product.sku,
      movements,
    };
  }
}
