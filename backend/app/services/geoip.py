from typing import Optional, Tuple
from ..core.settings import settings
import os

try:
    import geoip2.database  # type: ignore
except Exception:
    geoip2 = None  # type: ignore

# Note: Configure path via env GEOLITE2_CITY_DB. If missing, enrichment returns None.

def lookup_ip(ip: str) -> Tuple[Optional[str], Optional[float], Optional[float]]:
    if not geoip2:
        return None, None, None
    db_path = os.getenv("GEOLITE2_CITY_DB")
    if not db_path or not os.path.exists(db_path):
        return None, None, None
    try:
        with geoip2.database.Reader(db_path) as reader:
            r = reader.city(ip)
            country = r.country.iso_code or None
            lat = r.location.latitude
            lon = r.location.longitude
            return country, lat, lon
    except Exception:
        return None, None, None
