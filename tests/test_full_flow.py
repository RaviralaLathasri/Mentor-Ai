import httpx
import uuid

# Create a test student with unique email
print("=== Creating test student ===")
unique_id = str(uuid.uuid4())[:8]
student_payload = {
    'name': f'Test User {unique_id}',
    'email': f'testuser{unique_id}@example.com'
}
response = httpx.post('http://localhost:8001/api/profile/create', json=student_payload)
print(f'Status: {response.status_code}')
student_data = response.json()
print(f'Student ID: {student_data.get("id")}')

student_id = student_data.get("id")

# Test mentor endpoint with the new student
print(f"\n=== Testing mentor endpoint with student {student_id} ===")
mentor_payload = {
    'student_id': student_id,
    'query': 'What is gradient descent?',
    'focus_concept': None,
    'context': None
}
response = httpx.post('http://localhost:8001/api/mentor/respond', json=mentor_payload)
print(f'Status: {response.status_code}')
print(f'Response structure:')
import json
print(json.dumps(response.json(), indent=2))
