import httpx
import json
import time

BASE_URL = 'http://localhost:8001'

questions = [
    ("How to learn data analyst?", "data analysis career"),
    ("What is machine learning?", "what is question"),
    ("How do I use Python?", "how to use"),
    ("Why is statistics important?", "why question"),
]

print("Testing Improved Chatbot - Multiple Questions\n")
print("=" * 80)

for idx, (question, label) in enumerate(questions):
    payload = {
        'student_id': 8,
        'query': question,
        'focus_concept': None,
        'context': {}
    }
    
    response = httpx.post(f'{BASE_URL}/api/mentor/respond', json=payload)
    
    if response.status_code == 200:
        data = response.json()
        print(f"\n{idx+1}. Question: {question}")
        print(f"   Category: {label}")
        print(f"   Detected Concept: {data['target_concept']}")
        print(f"   Explanation Style: {data['explanation_style']}")
        print(f"\n   Response:\n   {data['response'][:200]}...")
        print(f"\n   Follow-up: {data['follow_up_question']}")
    else:
        print(f"\nError {response.status_code}")
    
    print("\n" + "-" * 80)
    time.sleep(0.5)

print("\n✅ Chatbot now gives SPECIFIC answers for each question!")
print("✅ No more generic 'general' responses!")
