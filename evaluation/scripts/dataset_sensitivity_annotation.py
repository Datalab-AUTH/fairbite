import time
import json
import pandas as pd
import mlcroissant as mlc
from typing import Dict, List, Tuple, Optional
import os
import re
from pathlib import Path
from v9_sensitive_characteristics_search import field_key, load_croissant_dataset

def build_sensitive_prompt(ds_name, ds_description, rs) -> Tuple[str, List[str]]:
    # Build column payload (original key + description if any)
    cols_payload = []
    for f in rs.fields:
        key = str(field_key(f))
        desc = getattr(f, "description", None) or "No column description found"
        cols_payload.append({"key": key, "description": desc})

    allowed_keys = [c["key"] for c in cols_payload]
    numbered = [{"index": i, **c} for i, c in enumerate(cols_payload)]

    dataset_name = ds_name or "Unnamed dataset"
    rs_description = getattr(rs, "description", None) or ""

    prompt = f"""
ROLE
You are a fairness & social justice analyst.

PRIMARY TASK
Using the dataset/table context and the numbered list of columns, assign to EACH column:
- a sensitivity score between 0 and 100 (integer percentage),
- a short explanation (reason) for that score, and
- a boolean flag indicating if the column is categorical (discrete values) or not.

IMPORTANT: 
The sensitivity score MUST be decided ONLY using the IN-SCOPE taxonomy below.
You MUST IGNORE any narrative about how this particular dataset is biased in practice.
Context is allowed ONLY to disambiguate the meaning of ambiguous column names, NOT to redefine
what counts as a sensitive attribute.

DEFINITION OF “SENSITIVITY”
“Sensitivity” = how strongly this column represents or encodes a sensitive characteristic
from the IN-SCOPE list below. 
0 = not sensitive at all by that definition; 
100 = clearly one of the IN-SCOPE characteristics.
Intermediate values reflect partial or ambiguous relationships.

IN-SCOPE (unified list; match by meaning/synonym/encoding; case-insensitive on key & description)
   • Gender & sexual identity: sex, gender (incl. pregnancy, sex characteristics), sexual orientation, gender identity/expression
   • Racial & ethnic origin: race, color, ethnic origin, national origin, nationality, language, national/ethnic minority
   • Socioeconomic status: social origin/class, property/ownership type, receipt of public assistance/benefits/welfare
   • Religion, belief & opinion: religion/belief/faith, political opinion, broader ideological/worldview (where protected)
   • Family & civil status: birth, familial status, marital status (e.g., married/single/divorced/widowed), parental status
   • Disability & health conditions: disability/impairment, genetic features (as a characteristic)
   • Age: age, date of birth, life stage/generation

OUT OF SCOPE (not sensitive by themselves, unless explicitly encoding a sensitive class)
• Personally Identifiable Information/contact-only fields: name, email, phone, exact address, device/account IDs, IPs, cookies, etc.

SCORING GUIDELINES
• 90–100: direct, explicit sensitive characteristic (e.g., age, sex, race, marital status, native country).
• 60–89: strong proxy/encoding of a sensitive characteristic (e.g., detailed region, native language, tribe).
• 30–59: weak/indirect proxy (may correlate with sensitive traits but also has broader uses).
• 1–29: mostly non-sensitive, but with minor or context-dependent concern.
• 0: clearly not sensitive and not a meaningful proxy.

STRICT RULES
• Judge EVERY column independently; do NOT skip any.
• DO NOT reduce the sensitivity just because a column is the target/label. Sensitivity is about the *meaning of the 
  attribute itself*, not its role (feature vs target).
• You MUST output exactly one object per input column, in the same order.
• Use the ORIGINAL 'key' text from the input when filling the 'key' field in the output.
• Be concise but specific in the 'reason': reference which IN-SCOPE category (if any) applies.

INPUT
Dataset name: {dataset_name}
Dataset description: {ds_description or "No dataset description found."}
Table name: {field_key(rs)}
Table description: {rs_description or "No table description found."}

NUMBERED COLUMNS (evaluate each item)
{json.dumps(numbered, indent=2, ensure_ascii=False)}

OUTPUT FORMAT (JSON ONLY, no prose)
Return a single JSON object with this exact schema:
{{
  "columns": [
    {{
      "index": <integer index from the input>,
      "key": "<exact key string from the input>",
      "sensitivity": <integer between 0 and 100>,
      "reason": "<short explanation>",
      "is_categorical": <boolean true/false>
    }},
    ...
  ]
}}
Constraints:
- The 'columns' array MUST have length {len(allowed_keys)} (one entry per column).
- 'index' MUST match the input index and appear in ascending order (0,1,2,...).
- 'key' MUST match the original key for that index.
- 'sensitivity' MUST be an integer from 0 to 100 (no other type).
- 'reason' MUST be a non-empty string.
- 'is_categorical' MUST be a boolean.
""".strip()

    return prompt, allowed_keys


