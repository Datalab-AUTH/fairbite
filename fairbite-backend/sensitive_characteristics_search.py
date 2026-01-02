import time
import json
import os
import pandas as pd
import mlcroissant as mlc
from typing import Dict, List, Tuple, Optional

from google import genai
from google.genai import types as genai_types


GEMINI_CLIENT = genai.Client(api_key=os.environ["GEMINI_API_KEY"])


# Keep as key the name with fallback to id
def field_key(x):
    return getattr(x, "name", None) or getattr(x, "id", None)


def detect_sensitive_characteristics(
        ds_name, ds_description, rs, model: str = "gemini-2.5-flash"
):
    """
    For a given Croissant record set:
    - Ask Google's Gemini model to assign, for EACH column, a sensitivity percentage (0–100)
      based on discrimination/fairness-relevant attributes.
    - Also ask for a brief natural-language reason per column.
    - Returns: list[dict] with keys: "key", "sensitivity", "reason".
    """

    # Build column payload (original key + description if any)
    cols_payload = []
    for f in rs.fields:
        key = str(field_key(f))  # original key shown to the model; also used for filtering/ordering
        desc = getattr(f, "description", None) or "No column description found"
        cols_payload.append({"key": key, "description": desc})

    allowed_keys = [c["key"] for c in cols_payload]  # original order
    numbered = [{"index": i, **c} for i, c in enumerate(cols_payload)]

    dataset_name = ds_name or "Unnamed dataset"
    rs_description = getattr(rs, "description", None) or ""

    # System message: enforce JSON-only output
    system_msg = (
        "You are a careful, rule-following assistant. "
        "You MUST output valid JSON that exactly matches the requested schema, with no extra text."
    )

    # Prompt: taxonomy + normalization + scoring task
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

    # -------- Gemini call --------
    response = GEMINI_CLIENT.models.generate_content(
        model=model,
        contents=prompt,
        config=genai_types.GenerateContentConfig(
            temperature=0,
            top_p=1,
            response_mime_type="application/json",
            system_instruction=system_msg,
        ),
    )

    raw = response.text

    # Parse and validate
    try:
        obj = json.loads(raw)
    except Exception:
        first = raw.find("{")
        last = raw.rfind("}")
        if first != -1 and last != -1 and last > first:
            try:
                obj = json.loads(raw[first: last + 1])
            except Exception as e2:
                raise ValueError(
                    f"Could not parse JSON from model output. Raw (truncated): {raw}"
                ) from e2
        else:
            raise ValueError(
                f"Model output is not valid JSON. Raw (truncated): {raw}"
            )

    cols = obj.get("columns", [])
    if not isinstance(cols, list):
        cols = []

    by_key: dict[str, dict] = {}
    by_index: dict[int, dict] = {}

    for item in cols:
        if not isinstance(item, dict):
            continue
        key = item.get("key")
        idx = item.get("index")
        sens = item.get("sensitivity", 0)
        reason = item.get("reason", "")
        is_cat = item.get("is_categorical", False)

        if not isinstance(sens, (int, float)):
            sens = 0
        sens_int = int(round(sens))
        sens_int = max(0, min(100, sens_int))

        if not isinstance(reason, str) or not reason.strip():
            reason = "No clear reason provided by the model."

        if not isinstance(is_cat, bool):
            is_cat = False

        record = {
            "key": key,
            "sensitivity": sens_int,
            "reason": reason.strip(),
            "is_categorical": is_cat,
        }

        if isinstance(key, str):
            by_key[key] = record
        if isinstance(idx, int):
            by_index[idx] = record

    result = []
    for i, expected_key in enumerate(allowed_keys):
        rec = None

        if expected_key in by_key:
            rec = by_key[expected_key]
        elif i in by_index and by_index[i].get("key") in (None, expected_key):
            rec = by_index[i]

        if rec is None:
            rec = {
                "key": expected_key,
                "sensitivity": 0,
                "reason": "Model did not provide a score for this column.",
            }

        rec["key"] = expected_key
        result.append(rec)

    return result


def load_croissant_dataset(
        croissant_path: str,
) -> Tuple[dict, Optional["mlc.Dataset"], Optional[List]]:
    """
    Load a Croissant dataset and return:

    - dataset_entry: base dict with dataset-level metadata (may contain an "error" key)
    - croissant_dataset: the loaded mlc.Dataset instance, or None on failure
    - record_sets: list of record sets (meta.record_sets), or None on failure
    """
    print("\nLoading Croissant file...")
    dataset_entry: dict = {
        "croissant_url": croissant_path,
        "dataset_name": None,
        "description": None,
        "data_biases": None,
        "sensitive_information": None,
        "recordsets": [],
    }

    try:
        croissant_dataset = mlc.Dataset(croissant_path)
    except Exception as e:
        print(
            f"Loading failed. {croissant_path} does not lead to a Croissant file. Error: {e}"
        )
        dataset_entry["error"] = f"Loading failed: {str(e)}"
        return dataset_entry, None, None

    # Metadata
    meta = croissant_dataset.metadata

    dataset_name = getattr(meta, "name", None) or "No name found"
    dataset_description = (
            getattr(meta, "description", None) or "No dataset description found."
    )
    data_biases = getattr(meta, "rai:dataBiases", None) or "No data biases found."
    sensitive_information = (
            getattr(meta, "rai:personalSensitiveInformation", None)
            or "No personal sensitive information found."
    )

    dataset_entry["dataset_name"] = dataset_name
    dataset_entry["description"] = dataset_description
    dataset_entry["data_biases"] = data_biases
    dataset_entry["sensitive_information"] = sensitive_information

    record_sets = meta.record_sets

    print("──────────── Dataset ────────────")
    print(f"• Name: \"{dataset_name}\"")
    print(f"• Available RecordSets: ", [field_key(rs) for rs in record_sets])
    print(f"• Data Biases: \"{data_biases}\"")
    print(f"• Personal Sensitive Information: \"{sensitive_information}\"")
    print("─────────────────────────────────")

    return dataset_entry, croissant_dataset, record_sets


