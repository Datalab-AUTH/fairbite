# FairBite

![FairBite Logo](fairbite-frontend/src/icons/FairBiteIcon-circle.svg)

> FairBite is a dataset-level representation bias auditing tool for dataset owners, data scientists, and ML teams. It identifies sensitive attributes, evaluates subgroup coverage, and helps find representation gaps before model training.

## Overview

This repository is a monorepo containing:

- `fairbite-frontend/` — React web application for dataset review and audit workflows.
- `fairbite-backend/` — FastAPI backend for dataset ingestion, sensitive characteristic analysis, and representation audit orchestration.
- `evaluation/` — expert annotations, sensitive attribute evaluation artifacts, and evaluation results.

FairBite uses a configurable LLM to identify and score sensitive dataset columns during the backend data-processing pipeline. The provider, model, and API key are set via environment variables — no code changes needed to switch between providers.

## Installing / Getting started

### Prerequisites

- Node.js and npm for frontend development.
- Python 3.11+ for the backend.
- An API key for your chosen LLM provider (not required for Ollama).

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

Copy `fairbite-backend/.env.example` to `fairbite-backend/.env` and fill in the values for your chosen provider:

```powershell
cp fairbite-backend/.env.example fairbite-backend/.env
```

The required variables are:

| Variable | Description |
|---|---|
| `LLM_PROVIDER` | Provider name: `gemini`, `openai`, `anthropic`, or `ollama` |
| `LLM_MODEL` | Model name as accepted by the provider (e.g. `gemini-2.5-flash`, `gpt-4o`, `mistral`) |
| `LLM_API_KEY` | API key for the provider — not required for Ollama |
| `LLM_TEMPERATURE` | Sampling temperature (default: `0`) |
| `OLLAMA_BASE_URL` | Ollama server URL (default: `http://localhost:11434`) — only for Ollama |

See `fairbite-backend/.env.example` for ready-to-use examples for each provider.

## Running With Docker

The Docker setup uses only `fairbite-backend/` and `fairbite-frontend/` as build
contexts. The `evaluation/` directory is not copied into either image.

From the repository root:

```powershell
docker compose up --build
```

Then open:

- Frontend: `http://localhost:3000`
- Backend health check: `http://localhost:8000/health`

The frontend image is built with `REACT_APP_API_BASE=http://localhost:8000` by
default. To point it at a different backend URL, rebuild with:

```powershell
$env:REACT_APP_API_BASE = "http://your-backend-host:8000"
docker compose up --build
```

To stop the app:

```powershell
docker compose down
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

## LLM configuration

FairBite supports multiple LLM providers out of the box: **Google Gemini**, **OpenAI**, **Anthropic**, and **Ollama** (local). The provider is selected at runtime via the `LLM_PROVIDER` environment variable — no code changes needed.

### Switching providers

Edit `fairbite-backend/.env` and set `LLM_PROVIDER`, `LLM_MODEL`, and `LLM_API_KEY`. Restart the backend.

### Adding a new provider

If the provider you want is not in the list above, you can add it in two steps inside `fairbite-backend/llm_provider.py`:

**1. Create a class that extends `LLMProvider`:**

```python
class MyProvider(LLMProvider):
    def __init__(self):
        # Initialize your client here using os.environ values
        self._client = MySDK(api_key=os.environ["LLM_API_KEY"])
        self._model = os.environ["LLM_MODEL"]

    def _generate(self, prompt: str, system_msg: str) -> str:
        # Call your provider’s API and return the raw response as a string
        response = self._client.complete(model=self._model, prompt=prompt)
        return response.text
```

Note: implement `_generate`, not `generate_content`. The base class wraps `_generate` to automatically strip `<think>...</think>` blocks produced by reasoning models.

**2. Register it in the `PROVIDERS` dict:**

```python
PROVIDERS = {
    "gemini": GeminiProvider,
    "openai": OpenAIProvider,
    "anthropic": AnthropicProvider,
    "ollama": OllamaProvider,
    "myprovider": MyProvider,  # add your entry here
}
```

Then set `LLM_PROVIDER=myprovider` in `.env` and restart.

## Notes

- This repository is intentionally structured as a monorepo.
- The frontend and backend are developed and run separately.
- When using Ollama with Docker, set `OLLAMA_BASE_URL=http://host.docker.internal:11434` so the container can reach the host.
