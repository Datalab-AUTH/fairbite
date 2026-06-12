import textwrap
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from matplotlib.colors import to_rgb

SCRIPT_DIR = Path(__file__).resolve().parent
EVALUATION_DIR = SCRIPT_DIR.parent

PATH = EVALUATION_DIR / "evaluation_results" / "dataset_metrics.csv"
OUT_DIR = EVALUATION_DIR / "evaluation_results" / "main_metrics_plots"

# =====================================================
# STYLE SETTINGS
# =====================================================

AVERAGE_LINE_COLOR = "#2F2F2F"  # dark gray

CATEGORY_BASE_COLORS = {
    "education": "#B39DDB",  # pastel purple
    "employment": "#2E7D32",  # dark green
    "finance_and_consumer_behavior": "#1F4E79",  # dark blue
    "health_care": "#F28E2B",  # orange
    "law_and_criminal_justice": "#E78AC3",  # pink
    "out_of_context": "#B8860B",  # dark yellow
}

FALLBACK_CATEGORY_COLORS = [
    "#76B7B2",
    "#59A14F",
    "#EDC948",
    "#AF7AA1",
    "#FF9DA7",
    "#9C755F",
]

DATASET_LABEL_FONTSIZE = 64
VALUE_LABEL_FONTSIZE = 60
AXIS_LABEL_FONTSIZE = 66
TITLE_FONTSIZE = 68

LEGEND_FONTSIZE = 64
TICK_LABEL_FONTSIZE = 54

# Smaller bar height = more visible space between bars and dataset labels
BAR_HEIGHT = 0.52
BAR_SPACING = 1.35

MAX_LABEL_WIDTH = 48

plt.rcParams.update({
    "font.family": "serif",
    "axes.spines.top": False,
    "axes.spines.right": False,
    "axes.edgecolor": "0.25",
    "axes.linewidth": 0.8,
    "axes.titlesize": TITLE_FONTSIZE,
    "axes.labelsize": AXIS_LABEL_FONTSIZE,
    "xtick.labelsize": TICK_LABEL_FONTSIZE,
    "ytick.labelsize": DATASET_LABEL_FONTSIZE,
    "legend.fontsize": LEGEND_FONTSIZE,
    "pdf.fonttype": 42,
    "ps.fonttype": 42,
})


def format_domain_name(name):
    """
    Converts names like:
      finance_and_consumer_behavior -> Finance And Consumer Behavior
      health_care -> Health Care
      education -> Education
    """
    name = str(name).strip()
    name = name.replace("_", " ")
    name = " ".join(name.split())
    return name.title()


def clean_dataset_name(name):
    """
    Makes dataset names more readable in thesis figures.
    """
    name = str(name)
    name = name.replace("_", " ")
    name = name.replace(".csv", "")
    name = name.strip()
    return textwrap.fill(name, width=MAX_LABEL_WIDTH)


def clean_filename(name):
    """
    Creates safe filenames from dataset category names.
    """
    name = str(name).strip()
    name = name.replace(" ", "_")
    name = name.replace("/", "_")
    name = name.replace("\\", "_")
    return name


def load_metrics(path):
    """
    Loads dataset_metrics.csv and keeps only rows needed for plotting.
    """
    df = pd.read_csv(path)

    required_columns = [
        "dataset",
        "dataset_category",
        "f1_macro",
        "mae_category"
    ]

    missing_columns = [col for col in required_columns if col not in df.columns]

    if missing_columns:
        raise ValueError(
            f"Missing required columns in {path}: {missing_columns}"
        )

    df = df.dropna(
        subset=["dataset", "dataset_category", "f1_macro", "mae_category"]
    ).copy()

    return df


def make_category_color_map(dataset_categories):
    color_map = {}
    fallback_idx = 0

    for category in dataset_categories:
        if category in CATEGORY_BASE_COLORS:
            color_map[category] = CATEGORY_BASE_COLORS[category]
        else:
            color_map[category] = FALLBACK_CATEGORY_COLORS[
                fallback_idx % len(FALLBACK_CATEGORY_COLORS)
            ]
            fallback_idx += 1

    return color_map


def make_color_gradient(base_color, n):
    if n <= 1:
        return [base_color]

    base_rgb = np.array(to_rgb(base_color))
    white_rgb = np.array(to_rgb("#FFFFFF"))

    colors = []
    for strength in np.linspace(0.35, 1.0, n):
        colors.append(tuple((1 - strength) * white_rgb + strength * base_rgb))

    return colors