def _sanitize_filename(s: str) -> str:
    # s = (s or "unnamed_dataset").strip()
    # s = re.sub(r"\s+", "_", s)
    # s = re.sub(r"[^A-Za-z0-9._-]+", "", s)
    # return s[:120] if len(s) > 120 else s
    return s.replace(" ", "_").replace("/", "_").replace("\\", "_")


def _prompt_int_0_100(msg: str) -> int:
    while True:
        raw = input(msg).strip()
        try:
            v = int(raw)
            if 0 <= v <= 100:
                return v
        except Exception:
            pass
        print("  Please enter an integer between 0 and 100.")


def _prompt_nonempty(msg: str) -> str:
    while True:
        s = input(msg).strip()
        if s:
            return s
        print("  Please enter a non-empty reason.")


def _prompt_bool(msg: str) -> bool:
    while True:
        raw = input(msg).strip().lower()
        if raw in ("true", "t", "1", "yes", "y"):
            return True
        if raw in ("false", "f", "0", "no", "n"):
            return False
        print("  Please enter true/false (or y/n).")


def expert_annotate_recordset(
    dataset_name: str,
    dataset_description: str,
    rs,
) -> List[dict]:
    """
    Returns the same structure as detect_sensitive_characteristics(), but filled by a human expert.
    """
    prompt_text, allowed_keys = build_sensitive_prompt(dataset_name, dataset_description, rs)

    print("\n" + "=" * 80)
    print(f"EXPERT ANNOTATION PROMPT (RecordSet: {field_key(rs)})")
    print("=" * 80)
    print(prompt_text)
    print("=" * 80)
    print("Now enter expert annotations for each column.\n")

    results = []
    # iterate in original field order (same as allowed_keys)
    for i, key in enumerate(allowed_keys):
        print(f"\n--- Column {i}: {key} ---")
        sens = _prompt_int_0_100("Sensitivity (0-100): ")
        reason = _prompt_nonempty("Reason: ")
        is_cat = _prompt_bool("Is categorical? (true/false): ")

        results.append({
            "key": key,
            "sensitivity": sens,
            "reason": reason,
            "is_categorical": is_cat,
        })

    return results


def run_expert_annotation_for_dataset(croissant_path: str) -> dict:
    dataset_entry, croissant_dataset, record_sets = load_croissant_dataset(croissant_path)

    if croissant_dataset is None or record_sets is None:
        return dataset_entry

    recordset_entries: List[dict] = []
    for rs in record_sets:
        rs_key = field_key(rs) or "No name found"
        rs_description = getattr(rs, "description", None) or "No description found"

        recordset_entry = {
            "recordset_name": rs_key,
            "recordset_description": rs_description,
            "results": None,
            "error": None,
        }

        try:
            start = time.perf_counter()
            results = expert_annotate_recordset(
                dataset_name=dataset_entry["dataset_name"],
                dataset_description=dataset_entry["description"],
                rs=rs,
            )
            end = time.perf_counter()
            recordset_entry["results"] = results
            recordset_entry["execution_time_seconds"] = (end - start)

        except Exception as e:
            recordset_entry["error"] = f"Expert annotation error: {str(e)}"

        recordset_entries.append(recordset_entry)

    dataset_entry["recordsets"] = recordset_entries
    return dataset_entry


