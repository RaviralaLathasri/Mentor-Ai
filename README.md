# 🎓 Mentor AI

> **Production-Ready AI Mentor System with Adaptive Learning**
>
> A full-stack intelligent tutoring platform powered by AI, featuring real-time adaptive learning, audio-based interviews, comprehensive analytics, and human-in-the-loop feedback mechanisms.

[![GitHub](https://img.shields.io/badge/GitHub-Mentor%20AI-blue?style=flat-square&logo=github)](https://github.com/RaviralaLathasri/Mentor-Ai.git)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.9+-blue?style=flat-square&logo=python)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-green?style=flat-square)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18.2-61dafb?style=flat-square&logo=react)](https://react.dev/)

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [API Documentation](#-api-documentation)
- [Architecture](#-architecture)
- [Screenshots](#-screenshots)
- [Future Improvements](#-future-improvements)
- [Contributing](#-contributing)
- [Author](#-author)
- [License](#-license)

---

## ✨ Features

### Core Learning Features
- 🎯 **Adaptive Difficulty** - Automatically adjusts learning difficulty based on student performance
- 🧠 **Weakness-First Learning** - Identifies and prioritizes weak concepts
- 💬 **Socratic Mentoring** - AI-powered conversational feedback with guiding questions
- 📊 **Learning Analytics** - Real-time dashboard with performance metrics and trends
- 🔄 **Human-in-the-Loop** - Feedback mechanism for continuous improvement (`helpful`, `too_easy`, `too_hard`, `unclear`)

### Advanced Features
- 🎤 **Audio Interview System** - Real-time transcription and evaluation using STT/TTS
- 📝 **Mistake Analysis** - Detailed breakdown of errors with guidance
- 🚀 **Career Roadmap** - Personalized career path recommendations
- 📄 **Resume Mentor** - AI-powered resume optimization and feedback
- 🏥 **Wellness Tracking** - Student wellness metrics and support
- 📈 **Performance Insights** - Deep analytics and recommendation engine

### Technical Features
- 🗄️ **SQLite/PostgreSQL** - Flexible database support
- 🔐 **CORS Enabled** - Secure cross-origin requests
- 📝 **Comprehensive Logging** - Detailed system and request logging
- 🐳 **Docker Ready** - Production-grade containerization
- ☁️ **Cloud Deployment** - Optimized for Heroku, Railway, and other platforms
- 🎨 **Modern UI** - Responsive React + Vite frontend

---

## 🛠️ Tech Stack

### Backend
| Technology | Purpose | Version |
|-----------|---------|---------|
| **FastAPI** | Web framework | 0.111.0 |
| **SQLAlchemy** | ORM | 2.0.30 |
| **Pydantic** | Data validation | 2.7.1 |
| **Uvicorn** | ASGI server | 0.30.1 |
| **Redis** | Session/cache store | 5.0.4 |
| **OpenAI API** | LLM integration | 1.35.0 |
| **scikit-learn** | ML algorithms | 1.5.0 |
| **python-dotenv** | Environment config | 1.0.1 |

### Frontend
| Technology | Purpose | Version |
|-----------|---------|---------|
| **React** | UI framework | 18.2.0 |
| **Vite** | Build tool | 5.0.8 |
| **React Router** | Navigation | 6.20.0 |
| **Axios** | HTTP client | 1.6.2 |
| **Recharts** | Data visualization | 2.12.7 |

### DevOps & Deployment
| Technology | Purpose |
|-----------|---------|
| **Docker** | Containerization |
| **Python-multipart** | File upload handling |
| **Email-validator** | Email validation |

---

## 📁 Project Structure

```
Mentor-Ai/
├── app/                              # Backend application
│   ├── main.py                      # FastAPI app entry point
│   ├── database.py                  # Database configuration & models
│   ├── schemas.py                   # Pydantic validation schemas
│   ├── logging_setup.py             # Logging configuration
│   ├── devserver.py                 # Development server utilities
│   │
│   ├── routes/                      # API endpoint routers
│   │   ├── profiles.py              # Student profile management
│   │   ├── mentor_ai.py             # Core mentor chatbot
│   │   ├── feedback_loop.py         # Feedback & rating system
│   │   ├── adaptive.py              # Adaptive learning engine
│   │   ├── explain_mistakes.py      # Error analysis & guidance
│   │   ├── analytics.py             # Learning analytics
│   │   ├── audio_interview.py       # Audio interview system
│   │   ├── career.py                # Career roadmap generation
│   │   ├── resume.py                # Resume optimization
│   │   ├── wellness.py              # Wellness tracking
│   │   └── interview.py             # Interview management
│   │
│   ├── services/                    # Business logic layer
│   │   ├── interview.py             # Interview service
│   │   ├── career_roadmap.py        # Career planning service
│   │   └── resume_insights.py       # Resume analysis service
│   │
│   ├── audio_interview/             # Audio processing
│   │   ├── interview_engine.py      # Core interview logic
│   │   ├── interview_router.py      # Interview routing
│   │   ├── evaluation_engine.py     # Performance evaluation
│   │   ├── memory_store.py          # Session memory
│   │   ├── redis_manager.py         # Redis integration
│   │   ├── stt_service.py           # Speech-to-text
│   │   └── tts_service.py           # Text-to-speech
│   │
│   └── utils/                       # Utilities
│       └── openai_client.py         # OpenAI API wrapper
│
├── frontend/                         # React frontend
│   ├── package.json                 # Frontend dependencies
│   ├── vite.config.js               # Vite configuration
│   ├── index.html                   # HTML entry point
│   │
│   └── src/
│       ├── main.jsx                 # React entry point
│       ├── App.jsx                  # Root component
│       ├── App.css                  # Global styles
│       ├── index.css                # Base styles
│       │
│       ├── components/              # Reusable UI components
│       │   ├── Navbar.jsx           # Navigation bar
│       │   ├── Alert.jsx            # Alert notifications
│       │   ├── LoadingSpinner.jsx   # Loading indicator
│       │   ├── PageShell.jsx        # Page wrapper
│       │   ├── StudentBanner.jsx    # Student info display
│       │   ├── StatCard.jsx         # Stat display card
│       │   ├── RecommendationCard.jsx # Recommendations
│       │   ├── FeedbackButtons.jsx  # Feedback rating
│       │   │
│       │   └── interview/           # Interview UI components
│       │       ├── AudioRecorder.jsx
│       │       ├── LiveTranscript.jsx
│       │       ├── QuestionPlayer.jsx
│       │       └── InterviewReport.jsx
│       │
│       ├── pages/                   # Page components
│       │   ├── Home.jsx             # Landing page
│       │   ├── Dashboard.jsx        # Main dashboard
│       │   ├── Profile.jsx          # Student profile
│       │   ├── Chat.jsx             # Mentor chat
│       │   ├── AnalyticsDashboard.jsx # Performance analytics
│       │   ├── CareerRoadmap.jsx    # Career planning
│       │   ├── ResumeMentor.jsx     # Resume optimization
│       │   ├── WeaknessAnalyzer.jsx # Weakness analysis
│       │   ├── ExplainMistake.jsx   # Error explanation
│       │   └── InterviewPage.jsx    # Audio interviews
│       │
│       ├── hooks/                   # Custom React hooks
│       │   ├── useApiData.js        # API data fetching
│       │   └── useStudentId.js      # Student ID management
│       │
│       ├── services/                # Frontend services
│       │   └── api.js               # API client configuration
│       │
│       └── static/                  # Static assets
│           └── style.css            # Additional styles
│
├── scripts/                         # Development scripts
│   ├── dev_backend.ps1              # Backend startup script (Windows)
│   └── dev_redis.ps1                # Redis startup script (Windows)
│
├── Configuration & Documentation
│   ├── .env.example                 # Environment variables template
│   ├── .gitignore                   # Git ignore rules
│   ├── .dockerignore                # Docker ignore rules
│   ├── Dockerfile                   # Docker configuration
│   ├── Procfile                     # Heroku deployment config
│   ├── requirements.txt             # Python dependencies
│   ├── logging.json                 # Logging configuration
│   │
│   └── Documentation Files
│       ├── README.md                # This file
│       ├── ARCHITECTURE.md          # Technical architecture details
│       ├── ARCHITECTURE_VISUAL.md   # Visual architecture diagrams
│       ├── QUICKSTART.md            # Quick start guide
│       ├── DEPLOYMENT_GUIDE.md      # Deployment instructions
│       ├── DEPLOYMENT_READY_GUIDE.md # Production checklist
│       ├── DEVELOPER_REFERENCE.md   # Developer API reference
│       ├── PROFILE_DATA_USAGE.md    # Data privacy & usage
│       ├── DOCUMENTATION_INDEX.md   # Documentation index
│       ├── COMPLETION_CHECKLIST.md  # Feature completion status
│       ├── PROJECT_DELIVERY.md      # Project delivery status
│       ├── STATUS.md                # Current status
│       └── INDEX.md                 # Project index
│
└── Test Files
    ├── test_api.py                  # API endpoint tests
    ├── test_chatbot_fixed.py        # Chatbot tests
    ├── test_chatbot_variety.py      # Chatbot variety tests
    ├── test_data_analyst.py         # Data analysis tests
    ├── test_full_flow.py            # End-to-end flow tests
    ├── test_gradient_descent.py     # Algorithm tests
    ├── test_integration.py          # Integration tests
    └── main.py                      # ASGI entry point
```

---

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

### Required
- **Python 3.9+** - Download from [python.org](https://www.python.org/)
- **Node.js 16+** - Download from [nodejs.org](https://nodejs.org/)
- **npm** or **yarn** - Comes with Node.js

### Optional (for development)
- **Redis** - For session management ([redis.io](https://redis.io/))
- **Docker** - For containerized deployment ([docker.com](https://docker.com/))
- **Git** - For version control ([git-scm.com](https://git-scm.com/))

### API Requirements
- **OpenAI API Key** or **OpenRouter Account** - For LLM integration
  - Get OpenAI key: https://platform.openai.com/api-keys
  - Or use OpenRouter: https://openrouter.ai/

---

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/RaviralaLathasri/Mentor-Ai.git
cd Mentor-Ai
```

### 2. Backend Setup

#### Create Virtual Environment
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

#### Install Dependencies
```bash
pip install -r requirements.txt
```

#### Configure Environment Variables
```bash
# Copy example configuration
copy .env.example .env  # Windows
# or
cp .env.example .env   # macOS/Linux

# Edit .env with your configuration
# Required: Set your OPENAI_API_KEY or OPENROUTER credentials
```

#### Initialize Database
```bash
# Database will be auto-initialized on first run
# To reset database:
python -c "from app.database import init_db; init_db()"
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Copy environment configuration
copy .env.example .env  # Windows
# or
cp .env.example .env   # macOS/Linux
```

### 4. Start Development Servers

#### Backend (Terminal 1)
```bash
# From project root
python -m uvicorn main:app --reload --port 8000
```

#### Frontend (Terminal 2)
```bash
cd frontend
npm run dev
```

#### Optional: Redis Setup (Terminal 3)
For audio interview features on Windows:
```bash
powershell -ExecutionPolicy Bypass -File scripts\dev_redis.ps1
```

---

## ⚙️ Configuration

### Environment Variables (.env)

Create a `.env` file in the project root. See `.env.example` for all options:

```env
# Database Configuration
DATABASE_URL=sqlite:///./mentor_ai.db
# For PostgreSQL: postgresql://user:password@localhost/dbname

# CORS Configuration
CORS_ALLOW_ORIGINS=http://localhost:5173,http://localhost:3000

# LLM Provider (Choose one)
OPENAI_API_KEY=your_api_key_here
OPENAI_API_BASE=https://api.openai.com/v1
# OR for OpenRouter:
OPENAI_API_BASE=https://openrouter.ai/api/v1
OPENAI_API_MODEL=openrouter/auto

# Logging Level
LOG_LEVEL=INFO

# Redis Configuration (for audio interviews)
REDIS_URL=redis://127.0.0.1:6379/0
INTERVIEW_STORE_BACKEND=redis  # or "memory" for development
```

### Database Options

#### SQLite (Default - Development)
```env
DATABASE_URL=sqlite:///./mentor_ai.db
```

#### PostgreSQL (Production)
```env
DATABASE_URL=postgresql://username:password@localhost:5432/mentor_ai
```

---

## 💻 Usage

### Access the Application

- **Frontend**: http://localhost:5173
- **Backend API Docs**: http://localhost:8000/docs
- **Backend ReDoc**: http://localhost:8000/redoc

### Key Workflows

#### 1. Student Profile Setup
1. Navigate to Profile page
2. Enter name, skills, interests, goals
3. Set confidence level
4. System adapts based on profile

#### 2. Mentor Chat
1. Go to Chat page
2. Ask questions or describe concepts
3. Receive Socratic mentoring responses
4. Rate response quality (helpful/too_easy/too_hard/unclear)
5. Analytics track improvement

#### 3. Audio Interview
1. Navigate to Interview section
2. Click "Start Interview"
3. Speak and system transcribes in real-time
4. Get instant evaluation
5. Review interview report

#### 4. View Analytics
1. Go to Analytics Dashboard
2. See performance trends
3. View weakness analysis
4. Get personalized recommendations

### API Usage Examples

#### Get Student Profile
```bash
curl -X GET http://localhost:8000/api/profiles/1
```

#### Submit Feedback
```bash
curl -X POST http://localhost:8000/api/feedback/submit \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": 1,
    "response_id": 1,
    "feedback_type": "helpful"
  }'
```

#### Start Interview
```bash
curl -X POST http://localhost:8000/api/audio/start \
  -H "Content-Type: application/json" \
  -d '{"student_id": 1}'
```

For complete API documentation, visit http://localhost:8000/docs

---

## 📚 API Documentation

### Base URL
- Development: `http://localhost:8000/api`
- Production: `https://your-domain.com/api`

### Main Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/profiles/create` | Create student profile |
| `GET` | `/profiles/{student_id}` | Get student profile |
| `POST` | `/mentor/chat` | Send message to mentor |
| `POST` | `/feedback/submit` | Submit response feedback |
| `GET` | `/analytics/dashboard/{student_id}` | Get analytics dashboard |
| `POST` | `/audio/start` | Start audio interview |
| `POST` | `/audio/submit` | Submit audio response |
| `GET` | `/career/roadmap/{student_id}` | Get career roadmap |
| `POST` | `/resume/analyze` | Analyze resume |

For full API documentation:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

---

## 🏗️ Architecture

### Design Principles

1. **Separation of Concerns**
   - Models: ORM definitions
   - Schemas: Pydantic validation
   - Services: Business logic
   - Routers: HTTP endpoints

2. **Modular Architecture**
   - Independent feature routers
   - Dependency injection via FastAPI
   - Service-based business logic
   - Testable components

3. **Scalability**
   - Stateless services
   - Database-backed state
   - Redis for distributed caching
   - Docker containerization

### Data Flow Diagram

```
Client (React Frontend)
    ↓
API Request (Axios)
    ↓
FastAPI Router (HTTP endpoint)
    ↓
Service Layer (Business logic)
    ↓
Database Layer (SQLAlchemy ORM)
    ↓
SQLite/PostgreSQL
```

### System Components

```
┌─────────────────────────────────────────────┐
│         React Frontend (Vite)              │
│  - Dashboard, Chat, Analytics, Interviews  │
└────────────────┬────────────────────────────┘
                 │ Axios HTTP
                 ↓
┌─────────────────────────────────────────────┐
│         FastAPI Backend                    │
│  - Routes, Services, Database Layer        │
│  - CORS enabled, JWT authentication ready  │
└────────────────┬────────────────────────────┘
                 │ SQLAlchemy ORM
                 ↓
┌─────────────────────────────────────────────┐
│      SQLite/PostgreSQL Database            │
│  - Student profiles, feedback, analytics   │
└─────────────────────────────────────────────┘
                 
┌─────────────────────────────────────────────┐
│         External Services                  │
│  - OpenAI/OpenRouter (LLM)                 │
│  - Redis (Session storage)                 │
│  - STT/TTS (Audio processing)              │
└─────────────────────────────────────────────┘
```

For detailed architecture documentation, see [ARCHITECTURE.md](ARCHITECTURE.md)

---

## 📸 Screenshots

### Dashboard
```
[Screenshot Placeholder - Dashboard with student stats and recommendations]
```

### Mentor Chat
```
[Screenshot Placeholder - Interactive chat interface with Socratic responses]
```

### Analytics
```
[Screenshot Placeholder - Performance charts and weakness visualization]
```

### Audio Interview
```
[Screenshot Placeholder - Real-time transcription and evaluation]
```

### Career Roadmap
```
[Screenshot Placeholder - Personalized career path recommendations]
```

*Note: Screenshots will be added in the production version*

---

## 🔧 Troubleshooting

### Backend Issues

#### LLM Responses are Generic
```
Issue: Mentor responses seem templated or unhelpful
Solution:
1. Verify .env has valid OPENAI_API_KEY
2. Check OPENAI_API_BASE matches your provider
3. Restart backend: python -m uvicorn main:app --reload
4. Check logs for [WARN] messages about fallback templates
5. Verify API quota/balance with your provider
```

#### Database Connection Error
```
Issue: Cannot connect to database
Solution:
1. Verify DATABASE_URL in .env is correct
2. For SQLite: ensure directory permissions allow file creation
3. For PostgreSQL: verify server is running and credentials correct
4. Run: python -c "from app.database import init_db; init_db()"
```

#### Redis Connection Issues
```
Issue: Audio interview features not working
Solution:
1. Check if Redis is running: redis-cli ping
2. Verify REDIS_URL in .env matches running instance
3. Set INTERVIEW_STORE_BACKEND=memory for development
4. Check logs for connection timeout errors
```

#### Port Already in Use
```
# Change backend port
python -m uvicorn main:app --port 8001 --reload

# Change frontend port
cd frontend && npm run dev -- --port 5174
```

### Frontend Issues

#### API Connection Error
```
Issue: Frontend cannot reach backend
Solution:
1. Verify backend is running: http://localhost:8000/docs
2. Check CORS_ALLOW_ORIGINS includes frontend URL
3. Verify API_BASE_URL in frontend .env
4. Clear browser cache and cookies
```

#### Dependencies Not Resolved
```
npm install --legacy-peer-deps
npm audit fix
```

---

## 🚀 Deployment

### Docker Deployment

```bash
# Build image
docker build -t mentor-ai-backend .

# Run container
docker run -p 8000:8000 \
  --env-file .env \
  mentor-ai-backend
```

### Heroku Deployment

```bash
# Create app
heroku create your-app-name

# Add buildpacks
heroku buildpacks:add heroku/python
heroku buildpacks:add heroku/nodejs

# Set environment variables
heroku config:set OPENAI_API_KEY=your_key
heroku config:set DATABASE_URL=your_db_url

# Deploy
git push heroku main
```

### Manual Server Deployment

```bash
# Build frontend
cd frontend && npm run build

# Copy frontend build to backend static folder
cp -r dist/* ../public/

# Start production backend
uvicorn main:app --host 0.0.0.0 --port 8000
```

For detailed deployment instructions, see [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)

---

## 🚦 Development Workflow

### Running Tests

```bash
# Run all tests
pytest

# Run specific test file
pytest test_api.py -v

# Run with coverage
pytest --cov=app tests/
```

### Code Quality

```bash
# Format code
black app/ frontend/src/

# Lint code
pylint app/
eslint frontend/src/

# Type checking
mypy app/
```

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature

# Make changes and commit
git add .
git commit -m "feat: add your feature"

# Push and create PR
git push origin feature/your-feature
```

---

## 🎯 Future Improvements

### Short Term (v1.2)
- [ ] JWT authentication system
- [ ] User account management
- [ ] Export analytics to PDF/CSV
- [ ] Offline mode support
- [ ] Dark theme UI

### Medium Term (v2.0)
- [ ] Mobile app (React Native)
- [ ] Real-time collaboration features
- [ ] Advanced ML model for personalization
- [ ] Multi-language support
- [ ] Video interview capabilities

### Long Term (v3.0)
- [ ] Gamification and badges system
- [ ] Social learning features
- [ ] Custom LLM fine-tuning
- [ ] Integration with educational platforms
- [ ] Advanced proctoring system

---

## 📖 Additional Documentation

- [QUICKSTART.md](QUICKSTART.md) - Quick start guide
- [FEATURES.md](FEATURES.md) - Comprehensive feature list
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contributing guidelines
- [ARCHITECTURE.md](ARCHITECTURE.md) - Technical architecture
- [ARCHITECTURE_VISUAL.md](ARCHITECTURE_VISUAL.md) - Visual diagrams
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - Deployment instructions
- [DEVELOPER_REFERENCE.md](DEVELOPER_REFERENCE.md) - API reference
- [PROFILE_DATA_USAGE.md](PROFILE_DATA_USAGE.md) - Data privacy

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on:
- How to report issues
- How to submit pull requests
- Code style and conventions
- Testing requirements

### Quick Contribution Guide

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 👨‍💻 Author

**Ravirala Lathasri**

- GitHub: [@RaviralaLathasri](https://github.com/RaviralaLathasri)
- Project: [Mentor AI](https://github.com/RaviralaLathasri/Mentor-Ai.git)

---

## 🙏 Acknowledgments

- Built with [FastAPI](https://fastapi.tiangolo.com/) and [React](https://react.dev/)
- LLM powered by [OpenAI](https://openai.com/) and [OpenRouter](https://openrouter.ai/)
- UI components inspired by modern design principles
- Community feedback and contributions

---

## 📞 Support

- **Issues**: Report bugs on [GitHub Issues](https://github.com/RaviralaLathasri/Mentor-Ai/issues)
- **Discussions**: Join [GitHub Discussions](https://github.com/RaviralaLathasri/Mentor-Ai/discussions)
- **Email**: Contact via GitHub profile

---

## ✨ Status

This project is **production-ready** with active development.

**Current Version**: v1.1.0  
**Last Updated**: 2026  
**Status**: Active Development

---

<div align="center">

**Made with ❤️ for the education community**

[⬆ back to top](#-mentor-ai)

</div>
