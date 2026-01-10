from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlmodel import select
from ..db.session import get_session
from ..models.ip_enrichment import IPEnrichment
from ..models.alert import Alert
from typing import List, Dict

router = APIRouter(prefix="/map", tags=["map"])

@router.get("/points")
def map_points(db: Session = Depends(get_session)) -> List[Dict]:
    # Collect enriched IPs with basic count of alerts per IP
    ips = db.exec(select(IPEnrichment)).all()
    results = []
    for enr in ips:
        if enr.lat is None or enr.lon is None:
            continue
        count = len(db.exec(select(Alert.id).where(Alert.ip == enr.ip)).all())
        results.append({
            "ip": enr.ip,
            "country": enr.country,
            "lat": enr.lat,
            "lon": enr.lon,
            "count": count,
        })
    return results
