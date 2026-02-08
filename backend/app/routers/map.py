from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlmodel import select
from sqlalchemy import func
from ..db.session import get_session
from ..models.ip_enrichment import IPEnrichment
from ..models.alert import Alert
from typing import List, Dict

router = APIRouter(prefix="/map", tags=["map"])

@router.get("/points")
def map_points(db: Session = Depends(get_session)) -> List[Dict]:
    # Collect enriched IPs with count of alerts per IP (single query)
    stmt = (
        select(IPEnrichment, func.count(Alert.id))
        .outerjoin(Alert, Alert.ip == IPEnrichment.ip)
        .group_by(IPEnrichment.ip)
    )
    ips = db.exec(stmt).all()
    results = []
    for enr, count in ips:
        if enr.lat is None or enr.lon is None:
            continue
        results.append({
            "ip": enr.ip,
            "country": enr.country,
            "lat": enr.lat,
            "lon": enr.lon,
            "count": int(count or 0),
        })
    return results
