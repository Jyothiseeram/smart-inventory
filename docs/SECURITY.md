# Security Hardening & Principles

Smart Inventory applies defense-in-depth across the network, HTTP layer, application routing, and database engine.

---

## 1. Security Middleware

### Secure HTTP Headers (Helmet)
- Disables `X-Powered-By`.
- Enforces `X-Content-Type-Options: nosniff`.
- Restricts iframe embedding (`X-Frame-Options: SAMEORIGIN`).
- Enforces strict cross-origin policies (`Cross-Origin-Resource-Policy: cross-origin`).

### CORS Restrictions
- Configured via `CORS_ORIGIN` in environment configuration.
- Explicitly lists allowed headers: `Origin, X-Requested-With, Content-Type, Accept, Authorization, x-organization-id, x-user-id, x-session-token, x-request-id`.
- Exposes `X-Request-ID` to client applications.
- Supports authenticated cookies/tokens via `credentials: true`.

### Payload Size Limits
- Request body parsers limit JSON and URL-encoded payloads to `1MB`.
- Payloads exceeding `1MB` are rejected immediately by Express with `413 Payload Too Large`.

### Rate Limiting
- Configured via `RATE_LIMIT_WINDOW_MS` (default: 60 seconds) and `RATE_LIMIT_MAX` (default: 100 requests).
- Breaching the limit triggers an immediate HTTP `429 Too Many Requests` with code `RATE_LIMIT_EXCEEDED`.
- Returns standard `RateLimit-*` headers to inform clients of remaining quota and reset windows.

---

## 2. Request Identification & Correlation

Every request receives a tracking ID:
- If client sends a safe, valid `X-Request-ID` header (`^[a-zA-Z0-9_\-\.:]{1,128}$`), it is preserved and echoed.
- If missing or invalid, the API generates `req_${crypto.randomUUID()}`.
- Propagated to:
  - `req.id`
  - Response header `X-Request-ID`
  - All server-side logs and error reports.

---

## 3. Sensitive Data Protection & Logging

- **Redaction**: Structured logger automatically scrubs sensitive keys (`password`, `token`, `secret`, `authorization`, `cookie`, `tokenHash`).
- **No Body Logging**: Full request bodies are not logged by default.
- **Credential Masking**: Connection URLs and sensitive error details are masked before logging or response generation.
