import httpx
import json

# Test with "data analyst" question
payload = {
    'student_id': 8,
    'query': 'How to learn data analyst?',
    'focus_concept': None,
    'context': {}
}

response = httpx.post('http://localhost:8001/api/mentor/respond', json=payload)
print('Status:', response.status_code)
print('\nResponse for "How to learn data analyst?":')
data = response.json()
print(json.dumps(data, indent=2))

print('\n' + '='*80 + '\n')

# Test with another question for comparison
payload2 = {
    'student_id': 8,
    'query': 'What is machine learning?',
    'focus_concept': None,
    'context': {}
}

response2 = httpx.post('http://localhost:8001/api/mentor/respond', json=payload2)
print('Response for "What is machine learning?":')
data2 = response2.json()
print(json.dumps(data2, indent=2))

print('\n' + '='*80 + '\n')

# Test with SQL question
payload3 = {
    'student_id': 8,
    'query': 'How do I query databases with SQL?',
    'focus_concept': None,
    'context': {}
}

response3 = httpx.post('http://localhost:8001/api/mentor/respond', json=payload3)
print('Response for "How do I query databases with SQL?":')
data3 = response3.json()
print(json.dumps(data3, indent=2))
