"""Defense IP blacklist enforcement middleware.

When DEFENSE_ENFORCE_API=true, requests whose client IP is on the in-memory
blacklist receive an immediate 403 with the iptables hint, so the API itself
acts as a defense barrier even without netfilter rules in place.
"""
from __future__ import annotations
from fastapi import Request
from fastapi.responses import JSONResponse

from ..services.defense import defense_enforce_api
from ..services import ip_blacklist


async def defense_enforcement_middleware(request: Request, call_next):
    if not defense_enforce_api():
        return await call_next(request)
    client_ip = request.client.host if request.client else None
    if not client_ip:
        return await call_next(request)
    if ip_blacklist.is_blocked(client_ip):
        entry = ip_blacklist.get_blocked_entry(client_ip)
        return JSONResponse(
            {
                "error": "IP temporairement bloquée",
                "ip": client_ip,
                "expires_at": entry["expires_at"] if entry else None,
                "reason": entry["reason"] if entry else "Blocage applicatif actif",
                "iptables_command": f"iptables -A INPUT -s {client_ip} -j DROP",
            },
            status_code=403,
        )
    return await call_next(request)
