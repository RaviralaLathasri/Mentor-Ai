# Mentor AI

Production-ready full-stack AI Mentor system with FastAPI + SQLite backend and React frontend.

## Core capabilities

- Student profile management (skills, interests, goals, confidence)
- Weakness-first concept analyzer
- Socratic mentor chat responses
- Human-in-the-loop feedback (`helpful`, `too_easy`, `too_hard`, `unclear`)
- Adaptive learning loop (difficulty + confidence + concept focus)
- Explain-my-mistake workflow with guiding follow-up question
- Learning analytics (feedback distribution, performance trend, weakness graph, recommendations)

## Tech stack

- Backend: FastAPI, SQLAlchemy, SQLite (optional PostgreSQL)
- Frontend: React + Vite
- Charts: Recharts

## Project layout

```text
app/
  main.py
  database.py
  schemas.py
  services/
  routes/
frontend/
  src/
    pages/
    components/
    services/
    hooks/
```

## Quick start

### Backend

```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python -m uvicorn main:app --reload --port 8000
```

Backend docs: `http://localhost:8000/docs`

### Frontend

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

Frontend app: `http://localhost:5173`

## Mentor answer quality troubleshooting

If mentor answers look generic:

1. Confirm `.env` has a valid LLM key/base.
2. Restart backend after `.env` changes.
3. Watch backend logs while asking a question.

If you see this warning, the app is using local fallback templates:

```text
[WARN] LLM response failed; falling back to local templates.
```

Recommended OpenRouter env values:

```env
OPENAI_API_BASE=https://openrouter.ai/api/v1
OPENAI_API_MODEL=openrouter/auto
```

## Deployment

### Production start command

```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

### Docker (backend)

```bash
docker build -t mentor-ai-backend .
docker run --rm -p 8000:8000 -e PORT=8000 --env-file .env mentor-ai-backend
```

When deployed with the root `Dockerfile`, the build also compiles the React app and the backend serves it from `/` (API stays under `/api`).

See [DEPLOYMENT_READY_GUIDE.md](DEPLOYMENT_READY_GUIDE.md) for production deployment steps.
