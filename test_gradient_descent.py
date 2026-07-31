import httpx

# Test mentor endpoint with gradient descent question
payload = {
    'student_id': 4,
    'query': 'What is gradient descent?',
    'focus_concept': 'gradient descent',
    'context': {}
}

response = httpx.post('http://localhost:8001/api/mentor/respond', json=payload)
print('Status:', response.status_code)
print('\nResponse:')
print(response.json())