def plot_category(df, dataset_category, out_dir, category_colors):
    category_df = df[df["dataset_category"] == dataset_category].copy()

    if category_df.empty:
        return

    # Sort once by F1.
    # The MAE subplot uses the same dataset order.
    category_df = category_df.sort_values(
        "f1_macro",
        ascending=False
    ).reset_index(drop=True)

    domain_f1_mean = category_df["f1_macro"].mean()
    domain_mae_mean = category_df["mae_category"].mean()

    n_datasets = len(category_df)
    y = np.arange(n_datasets) * BAR_SPACING

    labels = [
        clean_dataset_name(x)
        for x in category_df["dataset"].tolist()
    ]

    f1_values = category_df["f1_macro"].tolist()
    mae_values = category_df["mae_category"].tolist()

    colors = make_color_gradient(category_colors[dataset_category], n_datasets)

    # Taller figure = more vertical distance between dataset labels
    fig_height = max(20, n_datasets * 2.2)

    fig, axes = plt.subplots(
        1,
        2,
        figsize=(48, fig_height),
        sharey=True,
        gridspec_kw={"wspace": 0.12}
    )

    ax_f1 = axes[0]
    ax_mae = axes[1]

    # =====================================================
    # LEFT SUBPLOT: F1 MACRO
    # =====================================================

    bars_f1 = ax_f1.barh(
        y,
        f1_values,
        height=BAR_HEIGHT,
        color=colors,
        edgecolor="none",
        alpha=0.95
    )

    ax_f1.set_yticks(y)
    ax_f1.set_yticklabels(
        labels,
        fontsize=DATASET_LABEL_FONTSIZE,
        ha="right"
    )

    ax_f1.invert_yaxis()

    ax_f1.axvline(
        domain_f1_mean,
        color=AVERAGE_LINE_COLOR,
        linestyle="--",
        linewidth=2.2,
        label=f"Domain F1 mean = {domain_f1_mean:.3f}"
    )

    ax_f1.set_title(
        "Macro F1-score",
        fontsize=TITLE_FONTSIZE,
        fontweight="bold",
        pad=34
    )

    ax_f1.set_xlabel(
        "Macro F1-score",
        fontsize=AXIS_LABEL_FONTSIZE,
        labelpad=26
    )

    ax_f1.grid(
        axis="x",
        linestyle=":",
        linewidth=0.8,
        alpha=0.45
    )

    ax_f1.set_axisbelow(True)

    f1_max = max(f1_values + [domain_f1_mean])
    ax_f1.set_xlim(0, max(1.08, f1_max * 1.15))

    f1_offset = ax_f1.get_xlim()[1] * 0.012

    for bar, val in zip(bars_f1, f1_values):
        ax_f1.text(
            bar.get_width() + f1_offset,
            bar.get_y() + bar.get_height() / 2,
            f"{val:.3f}",
            va="center",
            ha="left",
            fontsize=VALUE_LABEL_FONTSIZE
        )

    ax_f1.tick_params(axis="x", labelsize=TICK_LABEL_FONTSIZE)
    ax_f1.tick_params(axis="y", length=0, pad=22)

    # Individual legend below F1 subplot
    ax_f1.legend(
        loc="upper center",
        bbox_to_anchor=(0.5, -0.14),
        fontsize=LEGEND_FONTSIZE,
        frameon=True,
        framealpha=0.9,
        ncol=1
    )

    # =====================================================
    # RIGHT SUBPLOT: MAE CATEGORY
    # Same dataset order as F1
    # =====================================================

    bars_mae = ax_mae.barh(
        y,
        mae_values,
        height=BAR_HEIGHT,
        color=colors,
        edgecolor="none",
        alpha=0.95
    )

    # Dataset names appear only once on the left subplot.
    ax_mae.tick_params(
        axis="y",
        labelleft=False,
        labelright=False,
        length=0
    )

    ax_mae.axvline(
        domain_mae_mean,
        color=AVERAGE_LINE_COLOR,
        linestyle="--",
        linewidth=2.2,
        label=f"Domain MAE mean = {domain_mae_mean:.3f}"
    )

    ax_mae.set_title(
        "MAE Category",
        fontsize=TITLE_FONTSIZE,
        fontweight="bold",
        pad=34
    )

    ax_mae.set_xlabel(
        "MAE on Sensitivity Categories",
        fontsize=AXIS_LABEL_FONTSIZE,
        labelpad=26
    )

    ax_mae.grid(
        axis="x",
        linestyle=":",
        linewidth=0.8,
        alpha=0.45
    )

    ax_mae.set_axisbelow(True)

    mae_max = max(mae_values + [domain_mae_mean])
    ax_mae.set_xlim(0, mae_max * 1.20 if mae_max > 0 else 1)

    mae_offset = ax_mae.get_xlim()[1] * 0.012

    for bar, val in zip(bars_mae, mae_values):
        ax_mae.text(
            bar.get_width() + mae_offset,
            bar.get_y() + bar.get_height() / 2,
            f"{val:.3f}",
            va="center",
            ha="left",
            fontsize=VALUE_LABEL_FONTSIZE
        )

    ax_mae.tick_params(axis="x", labelsize=TICK_LABEL_FONTSIZE)

    # Individual legend below MAE subplot
    ax_mae.legend(
        loc="upper center",
        bbox_to_anchor=(0.5, -0.14),
        fontsize=LEGEND_FONTSIZE,
        frameon=True,
        framealpha=0.9,
        ncol=1
    )

    plt.subplots_adjust(
        left=0.34,
        right=0.98,
        top=0.94,
        bottom=0.36,
        wspace=0.12
    )

    safe_category = clean_filename(dataset_category)

    out_png = out_dir / f"metrics_for_dataset_domain_{safe_category}.png"
    out_pdf = out_dir / f"metrics_for_dataset_domain_{safe_category}.pdf"

    plt.savefig(out_png, dpi=400, bbox_inches="tight")
    plt.savefig(out_pdf, bbox_inches="tight")

    plt.close(fig)

    print(f"[OK] Saved:")
    print(f" - {out_png}")
    print(f" - {out_pdf}")


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    df = load_metrics(PATH)

    dataset_categories = sorted(
        df["dataset_category"].dropna().unique()
    )

    if not dataset_categories:
        print("No dataset categories found.")
        return

    category_colors = make_category_color_map(dataset_categories)

    for dataset_category in dataset_categories:
        plot_category(
            df=df,
            dataset_category=dataset_category,
            out_dir=OUT_DIR,
            category_colors=category_colors
        )

    print("\nDone.")
    print(f"Created plots for {len(dataset_categories)} dataset domains.")
    print(f"Output directory: {OUT_DIR}")


if __name__ == "__main__":
    main()
