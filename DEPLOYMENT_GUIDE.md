# Production Deployment Guide

## Table of Contents
1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Environment Setup](#environment-setup)
3. [Database Setup](#database-setup)
4. [Local Testing](#local-testing)
5. [Deployment Options](#deployment-options)
6. [Monitoring & Logging](#monitoring--logging)
7. [Troubleshooting](#troubleshooting)

---

## Pre-Deployment Checklist

### Code Quality
- [ ] All tests passing
- [ ] No `TODO` comments in critical code
- [ ] Type hints on all functions
- [ ] Error handling on all endpoints
- [ ] Docstrings on all services

### Security
- [ ] No hardcoded API keys or secrets
- [ ] CORS properly configured for frontend domain
- [ ] Input validation on all endpoints
- [ ] Rate limiting considered
- [ ] Error messages don't leak internals

### Documentation
- [ ] README.md updated
- [ ] API endpoints documented
- [ ] Environment variables documented
- [ ] Deployment instructions written
- [ ] Known issues documented

### Database
- [ ] Schema migrations tested
- [ ] Backups configured
- [ ] Connection pooling enabled
- [ ] Indexes on foreign keys
- [ ] Auto-increment primary keys

### Performance
- [ ] Database queries optimized
- [ ] N+1 queries eliminated
- [ ] Caching strategy defined
- [ ] Response times acceptable
- [ ] Resource usage reasonable

### Monitoring
- [ ] Error tracking configured
- [ ] Metrics collection ready
- [ ] Log aggregation setup
- [ ] Uptime monitoring enabled
- [ ] Alert thresholds defined

### Operations
- [ ] Runbooks written
- [ ] Incident response plan
- [ ] Rollback procedure documented
- [ ] Health check endpoint exists
- [ ] Graceful shutdown implemented

---

## Environment Setup

### 1. Install Python Dependencies

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install requirements
pip install -r requirements.txt

# Verify installation
python -c "import fastapi; print(fastapi.__version__)"
```

### 2. Create Environment File

Create `.env` in project root:

```bash
# Required for LLM integration
OPENROUTER_API_KEY=sk_or_xxxxxxxxxxxx

# API Configuration
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# Database
DATABASE_URL=sqlite:///mentor_ai.db
# OR for PostgreSQL:
# DATABASE_URL=postgresql://user:password@localhost/mentor_db

# Server Configuration
HOST=0.0.0.0
PORT=8000
DEBUG=False

# Logging
LOG_LEVEL=INFO
LOG_FILE=/var/log/mentor_ai/app.log

# API Limits
MAX_FEEDBACK_HISTORY=3
DIFFICULTY_MIN=1.0
DIFFICULTY_MAX=5.0

# CORS
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Email Configuration (optional, for alerts)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
ALERT_EMAIL=admin@yourdomain.com
```

### 3. Verify Environment Variables

```bash
# Test that all required variables are present
python -c "import os; print('OPENROUTER_API_KEY' in os.environ)"

# Should print: True
```

---

## Database Setup

### 1. Initialize Database

```bash
# For SQLite (development):
python -c "from app.database import init_db; init_db()"
# Creates: mentor_ai.db

# For PostgreSQL (production):
createdb mentor_db
export DATABASE_URL="postgresql://user:password@localhost/mentor_db"
python -c "from app.database import init_db; init_db()"
```

### 2. Verify Database Creation

```bash
# For SQLite:
sqlite3 mentor_ai.db ".tables"
# Should list all tables:
# student, student_profile, weakness_score, feedback, mentor_response, adaptive_session

# For PostgreSQL:
psql -U user -d mentor_db -c "\dt"
```

### 3. Create Database Backups (PostgreSQL)

```bash
# Daily backup script (backup.sh)
#!/bin/bash
BACKUP_DIR="/backups/mentor_ai"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/mentor_db_$TIMESTAMP.sql"

mkdir -p $BACKUP_DIR
pg_dump -U user mentor_db > $BACKUP_FILE
gzip $BACKUP_FILE

# Keep only last 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_FILE.gz"
```

Configure cron job:
```bash
# Run daily at 2 AM
0 2 * * * /path/to/backup.sh
```

### 4. Database Optimization (PostgreSQL)

```sql
-- Create indexes for common queries
CREATE INDEX idx_student_email ON student(email);
CREATE INDEX idx_weakness_score_student ON weakness_score(student_id);
CREATE INDEX idx_feedback_student ON feedback(student_id);
CREATE INDEX idx_feedback_created ON feedback(created_at DESC);

-- Analyze table statistics
ANALYZE;
```

---

## Local Testing

### 1. Start Development Server

```bash
# With auto-reload (development)
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Without reload (test production mode)
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 2. Verify API Health

```bash
# Health check endpoint
curl http://localhost:8000/health

# Expected response:
# {"status":"ok","project":"Mentor AI","version":"1.0.0"}
```

### 3. Test Key Endpoints

```bash
# Create student
curl -X POST http://localhost:8000/api/profile/create \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com"}'

# Create profile
curl -X POST http://localhost:8000/api/profile/1/profile \
  -H "Content-Type: application/json" \
  -d '{"skills":["math"],"confidence_level":0.5}'

# Submit quiz
curl -X POST http://localhost:8000/api/analyze/quiz \
  -H "Content-Type: application/json" \
  -d '{"student_id":1,"concept_name":"algebra","is_correct":true}'

# Get mentor response
curl -X POST http://localhost:8000/api/mentor/respond \
  -H "Content-Type: application/json" \
  -d '{"student_id":1,"query":"How do I solve equations?"}'

# Submit feedback
curl -X POST http://localhost:8000/api/feedback/submit \
  -H "Content-Type: application/json" \
  -d '{"student_id":1,"response_id":"uuid","feedback_type":"helpful","rating":4.5}'
```

### 4. Load Testing

```bash
# Install locust
pip install locust

# Create locustfile.py
from locust import HttpUser, task

class APIUser(HttpUser):
    @task
    def health_check(self):
        self.client.get("/health")
    
    @task
    def create_student(self):
        self.client.post("/api/profile/create", json={
            "name": "Loadtest User",
            "email": f"test{random.randint(1,10000)}@example.com"
        })

# Run load test
locust -f locustfile.py --host=http://localhost:8000
```

---

## Deployment Options

### Option 1: Docker (Recommended for Cloud)

Create `Dockerfile`:
```dockerfile
FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/
COPY .env .

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Build and run:
```bash
# Build image
docker build -t mentor-ai:latest .

# Run container
docker run -d \
  --name mentor-ai \
  -p 8000:8000 \
  -e OPENROUTER_API_KEY=$OPENROUTER_API_KEY \
  -v mentor_data:/app/data \
  mentor-ai:latest

# View logs
docker logs -f mentor-ai

# Stop container
docker stop mentor-ai
```

### Option 2: Linux System Service

Create `/etc/systemd/system/mentor-ai.service`:
```ini
[Unit]
Description=Mentor AI Backend
After=network.target

[Service]
Type=notify
User=mentor
WorkingDirectory=/opt/mentor-ai
EnvironmentFile=/opt/mentor-ai/.env
ExecStart=/opt/mentor-ai/venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Commands:
```bash
# Start service
sudo systemctl start mentor-ai

# Enable auto-start
sudo systemctl enable mentor-ai

# View logs
sudo journalctl -u mentor-ai -f

# Stop service
sudo systemctl stop mentor-ai
```

### Option 3: Gunicorn + Nginx Reverse Proxy (Traditional)

Install Gunicorn:
```bash
pip install gunicorn
```

Create `gunicorn_config.py`:
```python
import multiprocessing

# Server socket
bind = "127.0.0.1:8000"
backlog = 2048

# Worker processes
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "uvicorn.workers.UvicornWorker"
worker_connections = 1000

# Timeouts
timeout = 30
keepalive = 2

# Logging
accesslog = "/var/log/mentor_ai/access.log"
errorlog = "/var/log/mentor_ai/error.log"
loglevel = "info"

# Server mechanics
preload_app = False
max_requests = 1000
max_requests_jitter = 50
```

Start Gunicorn:
```bash
gunicorn -c gunicorn_config.py app.main:app
```

Configure Nginx:
```nginx
upstream mentor_ai {
    server 127.0.0.1:8000;
}

server {
    listen 80;
    server_name yourdomain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /etc/ssl/certs/your_cert.crt;
    ssl_certificate_key /etc/ssl/private/your_key.key;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    
    location / {
        proxy_pass http://mentor_ai;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

### Option 4: AWS EC2 + RDS

1. **Create RDS PostgreSQL Instance**
   - Instance class: db.t3.micro (free tier eligible)
   - Multi-AZ: No (for development)
   - Storage: 20GB
   - Backup retention: 7 days

2. **Launch EC2 Instance**
   - AMI: Ubuntu 20.04 LTS
   - Instance type: t3.micro (free tier eligible)
   - Security group: Allow SSH (22), HTTP (80), HTTPS (443)

3. **Deploy on EC2**
   ```bash
   # SSH into instance
   ssh -i key.pem ubuntu@your-instance-ip
   
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install dependencies
   sudo apt install -y python3.10 python3.10-venv python3-pip
   
   # Clone repo / upload code
   cd /opt
   git clone your-repo mentor-ai
   cd mentor-ai
   
   # Setup Python environment
   python3.10 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   
   # Configure environment
   echo "DATABASE_URL=postgresql://user:pass@your-rds-endpoint:5432/mentor_db" >> .env
   echo "OPENROUTER_API_KEY=..." >> .env
   
   # Initialize database
   python -c "from app.database import init_db; init_db()"
   
   # Start with Gunicorn
   gunicorn -c gunicorn_config.py app.main:app
   ```

---

## Monitoring & Logging

### 1. Application Logging

```python
# Add to app/main.py
import logging
from pythonjsonlogger import jsonlogger

# Configure JSON logging for production
logHandler = logging.StreamHandler()
formatter = jsonlogger.JsonFormatter()
logHandler.setFormatter(formatter)
logger = logging.getLogger()
logger.addHandler(logHandler)
logger.setLevel(logging.INFO)
```

### 2. Monitor API Performance

```bash
# Install monitoring tools
pip install prometheus-client

# Add to app/main.py
from prometheus_client import Counter, Histogram, generate_latest

request_count = Counter('requests_total', 'Total requests')
request_duration = Histogram('request_duration_seconds', 'Request duration')

@app.middleware("http")
async def add_metrics(request: Request, call_next):
    request_count.inc()
    with request_duration.time():
        response = await call_next(request)
    return response

@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type="text/plain")
```

### 3. Error Tracking

```python
# Install error tracking
pip install sentry-sdk

# Add to app/main.py
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

sentry_sdk.init(
    dsn="your-sentry-dsn",
    integrations=[FastApiIntegration()],
    traces_sample_rate=0.1,
    environment="production"
)
```

### 4. Health Check Endpoint

The health check is already implemented:
```bash
curl https://yourdomain.com/health
```

### 5. Log Monitoring

```bash
# Real-time log monitoring
tail -f /var/log/mentor_ai/app.log | grep ERROR

# Search logs for specific errors
grep "student_id=123" /var/log/mentor_ai/app.log

# Count errors by hour
awk -F',' '/\[ERROR\]/ {print $1}' /var/log/mentor_ai/app.log | sort | uniq -c
```

### 6. Setup Alerts

Configure alerts for:
- [ ] 5xx error rate > 1%
- [ ] Response time > 2000ms
- [ ] Database connection errors
- [ ] API key invalid (401s)
- [ ] Server down (health check failing)

---

## Troubleshooting

### Server Won't Start

**Problem**: `ModuleNotFoundError: No module named 'app'`
```bash
# Solution: Ensure you're in project root
pwd  # Should show: /path/to/OnCallAgent
ls app/  # Should list: database.py, main.py, etc.
```

**Problem**: `ImportError: cannot import name 'SQLAlchemy'`
```bash
# Solution: Install missing dependencies
pip install -r requirements.txt
pip install sqlalchemy pydantic fastapi uvicorn
```

### Database Connection Failed

**Problem**: `OperationalError: cannot open shared object file`
```bash
# Solution: PostgreSQL client libraries missing
sudo apt install -y libpq-dev
pip install psycopg2-binary
```

**Problem**: `FATAL: password authentication failed for user "postgres"`
```bash
# Solution: Check DATABASE_URL in .env
# Format: postgresql://user:password@host:port/dbname
# Example: postgresql://postgres:mypassword@localhost:5432/mentor_db
```

### High Memory Usage

**Problem**: Server RAM usage growing over time
```bash
# Solution: Check for connection leaks
# In app/database.py, ensure session cleanup:
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()  # Important!
```

### Slow API Responses

**Problem**: `/api/analyze/weakest-concepts` slow on large student base
```bash
# Solution: Add database indexes
CREATE INDEX idx_weakness_student_concept 
ON weakness_score(student_id, weakness_score DESC);

# Consider caching
pip install redis
# Cache weakness scores for 1 hour
```

### CORS Errors from Frontend

**Problem**: `Access to XMLHttpRequest blocked by CORS policy`
```bash
# Solution: Update allowed origins in .env
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# And in app/main.py, update CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### API Key Not Working

**Problem**: `401 Unauthorized` from OpenRouter
```bash
# Solution: Verify API key
curl -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  https://openrouter.ai/api/v1/models

# Check .env file has correct key
grep OPENROUTER_API_KEY .env

# Test in Python
import os
from openai import OpenAI
client = OpenAI(
    api_key=os.getenv("OPENROUTER_API_KEY"),
    base_url=os.getenv("OPENROUTER_BASE_URL")
)
# Try a simple request
response = client.chat.completions.create(
    model="openai/gpt-4o-mini",
    messages=[{"role": "user", "content": "Hello"}]
)
```

---

## Post-Deployment Validation

After deploying to production:

```bash
# 1. Health check
curl https://yourdomain.com/health

# 2. API docs accessible
curl -I https://yourdomain.com/docs

# 3. Create test student
curl -X POST https://yourdomain.com/api/profile/create \
  -H "Content-Type: application/json" \
  -d '{"name":"Production Test","email":"test@yourdomain.com"}'

# 4. Check database is populated
# Login to database and query:
SELECT COUNT(*) FROM student;

# 5. Monitor logs for errors
tail -f /var/log/mentor_ai/app.log

# 6. Check resource usage
top
df -h
free -h

# 7. Test with real users
# Have QA team test key workflows
```

---

## Rollback Procedure

If deployment fails:

```bash
# 1. Stop new version
sudo systemctl stop mentor-ai

# 2. Restore from backup
# SQLite: cp mentor_ai.db.backup mentor_ai.db
# PostgreSQL: psql mentor_db < backup.sql

# 3. Revert code
git checkout previous-tag
pip install -r requirements.txt

# 4. Start previous version
sudo systemctl start mentor-ai

# 5. Verify
curl https://yourdomain.com/health

# 6. Investigate what went wrong
# Check logs, database, external services
```

---

## Maintenance Schedule

### Daily
- [ ] Monitor error logs
- [ ] Check API latency
- [ ] Verify database backups completed

### Weekly
- [ ] Review error patterns
- [ ] Check disk space usage
- [ ] Validate database integrity

### Monthly
- [ ] Update dependencies
- [ ] Review security logs
- [ ] Analyze performance metrics
- [ ] Test disaster recovery

### Quarterly
- [ ] Security audit
- [ ] Load testing
- [ ] Code review
- [ ] Update documentation

---

## Support Contacts

For production issues:
- **API Integration**: OpenRouter support
- **Database**: PostgreSQL documentation
- **Server**: Linux system logs
- **Application**: Check app logs and ARCHITECTURE.md

---

**Version**: 1.0
**Last Updated**: 2024
**Status**: Ready for Production
