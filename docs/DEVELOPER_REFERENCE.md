# Developer Quick Reference

## 🚀 Getting Started (30 seconds)

```bash
# 1. Start the server
python -m uvicorn app.main:app --reload

# 2. Open Swagger docs
http://localhost:8000/docs

# 3. Test an endpoint
curl -X POST "http://localhost:8000/api/profile/create" \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com"}'
```

## 📁 Project Structure

```
app/
├── database.py        ← ORM models (Student, StudentProfile, etc.)
├── schemas.py         ← Pydantic validation (request/response)
├── services.py        ← Business logic (5 services)
├── main.py            ← FastAPI entry point
└── routes/
    ├── profiles.py        ← /api/profile (NEW)
    ├── wellness.py        ← /api/analyze (NEW)
    ├── mentor_ai.py       ← /api/mentor (NEW)
    ├── feedback_loop.py   ← /api/feedback (NEW)
    ├── adaptive.py        ← /api/adaptive (NEW)
    └── explain_mistakes.py ← /api/explain (NEW)
```

## 🏗️ Architecture Layers

```
ROUTER (HTTP endpoints)
  ↓ uses
SERVICE (business logic)
  ↓ uses
DATABASE (ORM models)
  ↓ uses
SQLite
```

**Rule**: Never put logic in routers. All logic goes in services.

## 📊 Data Flow Example: Student Takes Quiz

```
Student Action: Submit quiz answer
     ↓
POST /api/analyze/quiz
     ↓
Router health checks input
     ↓
WeaknessAnalyzerService.analyze_quiz_result()
     ↓
- Load/create WeaknessScore from database
- Compute new score: if correct: -0.1, if wrong: +0.15
- Save to database
     ↓
Return WeaknessAnalysisResult
     ↓
Router returns JSON response
```

## 🔑 Key Concepts

### Weakness Score (0.0 - 1.0)
- **0.0** = Student understands perfectly
- **0.5** = Medium understanding
- **1.0** = Complete struggle

Updates: Correct answer -0.1, Wrong answer +0.15

### Explanation Style
Service automatically chooses based on weakness + confidence:
- **"simple"**: High weakness OR low confidence
- **"conceptual"**: Medium weakness AND medium confidence
- **"deep"**: Low weakness AND high confidence

### Feedback Loop
Student's feedback → Difficulty adjusted automatically

| Feedback | Effect |
|----------|--------|
| too_easy | Difficulty increases |
| too_hard | Difficulty decreases |
| helpful  | Keep current level |
| unclear  | Keep current level |

## 🛠️ Adding New Features

### Step 1: Define Database Model (database.py)
```python
class MyModel(Base):
    __tablename__ = "my_table"
    id = Column(Integer, primary_key=True)
    student_id = Column(Integer, ForeignKey("student.id"))
    # ... fields ...
```

### Step 2: Add Validation Schema (schemas.py)
```python
class MyModelResponse(BaseModel):
    id: int
    student_id: int
    # ... fields ...
    
    class Config:
        from_attributes = True
```

### Step 3: Create Service (services.py)
```python
class MyService:
    def __init__(self, db: Session):
        self.db = db
    
    def my_operation(self, ...):
        # Business logic here
        return result
```

### Step 4: Add Router (routes/my_feature.py)
```python
@router.post("/endpoint", response_model=MyModelResponse)
def my_endpoint(input: InputSchema, db: Session = Depends(get_db)):
    service = MyService(db)
    result = service.my_operation(...)
    return result
```

### Step 5: Register Router (main.py)
```python
from app.routes import my_feature
app.include_router(my_feature.router, prefix="/api", tags=["My Feature"])
```

## 🐛 Debugging Tips

### Check if service is being called
Add print statement:
```python
def my_method(self):
    print(f"[DEBUG] my_method called")
    # ... rest of code
```

### Check database state
```python
# In router or service
records = db.query(Student).all()
print(f"Students: {len(records)}")
for student in records:
    print(f"  {student.id}: {student.name}")
```

### View terminal errors
All errors logged with `[ERROR]` prefix:
```
[ERROR] analyze_quiz_result: KeyError | student_id=1
```

### Check Swagger docs
Always returns all available endpoints:
```
http://localhost:8000/docs
```

## 📝 Common Patterns

### Getting Student Data
```python
# In a service
from app.database import Student, StudentProfile
student = db.query(Student).filter(Student.id == student_id).first()
if not student:
    raise ValueError(f"Student {student_id} not found")
profile = student.student_profile  # Access relationship
```

### Creating and Storing Records
```python
new_record = MyModel(field1=value1, field2=value2)
db.add(new_record)
db.commit()
db.refresh(new_record)
return new_record.id  # Use ID after refresh
```

### Querying with Relationships
```python
# Get weakest concepts for a student
weaknesses = (
    db.query(WeaknessScore)
    .filter(WeaknessScore.student_id == student_id)
    .order_by(WeaknessScore.weakness_score.desc())
    .limit(5)
    .all()
)
```

