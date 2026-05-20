# FairBite

<div style="display:flex;align-items:center;gap:24px;">
<blockquote style="flex:1;margin:0;">
> FairBite is a dataset-level representation bias auditing tool for dataset owners, data scientists, and ML teams. It identifies sensitive attributes, evaluates subgroup coverage, and helps find representation gaps before model training.
</blockquote>
<img src="fairbite-frontend/src/icons/FairBiteIcon-circle.svg" alt="FairBite Logo" style="width:120px;height:auto;border-radius:50%;background:#ffffff;padding:8px;" />
</div>

## Overview

This repository is a monorepo containing:

- `fairbite-frontend/` — React web application for dataset review and audit workflows.
- `fairbite-backend/` — FastAPI backend for dataset ingestion, sensitive characteristic analysis, and representation audit orchestration.
- `evaluation/` — dataset metadata, expert annotations, and sensitive attribute evaluation artifacts.

FairBite uses Google Geminis's model `gemini-2.5-flash` to identify and score sensitive dataset columns during the backend data-processing pipeline.

## Installing / Getting started

### Prerequisites

- Node.js and npm for frontend development.
- Python 3.11+ for the backend.
- A Google GenAI API key stored in `GEMINI_API_KEY`.

### Setup

1. Clone the repository:

```powershell
git clone https://github.com/your-org/fairbite.git
cd fairbite
```

2. Install backend dependencies:

```powershell
cd fairbite-backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

3. Install frontend dependencies:

```powershell
cd ..\fairbite-frontend
npm install
```

### Environment

Create a `.env` file in `fairbite-backend/` or set the environment variable directly:

```powershell
$env:GEMINI_API_KEY = "your_api_key_here"
```

## Developing

### Start backend

From `fairbite-backend/`:

```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The backend exposes endpoints for dataset ingestion, status checks, reports, and representation audits.

### Start frontend

From `fairbite-frontend/`:

```powershell
npm start
```

The React app will launch on `http://localhost:3000` and communicate with the backend.

## Building

Build the frontend production bundle from `fairbite-frontend/`:

```powershell
npm run build
```

There is no centralized root build command; the frontend and backend are managed separately inside the monorepo.

## Project structure

- `fairbite-frontend/` — React SPA, component files, icons, and UI assets.
- `fairbite-backend/` — FastAPI server, dataset processing service, and Google Gemini integration.
- `evaluation/` — results, expert annotations, and scripts used for dataset evaluation.

## Backend API

Key backend endpoints:

- `GET /health` — health check.
- `POST /datasets` — submit a Croissant dataset URL for processing.
- `GET /datasets/{dataset_id}` — check dataset processing status.
- `GET /datasets/{dataset_id}/report` — retrieve the completed dataset report.
- `POST /datasets/{dataset_id}/representation-audit` — run a representation audit on a completed dataset.
- `GET /representation-audits/{audit_id}` — check audit status.
- `GET /representation-audits/{audit_id}/results` — retrieve audit results.

## Model and AI usage

FairBite’s backend uses the Google Gemini model `gemini-2.5-flash` for sensitive characteristic detection. This exact model is configured in `fairbite-backend/sensitive_characteristics_search.py` and powers the dataset column scoring workflow.

## Notes

- This repository is intentionally structured as a monorepo.
- The frontend and backend are developed and run separately.
- The backend requires a valid Google GenAI key to call `gemini-2.5-flash`.
