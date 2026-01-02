from typing import Any, Dict

from sensitive_characteristics_search import process_single_dataset
from representation_bias_audit import run_representation_audit


def build_summary(rep_audit: Dict[str, Any]) -> Dict[str, Any]:
    """
    Small UI-friendly summary: category counts by recordset and level.
    """
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


def run_fairbite_audit(croissant_url: str, params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Runs your full FairBite pipeline and returns JSON-serializable output.
    """
    dataset_report, dfs = process_single_dataset(croissant_url)

    # If Croissant load fails, return early
    if dataset_report.get("error"):
        return {"dataset_report": dataset_report, "rep_audit": None, "summary": None}

    rep_audit = run_representation_audit(
        dataset_report=dataset_report,
        dfs=dfs,
        sensitivity_threshold=int(params["sensitivity_threshold"]),
        max_level=int(params["max_level"]),
        min_count=int(params.get("min_count", 30)),
        under_ratio=float(params["under_ratio"]),
        over_ratio=float(params["over_ratio"]),
    )

    summary = build_summary(rep_audit)

    return {"dataset_report": dataset_report, "rep_audit": rep_audit, "summary": summary}