### Error Handling in Routers
```python
try:
    service = MyService(db)
    result = service.some_operation()
    return result
except ValueError as e:
    raise HTTPException(status_code=404, detail=str(e))
except Exception as e:
    print(f"[ERROR] endpoint_name: {str(e)} | context_info")
    raise HTTPException(status_code=500, detail="Server error")
```

## 🧪 Testing Services

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base

# Create test database
engine = create_engine("sqlite:///:memory:")
Base.metadata.create_all(engine)
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

# Test your service
from app.services import MyService
service = MyService(db)
result = service.my_operation()
assert result is not None
```

## 🚨 Common Mistakes

### ❌ Don't: Put logic in routers
```python
@router.post("/submit")
def submit(data: Input, db: Session):
    # WRONG: Logic in router
    students = db.query(Student).all()
    for s in students:
        s.score += 1
    db.commit()
    return {"ok": True}
```

### ✅ Do: Put logic in services
```python
# In service
def update_scores(self):
    students = self.db.query(Student).all()
    for s in students:
        s.score += 1
    self.db.commit()

# In router
@router.post("/submit")
def submit(data: Input, db: Session):
    service = MyService(db)
    service.update_scores()
    return {"ok": True}
```

### ❌ Don't: Create new DB session
```python
from app.database import SessionLocal
db = SessionLocal()  # WRONG
```

### ✅ Do: Use dependency injection
```python
@router.post("/endpoint")
def endpoint(db: Session = Depends(get_db)):  # RIGHT
    service = MyService(db)
```

### ❌ Don't: Forget to commit
```python
new_record = MyModel(...)
db.add(new_record)
# WRONG: Forgot to commit
return new_record.id
```

### ✅ Do: Always commit
```python
new_record = MyModel(...)
db.add(new_record)
db.commit()  # RIGHT
db.refresh(new_record)
return new_record.id
```

## 📚 Key Files to Know

| File | Purpose | When to Edit |
|------|---------|--------------|
| `database.py` | Database schema | Adding new entities |
| `schemas.py` | Input validation | New API endpoints |
| `services.py` | Business logic | New algorithms |
| `routes/*.py` | HTTP endpoints | New API routes |
| `main.py` | App setup | Register new routers |

## 🔍 Finding Code

### Find all endpoints
```
http://localhost:8000/docs
```

### Find service methods
```bash
grep -n "def " app/services.py
```

### Find where something is called
```bash
grep -r "analyze_quiz_result" app/
```

### Check what services exist
```bash
ls -la app/routes/
```

## ⚙️ Configuration

### Environment Variables (.env)
```
OPENROUTER_API_KEY=your_key
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
DATABASE_URL=sqlite:///mentor_ai.db
```

### Database
Default: SQLite file `mentor_ai.db`
Auto-created on startup via `init_db()`

### Server Port
Default: 8000
Change: `uvicorn app.main:app --port 3000`

## 🚀 Quick Commands

```bash
# Start server with auto-reload
python -m uvicorn app.main:app --reload

# Start server (production)
gunicorn -w 4 -b 0.0.0.0:8000 app.main:app

# Run tests (when available)
pytest app/tests/

# Check syntax
python -m py_compile app/services.py

# View database
sqlite3 mentor_ai.db ".tables"
```

## 📖 Documentation Files

- **ARCHITECTURE.md** - Complete system design
- **README.md** - Project overview and setup
- **COMPLETION_CHECKLIST.md** - What was delivered
- **This file** - Quick developer reference

## 🎯 Common Tasks

### Add new endpoint
1. Check `routes/` for similar pattern
2. Create service method in `services.py`
3. Add router method in `routes/*.py`
4. Test in Swagger: `/docs`

### Debug weird behavior
1. Check terminal for `[ERROR]` messages
2. Add print statements in service
3. Check database state with `sqlite3`
4. Verify Pydantic schema validation

### Add new concept to track
1. Create `WeaknessScore` record
2. Update on quiz submission
3. Include in mentor context
4. Show in analytics

### Modify student state
1. Update in StudentProfile (difficulty, confidence)
2. Never in routers, always in services
3. Always commit changes
4. Return updated state for frontend

## 💡 Pro Tips

1. **Use Swagger for testing**: Go to `/docs` to test endpoints without curl

2. **Watch terminal for errors**: All routers log with `[ERROR] function_name: message`

3. **Database is auto-created**: Run `init_db()` on startup, so don't manually create tables

4. **Services are testable**: Mock DB session and test service logic in isolation

5. **Type hints help autocomplete**: Use them everywhere for better IDE support

6. **Relationships are automatic**: Query `student.student_profile` directly without extra join

7. **Always validate inputs**: Pydantic schemas automate this, trust them

8. **Commit after modifications**: DB changes only persist after `db.commit()`

---

**Need help?** Check ARCHITECTURE.md for detailed explanations of all components.

**Want to understand the learning loop?** See README.md → "Complete Learning Loop" section.

**Lost?** Check COMPLETION_CHECKLIST.md to see what exists and where.
