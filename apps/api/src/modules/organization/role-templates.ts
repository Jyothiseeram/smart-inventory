import { BusinessType } from "../../generated/prisma/enums.js";
import { ALL_PERMISSIONS } from "../../common/permissions.js";

export interface RoleTemplate {
  name: string;
  description: string;
  isSystem?: boolean;
  permissions: string[];
}

const ALL_PERMISSION_NAMES = ALL_PERMISSIONS.map((p) => p.name);

export const OWNER_ROLE_TEMPLATE: RoleTemplate = {
  name: "Owner",
  description: "Organization owner with full access across all modules and administration",
  isSystem: true,
  permissions: [...ALL_PERMISSION_NAMES],
};

export const BUSINESS_TYPE_ROLE_TEMPLATES: Record<BusinessType, RoleTemplate[]> = {
  MEDICAL: [
    OWNER_ROLE_TEMPLATE,
    {
      name: "Pharmacist",
      description: "Licensed pharmacist dispensing medications, managing stock and reviewing sales",
      permissions: [
        "PRODUCT_VIEW",
        "PRODUCT_UPDATE",
        "STOCK_VIEW",
        "STOCK_UPDATE",
        "STOCK_ADJUST",
        "SALE_VIEW",
        "SALE_CREATE",
        "SALE_UPDATE",
        "SUPPLIER_VIEW",
        "REPORT_VIEW",
      ],
    },
    {
      name: "Billing Staff",
      description: "Front desk billing representative handling customer checkout and sales",
      permissions: [
        "PRODUCT_VIEW",
        "STOCK_VIEW",
        "SALE_VIEW",
        "SALE_CREATE",
        "SALE_UPDATE",
      ],
    },
    {
      name: "Inventory Staff",
      description: "Warehouse and stockroom staff managing pharmaceutical stock and supplier receipts",
      permissions: [
        "PRODUCT_VIEW",
        "PRODUCT_CREATE",
        "PRODUCT_UPDATE",
        "STOCK_VIEW",
        "STOCK_UPDATE",
        "STOCK_ADJUST",
        "SUPPLIER_VIEW",
        "SUPPLIER_CREATE",
        "SUPPLIER_UPDATE",
      ],
    },
  ],

  FURNITURE: [
    OWNER_ROLE_TEMPLATE,
    {
      name: "Store Manager",
      description: "Showroom manager managing inventory, custom sales orders, and sales staff",
      permissions: [
        "PRODUCT_VIEW",
        "PRODUCT_CREATE",
        "PRODUCT_UPDATE",
        "STOCK_VIEW",
        "STOCK_UPDATE",
        "STOCK_ADJUST",
        "SALE_VIEW",
        "SALE_CREATE",
        "SALE_UPDATE",
        "SALE_CANCEL",
        "SUPPLIER_VIEW",
        "SUPPLIER_CREATE",
        "SUPPLIER_UPDATE",
        "EMPLOYEE_VIEW",
        "EMPLOYEE_INVITE",
        "REPORT_VIEW",
      ],
    },
    {
      name: "Sales Staff",
      description: "Sales representative creating customer quotes and sales transactions",
      permissions: [
        "PRODUCT_VIEW",
        "STOCK_VIEW",
        "SALE_VIEW",
        "SALE_CREATE",
        "SALE_UPDATE",
      ],
    },
    {
      name: "Inventory Staff",
      description: "Warehouse lead handling heavy furniture intake and stock updates",
      permissions: [
        "PRODUCT_VIEW",
        "PRODUCT_CREATE",
        "PRODUCT_UPDATE",
        "STOCK_VIEW",
        "STOCK_UPDATE",
        "STOCK_ADJUST",
        "SUPPLIER_VIEW",
      ],
    },
    {
      name: "Delivery Staff",
      description: "Logistics coordinator verifying dispatched orders and stock status",
      permissions: ["PRODUCT_VIEW", "STOCK_VIEW", "SALE_VIEW"],
    },
  ],

  ELECTRONICS: [
    OWNER_ROLE_TEMPLATE,
    {
      name: "Store Manager",
      description: "Manager overseeing retail operations, sales staff, and technician team",
      permissions: [
        "PRODUCT_VIEW",
        "PRODUCT_CREATE",
        "PRODUCT_UPDATE",
        "STOCK_VIEW",
        "STOCK_UPDATE",
        "STOCK_ADJUST",
        "SALE_VIEW",
        "SALE_CREATE",
        "SALE_UPDATE",
        "SALE_CANCEL",
        "SUPPLIER_VIEW",
        "SUPPLIER_CREATE",
        "SUPPLIER_UPDATE",
        "EMPLOYEE_VIEW",
        "EMPLOYEE_INVITE",
        "REPORT_VIEW",
      ],
    },
    {
      name: "Sales Staff",
      description: "Retail sales executive selling electronics and warranties",
      permissions: [
        "PRODUCT_VIEW",
        "STOCK_VIEW",
        "SALE_VIEW",
        "SALE_CREATE",
      ],
    },
    {
      name: "Technician",
      description: "Technical specialist handling repairs, testing, and component stock adjustments",
      permissions: [
        "PRODUCT_VIEW",
        "STOCK_VIEW",
        "STOCK_UPDATE",
        "STOCK_ADJUST",
      ],
    },
    {
      name: "Inventory Staff",
      description: "Stock clerk maintaining serialized inventory and supplier shipments",
      permissions: [
        "PRODUCT_VIEW",
        "PRODUCT_CREATE",
        "PRODUCT_UPDATE",
        "STOCK_VIEW",
        "STOCK_UPDATE",
        "STOCK_ADJUST",
        "SUPPLIER_VIEW",
      ],
    },
  ],

  FASHION: [
    OWNER_ROLE_TEMPLATE,
    {
      name: "Store Manager",
      description: "Fashion boutique manager overseeing collections, sales, and team",
      permissions: [
        "PRODUCT_VIEW",
        "PRODUCT_CREATE",
        "PRODUCT_UPDATE",
        "STOCK_VIEW",
        "STOCK_UPDATE",
        "STOCK_ADJUST",
        "SALE_VIEW",
        "SALE_CREATE",
        "SALE_UPDATE",
        "SALE_CANCEL",
        "SUPPLIER_VIEW",
        "SUPPLIER_CREATE",
        "SUPPLIER_UPDATE",
        "EMPLOYEE_VIEW",
        "REPORT_VIEW",
      ],
    },
    {
      name: "Sales Staff",
      description: "Sales assistant handling customer purchases and fittings",
      permissions: [
        "PRODUCT_VIEW",
        "STOCK_VIEW",
        "SALE_VIEW",
        "SALE_CREATE",
      ],
    },
    {
      name: "Inventory Staff",
      description: "Stockroom associate handling apparel sizes, variants, and intake",
      permissions: [
        "PRODUCT_VIEW",
        "PRODUCT_CREATE",
        "PRODUCT_UPDATE",
        "STOCK_VIEW",
        "STOCK_UPDATE",
        "STOCK_ADJUST",
      ],
    },
  ],

  GENERAL: [
    OWNER_ROLE_TEMPLATE,
    {
      name: "Manager",
      description: "General retail manager overseeing operations",
      permissions: [
        "PRODUCT_VIEW",
        "PRODUCT_CREATE",
        "PRODUCT_UPDATE",
        "STOCK_VIEW",
        "STOCK_UPDATE",
        "STOCK_ADJUST",
        "SALE_VIEW",
        "SALE_CREATE",
        "SALE_UPDATE",
        "SALE_CANCEL",
        "SUPPLIER_VIEW",
        "SUPPLIER_CREATE",
        "SUPPLIER_UPDATE",
        "EMPLOYEE_VIEW",
        "REPORT_VIEW",
      ],
    },
    {
      name: "Sales Staff",
      description: "Sales representative handling point-of-sale transactions",
      permissions: [
        "PRODUCT_VIEW",
        "STOCK_VIEW",
        "SALE_VIEW",
        "SALE_CREATE",
      ],
    },
    {
      name: "Inventory Staff",
      description: "Stock coordinator tracking merchandise and count corrections",
      permissions: [
        "PRODUCT_VIEW",
        "PRODUCT_CREATE",
        "PRODUCT_UPDATE",
        "STOCK_VIEW",
        "STOCK_UPDATE",
        "STOCK_ADJUST",
        "SUPPLIER_VIEW",
        "SUPPLIER_CREATE",
      ],
    },
  ],

  OTHER: [
    OWNER_ROLE_TEMPLATE,
    {
      name: "Manager",
      description: "Business manager overseeing day-to-day operations",
      permissions: [
        "PRODUCT_VIEW",
        "PRODUCT_CREATE",
        "PRODUCT_UPDATE",
        "STOCK_VIEW",
        "STOCK_UPDATE",
        "STOCK_ADJUST",
        "SALE_VIEW",
        "SALE_CREATE",
        "SALE_UPDATE",
        "SALE_CANCEL",
        "SUPPLIER_VIEW",
        "SUPPLIER_CREATE",
        "SUPPLIER_UPDATE",
        "EMPLOYEE_VIEW",
        "REPORT_VIEW",
      ],
    },
    {
      name: "Sales Staff",
      description: "Sales representative handling customer sales",
      permissions: [
        "PRODUCT_VIEW",
        "STOCK_VIEW",
        "SALE_VIEW",
        "SALE_CREATE",
      ],
    },
    {
      name: "Inventory Staff",
      description: "Inventory clerk handling stock intake and updates",
      permissions: [
        "PRODUCT_VIEW",
        "PRODUCT_CREATE",
        "PRODUCT_UPDATE",
        "STOCK_VIEW",
        "STOCK_UPDATE",
        "STOCK_ADJUST",
        "SUPPLIER_VIEW",
        "SUPPLIER_CREATE",
      ],
    },
  ],
};

export function getRoleTemplatesForBusinessType(businessType: BusinessType): RoleTemplate[] {
  return BUSINESS_TYPE_ROLE_TEMPLATES[businessType] || BUSINESS_TYPE_ROLE_TEMPLATES.GENERAL;
}
