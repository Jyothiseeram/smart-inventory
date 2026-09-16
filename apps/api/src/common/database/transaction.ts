import { prisma } from "../../infrastructure/prisma.js";
import { logger } from "../logger/logger.js";
import { DatabaseError } from "../errors/app-error.js";

export type TransactionCallback<T> = Parameters<typeof prisma.$transaction>[0] extends (
  tx: infer Tx
) => Promise<T>
  ? (tx: Tx) => Promise<T>
  : (tx: any) => Promise<T>;

export interface TransactionOptions {
  maxWait?: number;
  timeout?: number;
  isolationLevel?: "ReadUncommitted" | "ReadCommitted" | "RepeatableRead" | "Serializable";
}

/**
 * Standard database transaction wrapper.
 * Guarantees atomicity across multi-entity database mutations with structured error logging.
 */
export async function runTransaction<T>(
  action: (tx: any) => Promise<T>,
  options?: TransactionOptions
): Promise<T> {
  const start = process.hrtime.bigint();

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        return await action(tx);
      },
      {
        maxWait: options?.maxWait ?? 5000,
        timeout: options?.timeout ?? 10000,
        isolationLevel: options?.isolationLevel,
      }
    );

    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    logger.debug(`Database transaction completed in ${durationMs.toFixed(2)}ms`);
    return result;
  } catch (error: any) {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    logger.error(`Database transaction aborted after ${durationMs.toFixed(2)}ms: ${error.message}`, {
      errorStack: error.stack,
    });

    // Re-throw if it's already an application error or let centralized error handler map it
    if (error.statusCode) {
      throw error;
    }

    throw new DatabaseError(
      error.message || "Transaction failed and was rolled back",
      undefined,
      error.code || "TRANSACTION_FAILED"
    );
  }
}
