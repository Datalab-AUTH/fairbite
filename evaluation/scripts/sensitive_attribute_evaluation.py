import os
import json
from typing import Dict, Any, List, Optional, Tuple

import pandas as pd
import numpy as np

EXPERT_DIR = "expert_annotations"
LLM_DIR = "sensitive_attributes_results"
OUT_DIR = "evaluation_results"

EXPERT_PREFIX = "expert_ann_"
LLM_PREFIX = "sen_attr_"

LABELS = [1, 2, 3, 4, 5]  # Category IDs


# -------------------- File matching --------------------

def list_expert_files() -> List[str]:
    if not os.path.isdir(EXPERT_DIR):
        return []
    return sorted(
        os.path.join(EXPERT_DIR, fn)
        for fn in os.listdir(EXPERT_DIR)
        if fn.startswith(EXPERT_PREFIX) and fn.endswith(".json")
    )


def match_llm_file(expert_path: str) -> Optional[str]:
    base = os.path.basename(expert_path)
    stem_with_ext = base[len(EXPERT_PREFIX):]  # includes ".json"
    llm_name = f"{LLM_PREFIX}{stem_with_ext}"
    llm_path = os.path.join(LLM_DIR, llm_name)
    return llm_path if os.path.exists(llm_path) else None


# -------------------- JSON -> DataFrame --------------------

