from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional
from uuid import uuid4
import threading
import time

from app.service import process_dataset_only, run_rep_audit_only

app = FastAPI(title="FairBite Backend", version="0.2")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# In-memory stores (Phase 1)
# -----------------------------
DATASETS: Dict[str, Dict[str, Any]] = {}
# DATASETS[dataset_id] = {
#   status: queued/running/completed/failed,
#   croissant_url: ...,
#   error: ...,
#   dataset_report: ...,
#   dfs: ... (in-memory only)
# }

REP_AUDITS: Dict[str, Dict[str, Any]] = {}
# REP_AUDITS[audit_id] = {
#   status: queued/running/completed/failed,
#   dataset_id: ...,
#   params: ...,
#   error: ...,
#   result: {rep_audit, summary}
# }


class DatasetCreateRequest(BaseModel):
    croissant_url: str = Field(..., min_length=5)


class RepAuditRequest(BaseModel):
    sensitivity_threshold: int = Field(70, ge=0, le=100)
    max_level: int = Field(2, ge=1, le=6)
    under_ratio: float = Field(0.5, gt=0)
    over_ratio: float = Field(2.0, gt=0)


@app.get("/health")
def health():
    return {"status": "ok"}


# -----------------------------
# 1) Dataset processing endpoints
# -----------------------------
@app.post("/datasets")
def create_dataset(req: DatasetCreateRequest):
    dataset_id = str(uuid4())
    DATASETS[dataset_id] = {
        "status": "queued",
        "croissant_url": req.croissant_url,
        "error": None,
        "dataset_report": None,
        "dfs": None,
    }

    def runner():
        DATASETS[dataset_id]["status"] = "running"
        try:
            report, dfs = process_dataset_only(req.croissant_url)

            # If Croissant load failed, report contains "error"
            if report.get("error"):
                DATASETS[dataset_id]["status"] = "failed"
                DATASETS[dataset_id]["error"] = report["error"]
                DATASETS[dataset_id]["dataset_report"] = report
                DATASETS[dataset_id]["dfs"] = None
                return

            DATASETS[dataset_id]["dataset_report"] = report
            DATASETS[dataset_id]["dfs"] = dfs  # keep in memory
            DATASETS[dataset_id]["status"] = "completed"

        except Exception as e:
            DATASETS[dataset_id]["status"] = "failed"
            DATASETS[dataset_id]["error"] = str(e)

    threading.Thread(target=runner, daemon=True).start()

    return {"dataset_id": dataset_id, "status": DATASETS[dataset_id]["status"]}


@app.get("/datasets/{dataset_id}")
def get_dataset_status(dataset_id: str):
    ds = DATASETS.get(dataset_id)
    if not ds:
        return {"error": "dataset_id not found"}
    return {
        "dataset_id": dataset_id,
        "status": ds["status"],
        "error": ds["error"],
        "croissant_url": ds["croissant_url"],
    }


@app.get("/datasets/{dataset_id}/report")
def get_dataset_report(dataset_id: str):
    ds = DATASETS.get(dataset_id)
    if not ds:
        return {"error": "dataset_id not found"}
    if ds["status"] != "completed":
        return {"error": "not completed", "status": ds["status"], "details": ds["error"]}
    return ds["dataset_report"]


# -----------------------------
# 2) Representation audit endpoints
# -----------------------------
@app.post("/datasets/{dataset_id}/representation-audit")
def create_rep_audit(dataset_id: str, req: RepAuditRequest):
    ds = DATASETS.get(dataset_id)
    if not ds:
        return {"error": "dataset_id not found"}
    if ds["status"] != "completed":
        return {"error": "dataset not ready", "status": ds["status"], "details": ds["error"]}
    if ds["dataset_report"] is None or ds["dfs"] is None:
        return {"error": "dataset data missing in memory"}

    audit_id = str(uuid4())
    REP_AUDITS[audit_id] = {
        "status": "queued",
        "dataset_id": dataset_id,
        "params": req.model_dump(),
        "error": None,
        "result": None,
    }

    def runner():
        REP_AUDITS[audit_id]["status"] = "running"
        try:
            result = run_rep_audit_only(ds["dataset_report"], ds["dfs"], req.model_dump())
            REP_AUDITS[audit_id]["result"] = result
            REP_AUDITS[audit_id]["status"] = "completed"
        except Exception as e:
            REP_AUDITS[audit_id]["status"] = "failed"
            REP_AUDITS[audit_id]["error"] = str(e)

    threading.Thread(target=runner, daemon=True).start()

    return {"audit_id": audit_id, "status": REP_AUDITS[audit_id]["status"]}


@app.get("/representation-audits/{audit_id}")
def get_rep_audit_status(audit_id: str):
    job = REP_AUDITS.get(audit_id)
    if not job:
        return {"error": "audit_id not found"}
    return {
        "audit_id": audit_id,
        "status": job["status"],
        "error": job["error"],
        "dataset_id": job["dataset_id"],
        "params": job["params"],
    }


@app.get("/representation-audits/{audit_id}/results")
def get_rep_audit_results(audit_id: str):
    job = REP_AUDITS.get(audit_id)
    if not job:
        return {"error": "audit_id not found"}
    if job["status"] != "completed":
        return {"error": "not completed", "status": job["status"], "details": job["error"]}
    return job["result"]