def build_recordset_dataframes(
        croissant_dataset: "mlc.Dataset",
        record_sets: List,
) -> Dict[str, pd.DataFrame]:
    """
    Load each record set into a pandas DataFrame, print a preview, and
    return a dict: {recordset_name: DataFrame}.
    """
    dfs: Dict[str, pd.DataFrame] = {}

    for rs in record_sets:
        rs_key = field_key(rs) or "No name found"
        rs_description = getattr(rs, "description", None) or "No description found"
        print(f"\nLoading RecordSet: {rs_key}")

        try:
            df = pd.DataFrame(croissant_dataset.records(record_set=rs.id))

            # Rename columns using their names (if they exist)
            mapping = {f.id: field_key(f) for f in rs.fields}
            df = df.rename(columns=mapping)

            dfs[rs_key] = df

        except Exception:
            print(f"   RecordSet {rs_key} could not be loaded as a dataframe.")
            continue

        fields = rs.fields

        print("   ▶ Preview:")
        print(f"      • Shape: {df.shape}")
        print(f"      • Description: {rs_description}")

        if not fields:
            print("      • No columns found")
        else:
            print("      • Columns: ")
            for f in fields:
                col_name = str(field_key(f)) if field_key(f) else "No name found"
                desc = getattr(f, "description", None)
                col_desc = (
                    desc.strip()
                    if isinstance(desc, str) and desc.strip()
                    else "No description found"
                )
                print(f"         - Name: {col_name} — Description: {col_desc}")

    return dfs


def run_sensitive_attribute_search(
        dataset_name: str,
        dataset_description: str,
        record_sets: List,
) -> List[dict]:
    """
    Run the LLM-based sensitive attribute search for each record set.

    Returns a list of recordset_entry dicts:

    {
      "recordset_name": ...,
      "recordset_description": ...,
      "results": [...],  # output of detect_sensitive_characteristics
      "error": ...,
      "execution_time_seconds": ...
    }
    """
    print("\nStarting sensitive attribute search...")
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
            print(f"    ▶ Asking LLM for record set: {rs_key}")
            start = time.perf_counter()
            col_reports = detect_sensitive_characteristics(
                dataset_name, dataset_description, rs
            )
            end = time.perf_counter()

            duration = end - start
            print(f"      Execution time: {duration:.3f} seconds")

            # Pretty-print sorted results
            col_reports_sorted = sorted(
                col_reports, key=lambda x: x["sensitivity"], reverse=True
            )
            for r in col_reports_sorted:
                print(f"      - {r['key']}: {r['sensitivity']}%  |  {r['reason']}")

            recordset_entry["results"] = col_reports
            recordset_entry["execution_time_seconds"] = duration

        except Exception as e:
            print("LLM error:", e)
            recordset_entry["error"] = f"LLM error: {str(e)}"

        recordset_entries.append(recordset_entry)

    return recordset_entries


def process_single_dataset(
        croissant_path: str,
) -> Tuple[dict, Dict[str, pd.DataFrame]]:
    """
    Orchestrator function.

    Returns:
      - dataset_entry: dict with dataset metadata and per-recordset analysis results
      - dfs: dict[str, pd.DataFrame] with loaded dataframes per record set
    """
    dataset_entry, croissant_dataset, record_sets = load_croissant_dataset(
        croissant_path
    )

    # If loading failed, we return early with empty dataframes.
    if croissant_dataset is None or record_sets is None:
        return dataset_entry, {}

    # 1) Build dataframes for each record set
    dfs = build_recordset_dataframes(croissant_dataset, record_sets)

    # 2) Run sensitive attribute search
    recordset_entries = run_sensitive_attribute_search(
        dataset_name=dataset_entry["dataset_name"],
        dataset_description=dataset_entry["description"],
        record_sets=record_sets,
    )

    # 3) Attach analysis results to dataset_entry
    dataset_entry["recordsets"] = recordset_entries

    # 4) Return both the structured results and the dataframes
    return dataset_entry, dfs


def get_sensitive_categorical_fields(
        dataset_report: dict,
        sensitivity_threshold: int = 60,
) -> Dict[str, List[str]]:
    """
    Given a dataset_report (from process_single_dataset), return a dict:

    {
      "recordset_name_1": ["col_a", "col_b", ...],
      "recordset_name_2": ["col_x", ...],
      ...
    }

    Only includes columns where:
      - sensitivity >= sensitivity_threshold
      - is_categorical == True
    """
    result: Dict[str, List[str]] = {}

    for rs_entry in dataset_report.get("recordsets", []):
        rs_name = rs_entry.get("recordset_name")
        if not rs_name:
            continue

        cols_over_threshold: List[str] = []

        for col_report in rs_entry.get("results") or []:
            sensitivity = col_report.get("sensitivity", 0)
            is_cat = col_report.get("is_categorical", False)
            key = col_report.get("key")

            if key is None:
                continue

            if sensitivity >= sensitivity_threshold and is_cat:
                cols_over_threshold.append(key)

        if cols_over_threshold:
            result[rs_name] = cols_over_threshold

    return result