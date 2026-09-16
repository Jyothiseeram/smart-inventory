# Error Handling & Response Standards

Smart Inventory enforces a predictable, machine-readable format for all API responses across all current and future business modules.

---

## 1. Standard Success Response Format

Successful responses provide a `success: true` flag and encapsulate the payload in `data`:

```json
{
  "success": true,
  "data": {
    "id": "c88270e5-55a4-4e34-b613-7f33ec13a171",
    "name": "Widget A",
    "sku": "WIDGET-01",
    "price": 19.99
  },
  "message": "Resource retrieved successfully"
}
```

> [!NOTE]
> Phase 1 endpoints also spread top-level keys for 100% backward compatibility with existing clients and test runners.

---

## 2. Standard Error Response Format

Error responses return `success: false` with a typed error object containing a machine-readable `code`, a human-readable `message`, and optional structured `details`:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "price",
        "message": "Price must be positive",
        "code": "too_small"
      }
    ]
  },
  "message": "Request validation failed"
}
```

---

## 3. Application Error Codes & HTTP Mapping

| HTTP Status | Error Code | Error Class | Description |
|:---|:---|:---|:---|
| `400` | `VALIDATION_ERROR` | `ValidationError` | Request body, query, or parameter failed schema validation. |
| `400` | `INVALID_JSON_BODY` | - | Request body contains malformed JSON syntax. |
| `400` | `FOREIGN_KEY_VIOLATION`| - | Referenced foreign key does not exist or violates organization constraint. |
| `401` | `UNAUTHORIZED` | `UnauthorizedError` | Missing, invalid, or expired session token. |
| `403` | `FORBIDDEN` | `ForbiddenError` | Authenticated user lacks required permission or tenant access. |
| `404` | `RESOURCE_NOT_FOUND` | `NotFoundError` | Entity or route does not exist. |
| `409` | `CONFLICT` / `RESOURCE_ALREADY_EXISTS` | `ConflictError` | Unique constraint violation (e.g. email or role name already taken). |
| `413` | `PAYLOAD_TOO_LARGE` | - | Request payload exceeds 1MB limit. |
| `429` | `RATE_LIMIT_EXCEEDED` | `RateLimitError` | Request rate limit exceeded for client IP. |
| `500` | `DATABASE_ERROR` | `DatabaseError` | Safe database failure message (never exposes SQL or credentials). |
| `500` | `INTERNAL_SERVER_ERROR` | `InternalServerError`| Unhandled server exception (masked safely in responses). |
| `503` | `SERVICE_UNAVAILABLE` | - | One or more infrastructure dependencies (PostgreSQL, Redis) are unhealthy. |

---

## 4. Production Security & Masking Guarantee

1. **Stack traces**: Stack traces are logged exclusively to server-side logs with the correlating `requestId`. They are never returned in client API responses.
2. **Database Errors**: Prisma error codes (`P2002`, `P2003`, `P2025`) are translated into safe application-level errors without exposing database schema details, SQL queries, or connection strings.
3. **Unknown Exceptions**: All unknown runtime errors are safely converted into a generic `INTERNAL_SERVER_ERROR` with status `500`.
