export const ALL_PERMISSIONS = [
  // Products
  { name: "PRODUCT_VIEW", description: "Can view product catalogue and details" },
  { name: "PRODUCT_CREATE", description: "Can create new products" },
  { name: "PRODUCT_UPDATE", description: "Can update product information and pricing" },
  { name: "PRODUCT_DELETE", description: "Can delete products from catalogue" },

  // Stock / Inventory
  { name: "STOCK_VIEW", description: "Can view current inventory stock levels" },
  { name: "STOCK_UPDATE", description: "Can update inventory stock quantities" },
  { name: "STOCK_ADJUST", description: "Can perform inventory adjustments and audits" },

  // Sales
  { name: "SALE_VIEW", description: "Can view sales orders and transaction history" },
  { name: "SALE_CREATE", description: "Can record and create new sales transactions" },
  { name: "SALE_UPDATE", description: "Can update existing sales orders" },
  { name: "SALE_CANCEL", description: "Can cancel sales orders and issue refunds" },

  // Suppliers
  { name: "SUPPLIER_VIEW", description: "Can view supplier information and catalogue" },
  { name: "SUPPLIER_CREATE", description: "Can create and onboard new suppliers" },
  { name: "SUPPLIER_UPDATE", description: "Can update supplier profiles and details" },

  // Employees & Team
  { name: "EMPLOYEE_VIEW", description: "Can view organization members and employees" },
  { name: "EMPLOYEE_CREATE", description: "Can directly register new employees" },
  { name: "EMPLOYEE_INVITE", description: "Can issue invitations for new employees" },
  { name: "EMPLOYEE_UPDATE", description: "Can update employee roles and statuses" },
  { name: "EMPLOYEE_REMOVE", description: "Can remove or deactivate employees" },

  // Reporting
  { name: "REPORT_VIEW", description: "Can view business analytics, financial, and inventory reports" },

  // Settings & Organization Administration
  { name: "SETTINGS_VIEW", description: "Can view organization settings" },
  { name: "SETTINGS_UPDATE", description: "Can modify organization settings" },
  { name: "ORGANIZATION_MANAGE", description: "Can manage organization profile and custom roles" },
] as const;

export type PermissionName = (typeof ALL_PERMISSIONS)[number]["name"];
