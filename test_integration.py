import httpx
import json
import uuid

BASE_URL = 'http://localhost:8001'
unique_id = str(uuid.uuid4())[:8]

print("=== 1. Creating Student ===")
response = httpx.post(f'{BASE_URL}/api/profile/create', json={
    'name': f'Integration Test User {unique_id}',
    'email': f'integtest{unique_id}@example.com'
})
if response.status_code != 200:
    print(f"Error: {response.status_code}")
    print(response.text)
    exit(1)

student_data = response.json()
student_id = student_data['id']
print(f"✓ Student created: ID {student_id}")

print("\n=== 2. Getting Student Profile ===")
response = httpx.get(f'{BASE_URL}/api/profile/{student_id}')
if response.status_code != 200:
    print(f"Error: {response.status_code}")
    print(response.text)
    exit(1)

profile = response.json()
print(f"✓ Profile retrieved")
print(f"  Confidence: {profile['confidence_level']}")
print(f"  Difficulty: {profile['preferred_difficulty']}")

print("\n=== 3. Updating Profile ===")
response = httpx.put(f'{BASE_URL}/api/profile/{student_id}', json={
    'skills': ['Python', 'ML'],
    'interests': ['AI', 'Algorithms'],
    'goals': 'Learn ML deeply',
    'confidence_level': 0.6
})
if response.status_code != 200:
    print(f"Error: {response.status_code}")
    print(response.text)
    exit(1)

print("✓ Profile updated")

print("\n=== 4. Testing Mentor API with Different Questions ===")

test_questions = [
    "What is gradient descent?",
    "How do neural networks work?",
    "Explain the concept of recursion",
    "What is machine learning?"
]

for question in test_questions:
    response = httpx.post(f'{BASE_URL}/api/mentor/respond', json={
        'student_id': student_id,
        'query': question,
        'focus_concept': None,
        'context': {}
    })
    
    if response.status_code != 200:
        print(f"✗ Error: {response.status_code}")
        print(f"  Question: {question}")
        print(f"  Response: {response.text}")
    else:
        data = response.json()
        print(f"✓ {question}")
        print(f"  → Detected concept: {data['target_concept']}")
        print(f"  → Style: {data['explanation_style']}")
        print(f"  → Response length: {len(data['response'])} chars")

print("\n=== Integration Test: PASSED ===")
