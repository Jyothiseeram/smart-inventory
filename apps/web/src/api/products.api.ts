import { apiRequest } from "./client";

export interface Category {
  id: string;
  organizationId: string;
  name: string;
  description?: string | null;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
  _count?: { products: number };
}

export interface Brand {
  id: string;
  organizationId: string;
  name: string;
  description?: string | null;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
  _count?: { products: number };
}

export interface Unit {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  description?: string | null;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
  _count?: { products: number };
}

export interface Inventory {
  id: string;
  organizationId: string;
  productId: string;
  currentQuantity: number;
  reservedQuantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  organizationId: string;
  name: string;
  description?: string | null;
  sku: string;
  barcode?: string | null;
  categoryId?: string | null;
  brandId?: string | null;
  unitId?: string | null;
  costPrice: number | string;
  sellingPrice: number | string;
  reorderLevel: number;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
  category?: Category | null;
  brand?: Brand | null;
  unit?: Unit | null;
  inventory?: Inventory | null;
}

export interface StockMovement {
  id: string;
  organizationId: string;
  productId: string;
  quantity: number;
  movementType: "OPENING_STOCK" | "ADJUSTMENT" | "PURCHASE" | "SALE" | "RETURN" | "DAMAGE";
  previousQuantity: number;
  resultingQuantity: number;
  reason: string;
  referenceType?: string | null;
  referenceId?: string | null;
  createdBy?: string | null;
  createdAt: string;
  createdByUser?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface InventoryOverviewItem {
  productId: string;
  name: string;
  sku: string;
  barcode?: string | null;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  category?: string | null;
  brand?: string | null;
  unit?: string | null;
  unitCode?: string | null;
  costPrice: number;
  sellingPrice: number;
  currentQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  reorderLevel: number;
  stockStatus: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  inventoryId?: string | null;
  updatedAt: string;
}

export interface ProductsResponse {
  success: boolean;
  data: Product[];
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const productsApi = {
  // Products
  async getProducts(params?: {
    search?: string;
    categoryId?: string;
    brandId?: string;
    unitId?: string;
    status?: string;
    lowStock?: boolean;
    page?: number;
    limit?: number;
  }): Promise<ProductsResponse> {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.categoryId) query.set("categoryId", params.categoryId);
    if (params?.brandId) query.set("brandId", params.brandId);
    if (params?.unitId) query.set("unitId", params.unitId);
    if (params?.status) query.set("status", params.status);
    if (params?.lowStock) query.set("lowStock", "true");
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));

