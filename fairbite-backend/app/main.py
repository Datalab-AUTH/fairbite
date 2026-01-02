from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, Any
from uuid import uuid4
import threading

from app.service import run_fairbite_audit

app = FastAPI(title="FairBite Backend", version="0.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory job store (Phase 1). Later we'll replace with DB + Redis.
JOBS: Dict[str, Dict[str, Any]] = {}


class AuditCreateRequest(BaseModel):
    croissant_url: str = Field(..., min_length=5)
    sensitivity_threshold: int = Field(70, ge=0, le=100)
    max_level: int = Field(2, ge=1, le=6)
    under_ratio: float = Field(0.5, gt=0)
    over_ratio: float = Field(2.0, gt=0)
    min_count: int = Field(30, ge=0)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/audits")
def create_audit(req: AuditCreateRequest):
    audit_id = str(uuid4())
    JOBS[audit_id] = {
        "status": "queued",
        "request": req.model_dump(),
        "error": None,
        "result": None,
    }

    def runner():
        JOBS[audit_id]["status"] = "running"
        try:
            result = run_fairbite_audit(req.croissant_url, req.model_dump())
            JOBS[audit_id]["result"] = result

            if result.get("dataset_report", {}).get("error"):
                JOBS[audit_id]["status"] = "failed"
                JOBS[audit_id]["error"] = result["dataset_report"]["error"]
            else:
                JOBS[audit_id]["status"] = "completed"
        except Exception as e:
            JOBS[audit_id]["status"] = "failed"
            JOBS[audit_id]["error"] = str(e)

    threading.Thread(target=runner, daemon=True).start()

    return {"audit_id": audit_id, "status": JOBS[audit_id]["status"]}


@app.get("/audits/{audit_id}")
def get_audit_status(audit_id: str):
    job = JOBS.get(audit_id)
    if not job:
        return {"error": "audit_id not found"}
    return {"audit_id": audit_id, "status": job["status"], "error": job["error"]}


@app.get("/audits/{audit_id}/results")
def get_audit_results(audit_id: str):
    job = JOBS.get(audit_id)
    if not job:
        return {"error": "audit_id not found"}
    if job["status"] != "completed":
        return {
            "error": "not completed",
            "status": job["status"],
            "details": job["error"],
        }
    return job["result"]
