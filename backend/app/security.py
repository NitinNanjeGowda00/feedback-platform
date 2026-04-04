import hashlib
import hmac
import os
import time
from collections import defaultdict, deque
from typing import Callable

from fastapi import Header, HTTPException, Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def hash_ip(ip: str) -> str:
    salt = os.getenv("IP_HASH_SALT", "feedback-app-salt")
    return hashlib.sha256(f"{salt}:{ip}".encode("utf-8")).hexdigest()


def require_admin_api_key(x_admin_key: str = Header(default="")) -> None:
    expected = os.getenv("ADMIN_API_KEY")
    if not expected:
        raise HTTPException(status_code=500, detail="ADMIN_API_KEY is not configured")

    if not x_admin_key or not hmac.compare_digest(x_admin_key, expected):
        raise HTTPException(status_code=403, detail="Admin access denied")


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Simple in-memory rate limit. Good enough for a single app instance.
    For multi-instance deployments, move this to Redis or your edge layer.
    """
    def __init__(self, app):
        super().__init__(app)
        self.window_seconds = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60"))
        self.max_requests = int(os.getenv("RATE_LIMIT_REQUESTS", "120"))
        self.hits = defaultdict(deque)

    async def dispatch(self, request: Request, call_next: Callable):
        path = request.url.path

        if path in {"/", "/health", "/docs", "/openapi.json"}:
            return await call_next(request)

        ip = get_client_ip(request)
        key = f"{ip}:{path}"
        now = time.time()

        queue = self.hits[key]
        while queue and queue[0] < now - self.window_seconds:
            queue.popleft()

        if len(queue) >= self.max_requests:
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please slow down."},
            )

        queue.append(now)
        return await call_next(request)