import pandas as pd
import matplotlib.pyplot as plt
import numpy as np

PATH = "evaluation_results/confusion_matrix_ALL.csv"

df = pd.read_csv(PATH, index_col=0)
cm = df.values

labels = [1, 2, 3, 4, 5]

# Larger figure to accommodate big fonts
fig, ax = plt.subplots(figsize=(10, 8))

im = ax.imshow(cm, cmap="Blues")

# Colorbar
cbar = fig.colorbar(im, ax=ax)
cbar.ax.tick_params(labelsize=16)

# Ticks
ax.set_xticks(range(5))
ax.set_yticks(range(5))
ax.set_xticklabels(labels, fontsize=20)
ax.set_yticklabels(labels, fontsize=20)

# Axis labels
ax.set_xlabel("Predicted Category", fontsize=24, labelpad=15)
ax.set_ylabel("True Category", fontsize=24, labelpad=15)

# Title with spacing
ax.set_title(
    "Confusion Matrix – All Datasets (Categories 1–5)",
    fontsize=28,
    pad=25
)

# Numbers inside cells
max_val = cm.max()
for i in range(5):
    for j in range(5):
        val = cm[i, j]
        color = "white" if val > max_val * 0.6 else "black"
        ax.text(j, i, str(val),
                ha="center",
                va="center",
                fontsize=20,
                color=color)

# Automatic layout adjustment
plt.tight_layout(pad=2)

plt.savefig("confusion_matrix_all.png", dpi=300, bbox_inches="tight")
plt.savefig("confusion_matrix_all.pdf", dpi=300, bbox_inches="tight")

plt.show()