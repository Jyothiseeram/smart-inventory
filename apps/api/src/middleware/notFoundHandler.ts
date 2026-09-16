import type { Request, Response, NextFunction } from "express";
import { NotFoundError } from "../common/errors/app-error.js";

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new NotFoundError(`Cannot ${req.method} ${req.originalUrl}`));
}

export default notFoundHandler;
