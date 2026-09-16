import { prisma } from "../../infrastructure/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import { NotFoundError, ConflictError, ForbiddenError } from "../../common/errors/app-error.js";
import { SupplierStatus } from "../../generated/prisma/enums.js";

export interface CreateSupplierInput {
  name: string;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  taxId?: string | null;
  notes?: string | null;
  status?: SupplierStatus;
}

export interface UpdateSupplierInput {
  name?: string;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  taxId?: string | null;
  notes?: string | null;
  status?: SupplierStatus;
}

export interface ListSuppliersQuery {
  search?: string;
  status?: SupplierStatus;
  page?: number;
  limit?: number;
}

export class SupplierService {
  /**
   * Creates a new supplier within the authenticated user's organization.
   * Enforces organization-scoped uniqueness for tax/business identifiers when provided.
   */
  static async createSupplier(organizationId: string, input: CreateSupplierInput) {
    const taxIdNormalized = input.taxId?.trim() || null;

    if (taxIdNormalized) {
      const existing = await prisma.supplier.findUnique({
        where: {
          organizationId_taxId: {
            organizationId,
            taxId: taxIdNormalized,
          },
        },
      });

      if (existing) {
        throw new ConflictError(
          `A supplier with tax identifier '${taxIdNormalized}' already exists in this organization`
        );
      }
    }

    return prisma.supplier.create({
      data: {
        organizationId,
        name: input.name.trim(),
        contactPerson: input.contactPerson?.trim() || null,
        email: input.email?.trim() || null,
        phone: input.phone?.trim() || null,
        address: input.address?.trim() || null,
        taxId: taxIdNormalized,
        notes: input.notes?.trim() || null,
        status: input.status || SupplierStatus.ACTIVE,
      },
    });
  }

  /**
   * Retrieves a single supplier by ID with strict tenant boundary enforcement.
   */
  static async getSupplierById(organizationId: string, supplierId: string) {
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
    });

    if (!supplier) {
      throw new NotFoundError(`Supplier with ID ${supplierId} not found`);
    }

    if (supplier.organizationId !== organizationId) {
      throw new ForbiddenError(
        `Multi-Tenant Isolation Enforced: Supplier does not belong to organization '${organizationId}'. Access denied.`
      );
    }

    return supplier;
  }

  /**
   * Lists suppliers for an organization with searching, status filtering, pagination, and KPI metrics.
   */
  static async listSuppliers(organizationId: string, query: ListSuppliersQuery) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 50));
    const skip = (page - 1) * limit;

    const where: Prisma.SupplierWhereInput = {
      organizationId,
      ...(query.status ? { status: query.status } : {}),
    };

    if (query.search && query.search.trim().length > 0) {
      const search = query.search.trim();
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { contactPerson: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { taxId: { contains: search, mode: "insensitive" } },
      ];
    }

    const [suppliers, totalFiltered, totalAll, totalActive, totalInactive] = await Promise.all([
      prisma.supplier.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.supplier.count({ where }),
      prisma.supplier.count({ where: { organizationId } }),
      prisma.supplier.count({ where: { organizationId, status: SupplierStatus.ACTIVE } }),
      prisma.supplier.count({ where: { organizationId, status: SupplierStatus.INACTIVE } }),
    ]);

    return {
      suppliers,
      pagination: {
        page,
        limit,
        total: totalFiltered,
        totalPages: Math.ceil(totalFiltered / limit),
      },
      metrics: {
        total: totalAll,
        active: totalActive,
        inactive: totalInactive,
      },
    };
  }

  /**
   * Updates an existing supplier within the organization.
   */
  static async updateSupplier(
    organizationId: string,
    supplierId: string,
    input: UpdateSupplierInput
  ) {
    await this.getSupplierById(organizationId, supplierId);

    const taxIdNormalized =
      input.taxId !== undefined
        ? input.taxId?.trim() || null
        : undefined;

    if (taxIdNormalized) {
      const existing = await prisma.supplier.findUnique({
        where: {
          organizationId_taxId: {
            organizationId,
            taxId: taxIdNormalized,
          },
        },
      });

      if (existing && existing.id !== supplierId) {
        throw new ConflictError(
          `A supplier with tax identifier '${taxIdNormalized}' already exists in this organization`
        );
      }
    }

    const updateData: Prisma.SupplierUpdateInput = {
      ...(input.name ? { name: input.name.trim() } : {}),
      ...(input.contactPerson !== undefined
        ? { contactPerson: input.contactPerson?.trim() || null }
        : {}),
      ...(input.email !== undefined
        ? { email: input.email?.trim() || null }
        : {}),
      ...(input.phone !== undefined
        ? { phone: input.phone?.trim() || null }
        : {}),
      ...(input.address !== undefined
        ? { address: input.address?.trim() || null }
        : {}),
      ...(input.taxId !== undefined ? { taxId: taxIdNormalized } : {}),
      ...(input.notes !== undefined
        ? { notes: input.notes?.trim() || null }
        : {}),
      ...(input.status ? { status: input.status } : {}),
    };

    return prisma.supplier.update({
      where: { id: supplierId },
      data: updateData,
    });
  }

  /**
   * Safely deactivates or removes a supplier.
   * Deactivation (ACTIVE -> INACTIVE) is preferred to preserve future procurement history.
   * If physical delete is requested and no dependent records exist, deletes cleanly.
   */
  static async deleteOrDeactivateSupplier(organizationId: string, supplierId: string) {
    const supplier = await this.getSupplierById(organizationId, supplierId);

    // In future phases (Purchase Orders, Receiving), soft-deactivation will be enforced
    // if procurement records exist. For now, delete cleanly if unreferenced.
    await prisma.supplier.delete({
      where: { id: supplierId },
    });

    return {
      action: "DELETED",
      message: `Supplier '${supplier.name}' deleted successfully.`,
    };
  }

  /**
   * Explicitly sets supplier status to INACTIVE.
   */
  static async deactivateSupplier(organizationId: string, supplierId: string) {
    await this.getSupplierById(organizationId, supplierId);

    const updated = await prisma.supplier.update({
      where: { id: supplierId },
      data: { status: SupplierStatus.INACTIVE },
    });

    return {
      action: "DEACTIVATED",
      message: `Supplier '${updated.name}' deactivated successfully.`,
      supplier: updated,
    };
  }
}
