import httpx
import json

# Test the improved response for "How to learn data analyst?"
payload = {
    'student_id': 8,
    'query': 'How to learn data analyst?',
    'focus_concept': None,
    'context': {}
}

response = httpx.post('http://localhost:8001/api/mentor/respond', json=payload)
print('Status:', response.status_code)
print('\nImproved Response for "How to learn data analyst?":')
data = response.json()
print(f"Concept detected: {data['target_concept']}")
print(f"Style: {data['explanation_style']}")
print(f"\nResponse:\n{data['response']}")
print(f"\nFollow-up: {data['follow_up_question']}")
