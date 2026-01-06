const API_BASE = "http://127.0.0.1:8000";

export async function createDataset(croissant_url) {
  const res = await fetch(`${API_BASE}/datasets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ croissant_url }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || "Failed to create dataset job");
  return data; // { dataset_id, status }
}

export async function getDatasetStatus(dataset_id) {
  const res = await fetch(`${API_BASE}/datasets/${dataset_id}`);
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || "Failed to fetch dataset status");
  return data; // { dataset_id, status, error, croissant_url }
}

export async function getDatasetReport(dataset_id) {
  const res = await fetch(`${API_BASE}/datasets/${dataset_id}/report`);
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.details || data.error || "Dataset not ready");
  return data; // dataset_report
}

export async function createRepresentationAudit(dataset_id, params) {
  const res = await fetch(`${API_BASE}/datasets/${dataset_id}/representation-audit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.details || data.error || "Failed to create representation audit");
  return data; // { audit_id, status }
}

export async function getRepresentationAuditStatus(audit_id) {
  const res = await fetch(`${API_BASE}/representation-audits/${audit_id}`);
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || "Failed to fetch representation audit status");
  return data; // { audit_id, status, error, ... }
}

export async function getRepresentationAuditResults(audit_id) {
  const res = await fetch(`${API_BASE}/representation-audits/${audit_id}/results`);
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.details || data.error || "Audit not ready");
  return data; // { rep_audit, summary }
}