def load_payload(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def payload_to_df(payload: Dict[str, Any], source: str) -> pd.DataFrame:
    rows = []
    for rs_entry in (payload.get("recordsets") or []):
        rs_name = (rs_entry.get("recordset_name") or "").strip()
        for col in (rs_entry.get("results") or []):
            key = col.get("key")
            if not isinstance(key, str) or not key.strip():
                continue

            rows.append({
                "recordset_name": rs_name,
                "key": key.strip(),
                "sensitivity": col.get("sensitivity"),
                "reason": col.get("reason"),
                "is_categorical": col.get("is_categorical"),
                "source": source
            })

    return pd.DataFrame(rows)


def safe_int_0_100(x) -> Optional[int]:
    try:
        if x is None:
            return None
        v = int(round(float(x)))
        return max(0, min(100, v))
    except Exception:
        return None


def score_to_category(score: int) -> int:
    # • 90–100 -> 5
    # • 60–89  -> 4
    # • 30–59  -> 3
    # • 1–29   -> 2
    # • 0      -> 1
    if score >= 90:
        return 5
    if score >= 60:
        return 4
    if score >= 30:
        return 3
    if score >= 1:
        return 2
    return 1


# -------------------- Metrics helpers --------------------

def confusion_matrix_5(y_true: np.ndarray, y_pred: np.ndarray, labels: List[int]) -> np.ndarray:
    idx = {lab: i for i, lab in enumerate(labels)}
    cm = np.zeros((len(labels), len(labels)), dtype=int)
    for t, p in zip(y_true, y_pred):
        if t in idx and p in idx:
            cm[idx[t], idx[p]] += 1
    return cm


def per_class_prf(cm: np.ndarray, labels: List[int]) -> Dict[int, Dict[str, Optional[float]]]:
    out = {}
    for i, lab in enumerate(labels):
        tp = cm[i, i]
        fp = cm[:, i].sum() - tp
        fn = cm[i, :].sum() - tp

        prec = tp / (tp + fp) if (tp + fp) > 0 else None
        rec = tp / (tp + fn) if (tp + fn) > 0 else None
        f1 = (2 * prec * rec / (prec + rec)) if (prec is not None and rec is not None and (prec + rec) > 0) else None
        support = int(cm[i, :].sum())

        out[lab] = {"precision": prec, "recall": rec, "f1": f1, "support": support}
    return out


def macro_avg(per_class: Dict[int, Dict[str, Optional[float]]]) -> Dict[str, Optional[float]]:
    precs = [v["precision"] for v in per_class.values() if v["precision"] is not None]
    recs = [v["recall"] for v in per_class.values() if v["recall"] is not None]
    f1s = [v["f1"] for v in per_class.values() if v["f1"] is not None]
    return {
        "precision_macro": float(np.mean(precs)) if precs else None,
        "recall_macro": float(np.mean(recs)) if recs else None,
        "f1_macro": float(np.mean(f1s)) if f1s else None,
    }


def weighted_avg(per_class: Dict[int, Dict[str, Optional[float]]]) -> Dict[str, Optional[float]]:
    supports = np.array([v["support"] for v in per_class.values()], dtype=float)
    total = supports.sum()
    if total <= 0:
        return {"precision_weighted": None, "recall_weighted": None, "f1_weighted": None}

    def wavg(key: str) -> Optional[float]:
        vals = []
        wts = []
        for v in per_class.values():
            if v[key] is None:
                continue
            vals.append(v[key])
            wts.append(v["support"])
        if not vals or sum(wts) == 0:
            return None
        return float(np.average(vals, weights=np.array(wts, dtype=float)))

    return {
        "precision_weighted": wavg("precision"),
        "recall_weighted": wavg("recall"),
        "f1_weighted": wavg("f1"),
    }


def quadratic_weighted_kappa(cm: np.ndarray) -> Optional[float]:
    n = cm.sum()
    if n == 0:
        return None

    k = cm.shape[0]
    O = cm.astype(float) / n

    row_marg = cm.sum(axis=1).astype(float)
    col_marg = cm.sum(axis=0).astype(float)
    E = np.outer(row_marg, col_marg) / (n * n)

    W = np.zeros((k, k), dtype=float)
    for i in range(k):
        for j in range(k):
            W[i, j] = ((i - j) ** 2) / ((k - 1) ** 2)

    num = (W * O).sum()
    den = (W * E).sum()
    if den == 0:
        return None
    return float(1.0 - num / den)


def spearman_rho(x: np.ndarray, y: np.ndarray) -> Optional[float]:
    if len(x) < 2:
        return None
    rx = pd.Series(x).rank(method="average").to_numpy()
    ry = pd.Series(y).rank(method="average").to_numpy()
    vx = rx - rx.mean()
    vy = ry - ry.mean()
    denom = np.sqrt((vx * vx).sum() * (vy * vy).sum())
    if denom == 0:
        return None
    return float((vx * vy).sum() / denom)


def rmse(a: np.ndarray, b: np.ndarray) -> Optional[float]:
    if len(a) == 0:
        return None
    return float(np.sqrt(np.mean((a - b) ** 2)))


def mape(a: np.ndarray, b: np.ndarray) -> Optional[float]:
    """
    MAPE (%) on category indices 1..5:
      mean(|a-b|/|a|) * 100
    Since categories are 1..5, denominator is never 0.
    """
    if len(a) == 0:
        return None
    denom = np.abs(a)
    if np.any(denom == 0):
        return None
    return float(np.mean(np.abs(a - b) / denom) * 100.0)


def r2_score(a: np.ndarray, b: np.ndarray) -> Optional[float]:
    """
    R^2 on category indices treated as numeric.
    Undefined if variance of a is zero.
    """
    if len(a) == 0:
        return None
    ss_res = float(np.sum((a - b) ** 2))
    ss_tot = float(np.sum((a - np.mean(a)) ** 2))
    if ss_tot == 0:
        return None
    return float(1.0 - ss_res / ss_tot)


# -------------------- Dataset evaluation --------------------

def evaluate_dataset(expert_df: pd.DataFrame, llm_df: pd.DataFrame) -> Tuple[Dict[str, Any], np.ndarray, pd.DataFrame]:
    e = expert_df.rename(columns={"sensitivity": "expert_sensitivity"}).copy()
    l = llm_df.rename(columns={"sensitivity": "llm_sensitivity"}).copy()

    for df in (e, l):
        df["recordset_name"] = df["recordset_name"].astype(str).str.strip()
        df["key"] = df["key"].astype(str).str.strip()

    merged = e.merge(
        l[["recordset_name", "key", "llm_sensitivity"]],
        on=["recordset_name", "key"],
        how="inner",
    )

    merged["expert_sensitivity"] = merged["expert_sensitivity"].apply(safe_int_0_100)
    merged["llm_sensitivity"] = merged["llm_sensitivity"].apply(safe_int_0_100)
    merged = merged.dropna(subset=["expert_sensitivity", "llm_sensitivity"]).copy()

    n = int(len(merged))
    if n == 0:
        return (
            {
                "n_compared": 0,
                "mae_score": None,
                "mae_category": None,
                "rmse_category": None,
                "mape_category": None,
                "r2_category": None,
                "accuracy": None,
                "precision_macro": None,
                "recall_macro": None,
                "f1_macro": None,
                "precision_weighted": None,
                "recall_weighted": None,
                "f1_weighted": None,
                "qwk": None,
                "spearman_category": None,
            },
            np.zeros((5, 5), dtype=int),
            merged
        )

    mae_score = float((merged["expert_sensitivity"] - merged["llm_sensitivity"]).abs().mean())

    merged["y_true"] = merged["expert_sensitivity"].apply(score_to_category)
    merged["y_pred"] = merged["llm_sensitivity"].apply(score_to_category)

    y_true = merged["y_true"].to_numpy(dtype=int)
    y_pred = merged["y_pred"].to_numpy(dtype=int)

    cm = confusion_matrix_5(y_true, y_pred, LABELS)
    accuracy = float((y_true == y_pred).mean())

    per_cls = per_class_prf(cm, LABELS)
    macro = macro_avg(per_cls)
    weighted = weighted_avg(per_cls)

    mae_category = float(np.mean(np.abs(y_true - y_pred)))
    rmse_category = rmse(y_true.astype(float), y_pred.astype(float))
    mape_category = mape(y_true.astype(float), y_pred.astype(float))
    r2_category = r2_score(y_true.astype(float), y_pred.astype(float))

    qwk = quadratic_weighted_kappa(cm)
    spear = spearman_rho(y_true, y_pred)

    flat_per_cls = {}
    for c in LABELS:
        flat_per_cls[f"cat{c}_precision"] = per_cls[c]["precision"]
        flat_per_cls[f"cat{c}_recall"] = per_cls[c]["recall"]
        flat_per_cls[f"cat{c}_f1"] = per_cls[c]["f1"]
        flat_per_cls[f"cat{c}_support"] = per_cls[c]["support"]

    metrics = {
        "n_compared": n,
        "mae_score": mae_score,

        "mae_category": mae_category,
        "rmse_category": rmse_category,
        "mape_category": mape_category,
        "r2_category": r2_category,

        "accuracy": accuracy,
        **macro,
        **weighted,
        "qwk": qwk,
        "spearman_category": spear,
        **flat_per_cls,
    }

    return metrics, cm, merged


# -------------------- Saving confusion matrices --------------------

def save_confusion_matrix_csv(cm: np.ndarray, path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    df = pd.DataFrame(cm, index=[f"true_cat{c}" for c in LABELS], columns=[f"pred_cat{c}" for c in LABELS])
    df.to_csv(path, index=True)


# -------------------- Main --------------------

def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    expert_files = list_expert_files()
    if not expert_files:
        print(f"No expert files found in: {EXPERT_DIR}")
        return

    results = []
    cm_total = np.zeros((5, 5), dtype=int)

    per_dataset_cm_dir = os.path.join(OUT_DIR, "confusion_matrices")
    os.makedirs(per_dataset_cm_dir, exist_ok=True)

    for exp_path in expert_files:
        llm_path = match_llm_file(exp_path)
        if llm_path is None:
            print(f"[WARN] No matching LLM file for: {os.path.basename(exp_path)}")
            continue

        dataset_stem = os.path.basename(exp_path)[len(EXPERT_PREFIX):-len(".json")]

        expert_payload = load_payload(exp_path)
        llm_payload = load_payload(llm_path)

        expert_df = payload_to_df(expert_payload, source="expert")
        llm_df = payload_to_df(llm_payload, source="llm")

        metrics, cm, _merged = evaluate_dataset(expert_df, llm_df)
        metrics["dataset"] = dataset_stem
        results.append(metrics)

        cm_total += cm
        save_confusion_matrix_csv(cm, os.path.join(per_dataset_cm_dir, f"cm_{dataset_stem}.csv"))

        print(
            f"[OK] {dataset_stem}: n={metrics['n_compared']} "
            f"acc={metrics['accuracy']} f1_macro={metrics['f1_macro']} "
            f"qwk={metrics['qwk']} mae_cat={metrics['mae_category']} rmse_cat={metrics['rmse_category']}"
        )

    out_csv = os.path.join(OUT_DIR, "dataset_metrics.csv")
    pd.DataFrame(results).to_csv(out_csv, index=False)

    save_confusion_matrix_csv(cm_total, os.path.join(OUT_DIR, "confusion_matrix_ALL.csv"))

    print(f"\nSaved:")
    print(f" - {out_csv}")
    print(f" - {per_dataset_cm_dir}/cm_<dataset>.csv (per dataset)")
    print(f" - {os.path.join(OUT_DIR, 'confusion_matrix_ALL.csv')} (aggregate)")


if __name__ == "__main__":
    main()
