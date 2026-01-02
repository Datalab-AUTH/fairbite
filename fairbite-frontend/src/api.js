const API_BASE = "http://127.0.0.1:8000";

export async function createAudit(payload) {
  const res = await fetch(`${API_BASE}/audits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || "Failed to create audit");
  return data; // { audit_id, status }
}

export async function getAuditStatus(auditId) {
  const res = await fetch(`${API_BASE}/audits/${auditId}`);
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || "Failed to fetch status");
  return data; // { audit_id, status, error }
}

export async function getAuditResults(auditId) {
  const res = await fetch(`${API_BASE}/audits/${auditId}/results`);
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.details || data.error || "Not ready");
  return data; // { dataset_report, rep_audit, summary }
}
