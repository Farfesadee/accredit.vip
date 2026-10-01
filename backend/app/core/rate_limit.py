import time
from collections import defaultdict
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self.clients: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))

    async def dispatch(self, request: Request, call_next):
        limits = self._get_limits(request.url.path, request.method)
        if limits:
            client_ip = request.client.host if request.client else "unknown"
            now = time.time()
            window = self.clients[client_ip][limits["key"]]
            window[:] = [t for t in window if t > now - limits["window"]]
            if len(window) >= limits["max"]:
                return JSONResponse(
                    status_code=429,
                    headers={"Retry-After": str(int(limits["window"]))},
                    content={"detail": "Too many requests. Please try again later."},
                )
            window.append(now)
        return await call_next(request)

    def _get_limits(self, path: str, method: str) -> dict | None:
        if path.startswith("/api/v1/auth/login"):
            return {"key": "auth", "max": 10, "window": 60}
        if path.startswith("/api/v1/auth/register"):
            return {"key": "auth", "max": 5, "window": 60}
        if path.startswith("/api/v1/auth/forgot-password"):
            return {"key": "auth", "max": 3, "window": 60}
        if path.startswith("/api/v1/auth/reset-password"):
            return {"key": "auth", "max": 5, "window": 60}
        if path.startswith("/api/v1/auth/change-password"):
            return {"key": "auth", "max": 5, "window": 60}
        if path.startswith("/api/v1/rsvp"):
            return {"key": "rsvp", "max": 30, "window": 60}
        if path.startswith("/api/v1/tickets/purchase") and method == "POST":
            return {"key": "tickets", "max": 10, "window": 60}
        if path.startswith("/api/v1/tickets/purchase-webhook"):
            return None
        if path.startswith("/api/v1/trials") and method == "POST":
            return {"key": "trials", "max": 8, "window": 60}
        return None
