import { apiRequest } from "./client";

export interface Supplier {
  id: string;
  organizationId: string;
  name: string;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  taxId?: string | null;
  notes?: string | null;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
}

export interface SuppliersMetrics {
  total: number;
  active: number;
  inactive: number;
}

export interface SuppliersResponse {
  success: boolean;
  data: Supplier[];
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  metrics?: SuppliersMetrics;
}

export interface CreateSupplierDto {
  name: string;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  taxId?: string | null;
  notes?: string | null;
  status?: "ACTIVE" | "INACTIVE";
}

export interface UpdateSupplierDto {
  name?: string;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  taxId?: string | null;
  notes?: string | null;
  status?: "ACTIVE" | "INACTIVE";
}

export const suppliersApi = {
  async getSuppliers(params?: {
    search?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<SuppliersResponse> {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.status) query.set("status", params.status);
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));

    const qs = query.toString();
    return apiRequest<SuppliersResponse>(`/api/v1/suppliers${qs ? `?${qs}` : ""}`);
  },

  async getSupplier(id: string): Promise<{ success: boolean; data: Supplier }> {
    return apiRequest<{ success: boolean; data: Supplier }>(`/api/v1/suppliers/${id}`);
  },

  async createSupplier(
    data: CreateSupplierDto
  ): Promise<{ success: boolean; data: Supplier; message?: string }> {
    return apiRequest<{ success: boolean; data: Supplier; message?: string }>("/api/v1/suppliers", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateSupplier(
    id: string,
    data: UpdateSupplierDto
  ): Promise<{ success: boolean; data: Supplier; message?: string }> {
    return apiRequest<{ success: boolean; data: Supplier; message?: string }>(
      `/api/v1/suppliers/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify(data),
      }
    );
  },

  async deleteSupplier(
    id: string
  ): Promise<{ success: boolean; data: { action: string; message: string }; message?: string }> {
    return apiRequest<{ success: boolean; data: { action: string; message: string }; message?: string }>(
      `/api/v1/suppliers/${id}`,
      {
        method: "DELETE",
      }
    );
  },
};