def save_expert_annotations_json(dataset_report: dict, output_dir: str = "expert_annotations") -> str:
    Path(output_dir).mkdir(parents=True, exist_ok=True)

    dataset_name = dataset_report.get("dataset_name") or "unnamed_dataset"
    safe_name = _sanitize_filename(dataset_name)

    out_path = os.path.join(output_dir, f"expert_ann_{safe_name}_.json")

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(dataset_report, f, ensure_ascii=False, indent=2)

    return out_path


def main():
    DATASET_URLS = [

        # --- New Curated Datasets (Uncomment to enable) ---

        # --- Education ---
        # "https://www.kaggle.com/datasets/rabieelkharoua/students-performance-dataset/croissant/download",
        # "https://www.kaggle.com/datasets/sadiajavedd/students-academic-performance-dataset/croissant/download",
        # "https://www.kaggle.com/datasets/dillonmyrick/high-school-student-performance-and-demographics/croissant/download"
        # "https://huggingface.co/api/datasets/ErrorER123/student-performance/croissant" +
        # "https://www.kaggle.com/datasets/muhammadkhubaibahmad/student-performance-and-clustering-dataset/croissant/download" +
        # "https://www.kaggle.com/datasets/adilshamim8/personalized-learning-and-adaptive-education-dataset/croissant/download" +
        # "https://www.kaggle.com/datasets/bhavikjikadara/student-study-performance/croissant/download" +
        # "https://www.kaggle.com/datasets/aryan208/student-habits-and-academic-performance-dataset/croissant/download"
        # "https://www.kaggle.com/datasets/parthmanjrekar/student-performance-data/croissant/download"
        # "https://www.kaggle.com/datasets/suvidyasonawane/student-performance-dataset/croissant/download"

        # --- Employment ---
        # "https://www.kaggle.com/datasets/prince7489/employee-salary-dataset/croissant/download",
        # "https://www.kaggle.com/datasets/stealthtechnologies/employee-attrition-dataset/croissant/download",
        # "https://www.kaggle.com/datasets/nadeemajeedch/employee-performance-and-salary-dataset/croissant/download"
        # "https://huggingface.co/api/datasets/hugginglearners/data-science-job-salaries/croissant"
        # "https://www.kaggle.com/datasets/zahidmughal2343/employee-data/croissant/download"
        # "https://www.kaggle.com/datasets/smayanj/employee-records-dataset/croissant/download"
        # "https://www.kaggle.com/datasets/carebymanu/employee-dataset-retail/croissant/download"
        # "https://www.kaggle.com/datasets/suneelpatel/hr-attrition-management-dataset/croissant/download"
        # "https://www.kaggle.com/datasets/bhavya5800/hr-analytics-dashboard/croissant/download"
        # "https://www.kaggle.com/datasets/saarib2405/human-resource-dataset/croissant/download"

        # --- Health Care ---
        # Hospital management (patients, etc.)
        # "https://www.kaggle.com/datasets/kanakbaghel/hospital-management-dataset/croissant/download",
        # General Healthcare (conditions, demographics)
        # "https://www.kaggle.com/datasets/prasad22/healthcare-dataset/croissant/download",
        # Heart Failure (Age, Sex, Health)
        # "https://www.kaggle.com/datasets/alamshihab075/heart-failure-diagnosis-data-for-machine-learning/croissant/download",
        # Symptoms & Disease (Health data)
        # "https://www.kaggle.com/datasets/kundanbedmutha/healthcare-symptomsdisease-classification-dataset/croissant/download",
        # Diabetes Prediction (Health, Age, etc.)
        # "https://www.kaggle.com/datasets/alamshihab075/health-and-lifestyle-data-for-diabetes-prediction/croissant/download",
        # "https://www.kaggle.com/datasets/mahdimashayekhi/mental-health/croissant/download"
        # "https://www.kaggle.com/datasets/bhavikjikadara/mental-health-dataset/croissant/download"
        # "https://www.kaggle.com/datasets/uom190346a/sleep-health-and-lifestyle-dataset/croissant/download"
        # "https://www.kaggle.com/datasets/jaceprater/smokers-health-data/croissant/download"
        # "https://www.kaggle.com/datasets/shariful07/student-mental-health/croissant/download"

        # --- Finance & Social ---
        # Adult Income (Race, Sex, Country - Classic bias dataset)
        # "https://www.kaggle.com/datasets/wenruliu/adult-income-dataset/croissant/download",
        # Adult Census Income (Alternative version)
        # "https://www.kaggle.com/datasets/uciml/adult-census-income/croissant/download",
        # Credit Scoring (Financial status, Age, potentially others)
        # "https://www.kaggle.com/datasets/islombekdavronov/creditscoring-data/croissant/download",
        # Loan Eligibility (Gender, Marital Status, Dependents)
        # "https://www.kaggle.com/datasets/avineshprabhakaran/loan-eligibility-prediction/croissant/download",
        # Amazon Sales (Customer data)
        # "https://www.kaggle.com/datasets/rohiteng/amazon-sales-dataset/croissant/download",
        # "https://www.kaggle.com/datasets/ruthgn/bank-marketing-data-set/croissant/download"
        # "https://huggingface.co/api/datasets/AiresPucrs/german-credit-data/croissant"
        # "https://www.kaggle.com/datasets/taweilo/loan-approval-classification-data/croissant/download"
        # "https://www.kaggle.com/datasets/ahmadrafiee/bank-personal-loan/croissant/download"
        #"https://www.kaggle.com/datasets/rishikeshkonapure/home-loan-approval/croissant/download"

        # --- Law & Justice ---
        # Law School Admissions (Race, Gender, GPA)
        # "https://www.kaggle.com/datasets/danofer/law-school-admissions-bar-passage/croissant/download",
        # COMPAS (Recidivism - Race, Sex, Age - Famous bias dataset)
        # "https://www.kaggle.com/datasets/danofer/compass/croissant/download",
        # "https://www.kaggle.com/datasets/arsri1/arrest-data-in-los-angeles/croissant/download"
        # "https://www.kaggle.com/datasets/Connecticut-open-data/connecticut-inmates-awaiting-trial/croissant/download"
        # "https://www.kaggle.com/datasets/usdpic/execution-database/croissant/download"
        # "https://www.kaggle.com/datasets/melissamonfared/hate-crimes/croissant/download"
        # "https://www.kaggle.com/datasets/willianoliveiragibin/male-homicide-rate-2021/croissant/download"
        # "https://www.kaggle.com/datasets/mayureshkoli/police-deaths-in-usa-from-1791-to-2022/croissant/download"
        # "https://www.kaggle.com/datasets/econdata/predicting-parole-violators/croissant/download"
        # "https://www.kaggle.com/datasets/kindasomethin/prison-and-prisoners/croissant/download"

        # --- Out of Context ---
        # "https://www.kaggle.com/datasets/nadeemajeedch/employee-performance-and-salary-dataset/croissant/download"
        # "https://www.kaggle.com/datasets/joebeachcapital/30000-spotify-songs/croissant/download"
        # "https://www.kaggle.com/datasets/arshid/iris-flower-dataset/croissant/download"
        # "https://www.kaggle.com/datasets/aryan112345/best-selling-mobile-phones/croissant/download"
        # "https://www.kaggle.com/datasets/iamsouravbanerjee/computer-games-dataset/croissant/download"
        # "https://www.kaggle.com/datasets/ashishjangra27/geeksforgeeks-articles/croissant/download"
        # "https://www.kaggle.com/datasets/akoirala111/lego-sets/croissant/download"
        # "https://www.kaggle.com/datasets/shiivvvaam/pc-games/croissant/download"
        # "https://www.kaggle.com/datasets/sarveshchhetri/play-tennis-practice-dataset-for-classification/croissant/download"
        # "https://www.kaggle.com/datasets/nextmillionaire/programming-languages-trend-over-time/croissant/download"

    ]

    for url in DATASET_URLS:
        print("\n======================================")
        print(f"EXPERT MODE: Processing dataset at URL:\n{url}")
        print("======================================")

        dataset_report = run_expert_annotation_for_dataset(url)
        out_path = save_expert_annotations_json(dataset_report, output_dir="expert_annotations")
        print(f"\nSaved expert annotations to: {out_path}")


if __name__ == "__main__":
    main()