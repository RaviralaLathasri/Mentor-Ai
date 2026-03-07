# Deployment-Ready Guide

## 1. Backend (FastAPI)

### Local setup

```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python -m uvicorn app.main:app --reload --port 8000
```

API docs: `http://localhost:8000/docs`

### Production command

```bash
gunicorn -k uvicorn.workers.UvicornWorker -w 4 -b 0.0.0.0:8000 app.main:app
```

### Optional PostgreSQL

Set `DATABASE_URL` in `.env`:

```bash
DATABASE_URL=postgresql+psycopg2://USER:PASSWORD@HOST:5432/mentor_ai
```

Install driver if using PostgreSQL:

```bash
pip install psycopg2-binary
```

## 2. Frontend (React + Vite)

### Local setup

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

App URL: `http://localhost:5173`

### Production build

```bash
cd frontend
npm run build
npm run preview
```

Set API target in `frontend/.env`:

```bash
VITE_API_BASE_URL=https://your-backend-domain
```

## 3. End-to-end checklist

- Backend healthy: `GET /health`
- Create student: `POST /api/profile/create`
- Update profile: `PUT /api/profile/{student_id}`
- Mentor response: `POST /api/mentor/respond`
- Feedback loop: `POST /api/feedback/submit`
- Analytics bundle: `GET /api/analytics/dashboard/{student_id}`

## 4. Recommended hosting split

- Backend: Render, Railway, Fly.io, EC2, Azure App Service
- Frontend: Vercel, Netlify, Cloudflare Pages
- DB:
  - Dev: SQLite (`mentor_ai.db`)
  - Prod: PostgreSQL

## 5. Environment variables

### Backend (`.env`)

- `DATABASE_URL`
- `CORS_ALLOW_ORIGINS`
- `OPENAI_API_KEY` (optional)
- `OPENAI_API_BASE` (optional)
- `OPENAI_API_MODEL` (optional)

### Frontend (`frontend/.env`)

- `VITE_API_BASE_URL`
