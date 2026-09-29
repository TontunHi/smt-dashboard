import os
import time
import json
import logging
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import httpx

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("smt_api")

app = FastAPI(
    title="NHSO SMT Budget Dashboard API Gateway",
    description="Backend Proxy & Cache Middleware for NHSO SMT Budget Tracking",
    version="1.0.0"
)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPSTREAM_API_URL = "https://smt.nhso.go.th/smtf/api/budgetreport/budgetSummaryByVendorReport/search"

# In-Memory Cache Store with TTL
# key: cache_key -> (timestamp, data)
CACHE_STORE: Dict[str, tuple[float, Any]] = {}
DEFAULT_CACHE_TTL_SECONDS = 600  # 10 minutes

class MultiBudgetFilterRequest(BaseModel):
    budgetYears: List[str] = Field(default=["2567"], description="รายการปีงบประมาณ พ.ศ. เช่น ['2567', '2568']")
    transferStartDate: Optional[str] = Field(default="", description="วันที่เริ่มต้น DD/MM/YYYY (พ.ศ.)")
    transferEndDate: Optional[str] = Field(default="", description="วันที่สิ้นสุด DD/MM/YYYY (พ.ศ.)")
    vendorId5Digit: Optional[str] = Field(default="", description="รหัสหน่วยบริการ 5 หลัก")
    zoneId: Optional[str] = Field(default="", description="รหัสเขตพื้นที่ สปสช. (1-13)")
    vendorSearchConditionCode: Optional[str] = Field(default="2", description="เงื่อนไขการค้นหา")
    budgetSource: Optional[str] = Field(default="", description="แหล่งเงินงบประมาณ")
    forceRefresh: Optional[bool] = Field(default=False, description="บังคับข้ามแคชเพื่อดึงข้อมูลใหม่ล่าสุด")

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "cache_entries": len(CACHE_STORE),
        "timestamp": time.time()
    }

@app.post("/api/budget/search")
async def search_budget(req: MultiBudgetFilterRequest):
    years = sorted(list(set([y.strip() for y in req.budgetYears if y.strip()])))
    if not years:
        years = ["2567"]
        
    all_items = []
    sources = []
    
    headers = {
        "Content-Type": "application/json;charset=UTF-8",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*"
    }
    
    now = time.time()
    
    async with httpx.AsyncClient(timeout=45.0, verify=False) as client:
        for yr in years:
            yr_num = int(yr) if yr.isdigit() else 2567
            # If date range is customized for single year, use it; otherwise compute default for that year
            start_dt = req.transferStartDate if (len(years) == 1 and req.transferStartDate) else f"01/10/{yr_num - 1}"
            end_dt = req.transferEndDate if (len(years) == 1 and req.transferEndDate) else f"30/09/{yr_num}"
            
            cache_key = f"{yr}_{start_dt}_{end_dt}_{req.vendorId5Digit}_{req.zoneId}_{req.budgetSource}"
            
            if not req.forceRefresh and cache_key in CACHE_STORE:
                cached_time, cached_data = CACHE_STORE[cache_key]
                if now - cached_time < DEFAULT_CACHE_TTL_SECONDS:
                    logger.info(f"Serving from cache for year {yr}: {cache_key}")
                    for r in cached_data.get("datas", []):
                        r_copy = dict(r)
                        r_copy["fiscalYear"] = yr
                        all_items.append(r_copy)
                    sources.append("cache")
                    continue
            
            payload = {
                "budgetYear": yr,
                "transferStartDate": start_dt,
                "transferEndDate": end_dt,
                "vendorId5Digit": req.vendorId5Digit.strip() if req.vendorId5Digit else "",
                "zoneId": req.zoneId.strip() if req.zoneId else "",
                "vendorSearchConditionCode": req.vendorSearchConditionCode or "2",
                "budgetSource": req.budgetSource.strip() if req.budgetSource else ""
            }
            
            logger.info(f"Requesting upstream SMT API for year {yr}: {payload}")
            try:
                resp = await client.post(UPSTREAM_API_URL, json=payload, headers=headers)
                if resp.status_code == 200:
                    res_json = resp.json()
                    raw_items = res_json.get("datas", []) or []
                    CACHE_STORE[cache_key] = (now, {"datas": raw_items})
                    for r in raw_items:
                        r_copy = dict(r)
                        r_copy["fiscalYear"] = yr
                        all_items.append(r_copy)
                    sources.append("upstream")
                else:
                    logger.error(f"Upstream error for year {yr}: {resp.status_code}")
                    if cache_key in CACHE_STORE:
                        for r in CACHE_STORE[cache_key][1].get("datas", []):
                            r_copy = dict(r)
                            r_copy["fiscalYear"] = yr
                            all_items.append(r_copy)
                        sources.append("fallback_cache")
            except Exception as e:
                logger.error(f"Error fetching year {yr}: {e}")
                if cache_key in CACHE_STORE:
                    for r in CACHE_STORE[cache_key][1].get("datas", []):
                        r_copy = dict(r)
                        r_copy["fiscalYear"] = yr
                        all_items.append(r_copy)
                    sources.append("fallback_cache")

    # Compute KPI Summary Aggregations across all items
    total_amount = sum(float(item.get("amount") or 0) for item in all_items)
    total_total = sum(float(item.get("total") or 0) for item in all_items)
    total_wait = sum(float(item.get("wait") or 0) for item in all_items)
    total_debt = sum(float(item.get("debt") or 0) for item in all_items)
    total_vat = sum(float(item.get("vat") or 0) for item in all_items)
    total_bond = sum(float(item.get("bond") or 0) for item in all_items)
    total_odbt = sum(float(item.get("odbt") or 0) for item in all_items)

    summary = {
        "recordCount": len(all_items),
        "totalAmount": round(total_amount, 2),
        "totalNetPayment": round(total_total, 2),
        "totalWait": round(total_wait, 2),
        "totalDebt": round(total_debt, 2),
        "totalVat": round(total_vat, 2),
        "totalBond": round(total_bond, 2),
        "totalOdbt": round(total_odbt, 2)
    }

    return {
        "source": "cache" if all(s == "cache" for s in sources) and sources else "upstream",
        "fetchedAt": now,
        "data": {
            "summary": summary,
            "datas": all_items
        }
    }