    const qs = query.toString();
    return apiRequest<ProductsResponse>(`/api/v1/products${qs ? `?${qs}` : ""}`);
  },

  async getProduct(id: string): Promise<{ success: boolean; data: Product }> {
    return apiRequest<{ success: boolean; data: Product }>(`/api/v1/products/${id}`);
  },

  async createProduct(data: {
    name: string;
    description?: string;
    sku: string;
    barcode?: string;
    categoryId?: string | null;
    brandId?: string | null;
    unitId?: string | null;
    costPrice?: number;
    sellingPrice?: number;
    reorderLevel?: number;
    initialStock?: number;
  }): Promise<{ success: boolean; data: Product; message: string }> {
    return apiRequest<{ success: boolean; data: Product; message: string }>("/api/v1/products", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateProduct(
    id: string,
    data: {
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
      status?: "ACTIVE" | "INACTIVE" | "ARCHIVED";
    }
  ): Promise<{ success: boolean; data: Product; message: string }> {
    return apiRequest<{ success: boolean; data: Product; message: string }>(`/api/v1/products/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async deleteProduct(id: string): Promise<{ success: boolean; message: string; data: unknown }> {
    return apiRequest<{ success: boolean; message: string; data: unknown }>(`/api/v1/products/${id}`, {
      method: "DELETE",
    });
  },

  // Categories
  async getCategories(): Promise<{ success: boolean; data: Category[] }> {
    return apiRequest<{ success: boolean; data: Category[] }>("/api/v1/categories");
  },

  async createCategory(data: {
    name: string;
    description?: string;
    status?: "ACTIVE" | "INACTIVE";
  }): Promise<{ success: boolean; data: Category; message: string }> {
    return apiRequest<{ success: boolean; data: Category; message: string }>("/api/v1/categories", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateCategory(
    id: string,
    data: { name?: string; description?: string | null; status?: "ACTIVE" | "INACTIVE" }
  ): Promise<{ success: boolean; data: Category; message: string }> {
    return apiRequest<{ success: boolean; data: Category; message: string }>(`/api/v1/categories/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async deleteCategory(id: string): Promise<{ success: boolean; message: string }> {
    return apiRequest<{ success: boolean; message: string }>(`/api/v1/categories/${id}`, {
      method: "DELETE",
    });
  },

  // Brands
  async getBrands(): Promise<{ success: boolean; data: Brand[] }> {
    return apiRequest<{ success: boolean; data: Brand[] }>("/api/v1/brands");
  },

  async createBrand(data: {
    name: string;
    description?: string;
    status?: "ACTIVE" | "INACTIVE";
  }): Promise<{ success: boolean; data: Brand; message: string }> {
    return apiRequest<{ success: boolean; data: Brand; message: string }>("/api/v1/brands", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateBrand(
    id: string,
    data: { name?: string; description?: string | null; status?: "ACTIVE" | "INACTIVE" }
  ): Promise<{ success: boolean; data: Brand; message: string }> {
    return apiRequest<{ success: boolean; data: Brand; message: string }>(`/api/v1/brands/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async deleteBrand(id: string): Promise<{ success: boolean; message: string }> {
    return apiRequest<{ success: boolean; message: string }>(`/api/v1/brands/${id}`, {
      method: "DELETE",
    });
  },

  // Units
  async getUnits(): Promise<{ success: boolean; data: Unit[] }> {
    return apiRequest<{ success: boolean; data: Unit[] }>("/api/v1/units");
  },

  async createUnit(data: {
    name: string;
    code: string;
    description?: string;
    status?: "ACTIVE" | "INACTIVE";
  }): Promise<{ success: boolean; data: Unit; message: string }> {
    return apiRequest<{ success: boolean; data: Unit; message: string }>("/api/v1/units", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateUnit(
    id: string,
    data: { name?: string; code?: string; description?: string | null; status?: "ACTIVE" | "INACTIVE" }
  ): Promise<{ success: boolean; data: Unit; message: string }> {
    return apiRequest<{ success: boolean; data: Unit; message: string }>(`/api/v1/units/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async deleteUnit(id: string): Promise<{ success: boolean; message: string }> {
    return apiRequest<{ success: boolean; message: string }>(`/api/v1/units/${id}`, {
      method: "DELETE",
    });
  },

  // Inventory
  async getInventory(params?: {
    lowStock?: boolean;
    search?: string;
  }): Promise<{ success: boolean; data: InventoryOverviewItem[] }> {
    const query = new URLSearchParams();
    if (params?.lowStock) query.set("lowStock", "true");
    if (params?.search) query.set("search", params.search);

    const qs = query.toString();
    return apiRequest<{ success: boolean; data: InventoryOverviewItem[] }>(
      `/api/v1/inventory${qs ? `?${qs}` : ""}`
    );
  },

  async getProductInventory(productId: string): Promise<{
    success: boolean;
    data: {
      product: Partial<Product>;
      inventory: Partial<Inventory> & { availableQuantity: number; stockStatus: string };
    };
  }> {
    return apiRequest(`/api/v1/inventory/${productId}`);
  },

  async adjustStock(
    productId: string,
    data: {
      quantity: number;
      movementType: "ADJUSTMENT" | "DAMAGE" | "RETURN" | "PURCHASE" | "SALE" | "OPENING_STOCK";
      reason: string;
      referenceType?: string;
      referenceId?: string;
    }
  ): Promise<{
    success: boolean;
    data: {
      inventory: Inventory;
      movement: StockMovement;
    };
    message: string;
  }> {
    return apiRequest(`/api/v1/inventory/${productId}/adjust`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async getStockMovements(productId: string): Promise<{
    success: boolean;
    data: {
      productId: string;
      productName: string;
      sku: string;
      movements: StockMovement[];
    };
  }> {
    return apiRequest(`/api/v1/inventory/${productId}/movements`);
  },
};
