import { Router } from "express";
import config from "../config/index.js";
import authRoutes from "./auth.routes.js";
import organizationRoutes from "./organization.routes.js";
import roleRoutes from "./role.routes.js";
import employeeRoutes from "./employee.routes.js";
import authorizationRoutes from "./authorization.routes.js";
import foundationTestRoutes from "./foundation-test.routes.js";

import productRoutes from "./product.routes.js";
import { categoryRouter, brandRouter, unitRouter } from "./classification.routes.js";
import inventoryRoutes from "./inventory.routes.js";
import supplierRoutes from "./supplier.routes.js";

const apiRouter = Router();

apiRouter.use("/auth", authRoutes);
apiRouter.use("/organizations/:orgId/roles", roleRoutes);
apiRouter.use("/organizations/:orgId/employees", employeeRoutes);
apiRouter.use("/organizations/:orgId/authorization", authorizationRoutes);
apiRouter.use("/organizations", organizationRoutes);

// Phase 3 — Product Catalogue & Inventory
apiRouter.use("/products", productRoutes);
apiRouter.use("/categories", categoryRouter);
apiRouter.use("/brands", brandRouter);
apiRouter.use("/units", unitRouter);
apiRouter.use("/inventory", inventoryRoutes);

// Phase 4A — Supplier Master Catalogue
apiRouter.use("/suppliers", supplierRoutes);

// Also route param scoped compatibility
apiRouter.use("/organizations/:orgId/products", productRoutes);
apiRouter.use("/organizations/:orgId/categories", categoryRouter);
apiRouter.use("/organizations/:orgId/brands", brandRouter);
apiRouter.use("/organizations/:orgId/units", unitRouter);
apiRouter.use("/organizations/:orgId/inventory", inventoryRoutes);
apiRouter.use("/organizations/:orgId/suppliers", supplierRoutes);

// Foundation infrastructure testing endpoints (enabled in dev and test)
if (config.NODE_ENV !== "production") {
  apiRouter.use("/foundation-test", foundationTestRoutes);
}

export default apiRouter;
