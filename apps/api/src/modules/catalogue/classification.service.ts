import { prisma } from "../../infrastructure/prisma.js";
import { NotFoundError, ConflictError, ForbiddenError } from "../../common/errors/app-error.js";
import { CategoryStatus, BrandStatus, UnitStatus } from "../../generated/prisma/enums.js";

export class ClassificationService {
  // ---------------------------------------------------------------------------
  // CATEGORIES
  // ---------------------------------------------------------------------------

  static async listCategories(organizationId: string) {
    return prisma.category.findMany({
      where: { organizationId },
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: { name: "asc" },
    });
  }

  static async getCategoryById(organizationId: string, id: string) {
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundError(`Category with ID ${id} not found`);
    }

    if (category.organizationId !== organizationId) {
      throw new ForbiddenError(
        `Multi-Tenant Isolation Enforced: Category does not belong to organization '${organizationId}'. Access denied.`
      );
    }

    return category;
  }

  static async createCategory(
    organizationId: string,
    data: { name: string; description?: string; status?: CategoryStatus }
  ) {
    const existing = await prisma.category.findUnique({
      where: {
        organizationId_name: {
          organizationId,
          name: data.name.trim(),
        },
      },
    });

    if (existing) {
      throw new ConflictError(
        `A category named '${data.name.trim()}' already exists in this organization`
      );
    }

    return prisma.category.create({
      data: {
        organizationId,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        status: data.status || CategoryStatus.ACTIVE,
      },
    });
  }

  static async updateCategory(
    organizationId: string,
    id: string,
    data: { name?: string; description?: string | null; status?: CategoryStatus }
  ) {
    await this.getCategoryById(organizationId, id);

    if (data.name) {
      const existing = await prisma.category.findUnique({
        where: {
          organizationId_name: {
            organizationId,
            name: data.name.trim(),
          },
        },
      });

      if (existing && existing.id !== id) {
        throw new ConflictError(
          `A category named '${data.name.trim()}' already exists in this organization`
        );
      }
    }

    return prisma.category.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
        ...(data.status ? { status: data.status } : {}),
      },
    });
  }

  static async deleteCategory(organizationId: string, id: string) {
    await this.getCategoryById(organizationId, id);

    return prisma.category.delete({
      where: { id },
    });
  }

  // ---------------------------------------------------------------------------
  // BRANDS
  // ---------------------------------------------------------------------------

  static async listBrands(organizationId: string) {
    return prisma.brand.findMany({
      where: { organizationId },
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: { name: "asc" },
    });
  }

  static async getBrandById(organizationId: string, id: string) {
    const brand = await prisma.brand.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!brand) {
      throw new NotFoundError(`Brand with ID ${id} not found`);
    }

    if (brand.organizationId !== organizationId) {
      throw new ForbiddenError(
        `Multi-Tenant Isolation Enforced: Brand does not belong to organization '${organizationId}'. Access denied.`
      );
    }

    return brand;
  }

  static async createBrand(
    organizationId: string,
    data: { name: string; description?: string; status?: BrandStatus }
  ) {
    const existing = await prisma.brand.findUnique({
      where: {
        organizationId_name: {
          organizationId,
          name: data.name.trim(),
        },
      },
    });

    if (existing) {
      throw new ConflictError(
        `A brand named '${data.name.trim()}' already exists in this organization`
      );
    }

    return prisma.brand.create({
      data: {
        organizationId,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        status: data.status || BrandStatus.ACTIVE,
      },
    });
  }

  static async updateBrand(
    organizationId: string,
    id: string,
    data: { name?: string; description?: string | null; status?: BrandStatus }
  ) {
    await this.getBrandById(organizationId, id);

    if (data.name) {
      const existing = await prisma.brand.findUnique({
        where: {
          organizationId_name: {
            organizationId,
            name: data.name.trim(),
          },
        },
      });

      if (existing && existing.id !== id) {
        throw new ConflictError(
          `A brand named '${data.name.trim()}' already exists in this organization`
        );
      }
    }

    return prisma.brand.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
        ...(data.status ? { status: data.status } : {}),
      },
    });
  }

  static async deleteBrand(organizationId: string, id: string) {
    await this.getBrandById(organizationId, id);

    return prisma.brand.delete({
      where: { id },
    });
  }

  // ---------------------------------------------------------------------------
  // UNITS OF MEASURE
  // ---------------------------------------------------------------------------

  static async listUnits(organizationId: string) {
    return prisma.unit.findMany({
      where: { organizationId },
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: { name: "asc" },
    });
  }

  static async getUnitById(organizationId: string, id: string) {
    const unit = await prisma.unit.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!unit) {
      throw new NotFoundError(`Unit with ID ${id} not found`);
    }

    if (unit.organizationId !== organizationId) {
      throw new ForbiddenError(
        `Multi-Tenant Isolation Enforced: Unit does not belong to organization '${organizationId}'. Access denied.`
      );
    }

    return unit;
  }

  static async createUnit(
    organizationId: string,
    data: { name: string; code: string; description?: string; status?: UnitStatus }
  ) {
    const existingName = await prisma.unit.findUnique({
      where: {
        organizationId_name: {
          organizationId,
          name: data.name.trim(),
        },
      },
    });

    if (existingName) {
      throw new ConflictError(
        `A unit named '${data.name.trim()}' already exists in this organization`
      );
    }

    const existingCode = await prisma.unit.findUnique({
      where: {
        organizationId_code: {
          organizationId,
          code: data.code.trim().toLowerCase(),
        },
      },
    });

    if (existingCode) {
      throw new ConflictError(
        `A unit with code '${data.code.trim().toLowerCase()}' already exists in this organization`
      );
    }

    return prisma.unit.create({
      data: {
        organizationId,
        name: data.name.trim(),
        code: data.code.trim().toLowerCase(),
        description: data.description?.trim() || null,
        status: data.status || UnitStatus.ACTIVE,
      },
    });
  }

  static async updateUnit(
    organizationId: string,
    id: string,
    data: { name?: string; code?: string; description?: string | null; status?: UnitStatus }
  ) {
    await this.getUnitById(organizationId, id);

    if (data.name) {
      const existing = await prisma.unit.findUnique({
        where: {
          organizationId_name: {
            organizationId,
            name: data.name.trim(),
          },
        },
      });

      if (existing && existing.id !== id) {
        throw new ConflictError(
          `A unit named '${data.name.trim()}' already exists in this organization`
        );
      }
    }

    if (data.code) {
      const existing = await prisma.unit.findUnique({
        where: {
          organizationId_code: {
            organizationId,
            code: data.code.trim().toLowerCase(),
          },
        },
      });

      if (existing && existing.id !== id) {
        throw new ConflictError(
          `A unit with code '${data.code.trim().toLowerCase()}' already exists in this organization`
        );
      }
    }

    return prisma.unit.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.code ? { code: data.code.trim().toLowerCase() } : {}),
        ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
        ...(data.status ? { status: data.status } : {}),
      },
    });
  }

  static async deleteUnit(organizationId: string, id: string) {
    await this.getUnitById(organizationId, id);

    return prisma.unit.delete({
      where: { id },
    });
  }
}
