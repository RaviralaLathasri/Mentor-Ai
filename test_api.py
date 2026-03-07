import httpx

# Test 1: Get profile
print("=== Testing GET /api/profile/4 ===")
response = httpx.get('http://localhost:8001/api/profile/4')
print(f'Status: {response.status_code}')
print(f'Response: {response.text}\n')

# Test 2: Update profile
print("=== Testing PUT /api/profile/4 ===")
payload = {
    'skills': ['Python', 'JavaScript'],
    'interests': ['Machine Learning'],
    'goals': 'Learn AI',
    'confidence_level': 0.7
}
response = httpx.put('http://localhost:8001/api/profile/4', json=payload)
print(f'Status: {response.status_code}')
print(f'Response: {response.text}\n')

# Test 3: Mentor API (fixed endpoint)
print("=== Testing POST /api/mentor/respond ===")
mentor_payload = {
    'student_id': 4,
    'query': 'How do I learn Python?',
    'focus_concept': 'programming',
    'context': {}
}
response = httpx.post('http://localhost:8001/api/mentor/respond', json=mentor_payload)
print(f'Status: {response.status_code}')
print(f'Response: {response.text[:800]}\n')
