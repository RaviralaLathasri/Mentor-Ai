from fastapi import APIRouter

router = APIRouter()

@router.get("/")
def test_students():
    return {"message": "Students route working"}