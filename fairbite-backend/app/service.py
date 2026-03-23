from typing import Any, Dict

from sensitive_characteristics_search import process_single_dataset
from representation_bias_audit import run_representation_audit


def build_summary(rep_audit: Dict[str, Any]) -> Dict[str, Any]:
    out = {"recordsets": []}
    for rs in rep_audit.get("recordsets", []):
        rs_name = rs.get("recordset_name")
        rep = rs.get("representation", {})
        levels = rep.get("levels", {})

        rs_sum = {"recordset_name": rs_name, "levels": {}}
        for level_str, groups in levels.items():
            counts = {
                "not_represented": 0,
                "under_represented": 0,
                "over_represented": 0,
                "well_represented": 0,
            }
            for g in groups:
                cat = g.get("category", "well_represented")
                if cat in counts:
                    counts[cat] += 1
            rs_sum["levels"][level_str] = counts

        out["recordsets"].append(rs_sum)
    return out


def process_dataset_only(croissant_url: str) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """
    Returns:
      - dataset_report (JSON-serializable)
      - dfs (dict[str, pd.DataFrame]) (NOT JSON-serializable; kept in memory)
    """
    dataset_report, dfs = process_single_dataset(croissant_url)
    return dataset_report, dfs


def run_rep_audit_only(dataset_report: Dict[str, Any], dfs: Dict[str, Any], params: Dict[str, Any]) -> Dict[str, Any]:
    rep_audit = run_representation_audit(
        dataset_report=dataset_report,
        dfs=dfs,
        sensitivity_threshold=int(params["sensitivity_threshold"]),
        max_level=int(params["max_level"]),
        under_ratio=float(params["under_ratio"]),
        over_ratio=float(params["over_ratio"]),
    )
    summary = build_summary(rep_audit)
    return {"rep_audit": rep_audit, "summary": summary}
