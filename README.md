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
python -m uvicorn app.main:app --reload --port 8000
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

## Deployment

See [DEPLOYMENT_READY_GUIDE.md](DEPLOYMENT_READY_GUIDE.md) for production deployment steps.
