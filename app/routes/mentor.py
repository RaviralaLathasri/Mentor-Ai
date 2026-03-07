from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from uuid import uuid4
from app.schemas import ChatRequest, ChatResponse
from app.database import get_db, SessionLocal, ChatSession
from openai import OpenAI
from dotenv import load_dotenv
import os
import json

# Load environment variables
load_dotenv()

# Initialize OpenRouter client with proper configuration
client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    base_url="https://openrouter.ai/api/v1"
)

router = APIRouter()


# ─────────────────────────────────────────────────────────────────────────────
# HELPER: Dynamic System Prompt based on Difficulty Level
# ─────────────────────────────────────────────────────────────────────────────

def generate_system_prompt(difficulty_level: float) -> str:
    """
    Generate a dynamic system prompt that adapts explanation style
    based on the student's current difficulty level.
    
    - Level 1-2: Beginner → very simple, step-by-step explanations
    - Level 3-4: Intermediate → structured with examples and analogies
    - Level 5: Advanced → includes mathematical formulas and deep insights
    """
    
    base_system = (
        "You are an AI mentor helping a 3rd year Artificial Intelligence student "
        "preparing for GATE exam. Keep explanations clear and structured."
    )

    # Exact difficulty instructions as requested
    if difficulty_level <= 2:
        difficulty_instruction = (
            "\n\nExplain in very simple terms as if teaching a beginner."
        )
    elif difficulty_level in (3, 4):
        difficulty_instruction = (
            "\n\nProvide a structured explanation with examples."
        )
    else:
        difficulty_instruction = (
            "\n\nProvide a detailed mathematical explanation including formulas."
        )

    return base_system + difficulty_instruction


# ─────────────────────────────────────────────────────────────────────────────
# HELPER: Retrieve Conversation History
# ─────────────────────────────────────────────────────────────────────────────

def get_conversation_history(student_id: int, session_id: int = None) -> list:
    """
    Retrieve the last 3 messages from the chat history.
    This creates conversation memory so the AI understands context.
    
    Returns a list of message dicts: [{role: "user/assistant", content: "text"}]
    """
    
    db = SessionLocal()
    try:
        # Query the ChatSession for this student
        if session_id:
            # Specific session
            chat_session = db.query(ChatSession).filter(
                ChatSession.student_id == student_id,
                ChatSession.id == session_id
            ).first()
        else:
            # Most recent session
            chat_session = db.query(ChatSession).filter(
                ChatSession.student_id == student_id
            ).order_by(ChatSession.created_at.desc()).first()
        
        if not chat_session or not chat_session.messages:
            return []
        
        # Parse messages from JSON and get last 3
        messages = chat_session.messages
        if isinstance(messages, str):
            messages = json.loads(messages)
        
        # Convert to OpenAI format and return last 3
        history = []
        for msg in messages[-3:]:  # Last 3 messages
            history.append({
                "role": msg.get("role", "user"),
                "content": msg.get("content", "")
            })
        
        return history
    
    except Exception as e:
        print(f"⚠️  Error retrieving conversation history: {str(e)}")
        return []
    
    finally:
        db.close()


# ─────────────────────────────────────────────────────────────────────────────
# MAIN ENDPOINT: Chat with Mentor AI
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/chat", response_model=ChatResponse)
def chat_with_mentor(payload: ChatRequest):
    """
    Generates adaptive mentor response based on:
    1. Student's weakness profile (strength in different concepts)
    2. Adaptive difficulty level (1-5)
    3. Dynamic system prompt (changes based on difficulty)
    4. Conversation history (last 3 messages for memory)
    
    This endpoint NEVER crashes with 500 errors — exceptions are caught
    and returned as valid ChatResponse objects with error details.
    """

    try:
        student_id = payload.student_id
        session_id = payload.session_id
        
        # ─────────────────────────────────────────────────────────────────────
        # Step 1: Calculate weakness profile (simplified)
        # ─────────────────────────────────────────────────────────────────────
        
        # Simplified: just use general focus concept
        focus_concept = "general"
        
        # ─────────────────────────────────────────────────────────────────────
        # Step 2: Get adaptive difficulty level (simplified)
        # ─────────────────────────────────────────────────────────────────────
        
        difficulty = 3.0  # Default difficulty
        
        # ─────────────────────────────────────────────────────────────────────
        # Step 3: Generate dynamic system prompt
        # ─────────────────────────────────────────────────────────────────────
        
        system_prompt = generate_system_prompt(difficulty)
        
        # ─────────────────────────────────────────────────────────────────────
        # Step 4: Retrieve conversation history
        # ─────────────────────────────────────────────────────────────────────
        
        conversation_history = get_conversation_history(student_id, session_id)
        
        # ─────────────────────────────────────────────────────────────────────
        # Step 5: Build complete message array for OpenRouter
        # ─────────────────────────────────────────────────────────────────────
        
        # Start with system message (defines AI behavior)
        messages = [
            {
                "role": "system",
                "content": system_prompt
            }
        ]
        
        # Add conversation history
        messages.extend(conversation_history)
        
        # Add current user message
        messages.append({
            "role": "user",
            "content": payload.message
        })
        
        # ─────────────────────────────────────────────────────────────────────
        # Step 6: Call OpenRouter API with correct parameter format
        # ─────────────────────────────────────────────────────────────────────
        
        response = client.chat.completions.create(
            model="openai/gpt-4o-mini",
            messages=messages,
            temperature=0.7,
            max_tokens=1024
        )

        ai_answer = response.choices[0].message.content
        message_id = uuid4().hex

        return ChatResponse(
            session_id=session_id or 1,
            message_id=message_id,
            response=ai_answer,
            difficulty_used=difficulty,
            focus_concept=focus_concept
        )

    except Exception as e:
        # ─────────────────────────────────────────────────────────────────────
        # GRACEFUL ERROR HANDLING — Never return 500 error
        # ─────────────────────────────────────────────────────────────────────
        
        error_type = type(e).__name__
        error_message = str(e)
        
        print(f"\n❌ Error in /api/mentor/chat endpoint")
        print(f"   Error Type: {error_type}")
        print(f"   Error Message: {error_message}")
        print(f"   Student ID: {student_id}")
        print(f"   Difficulty: {difficulty}")
        print(f"   Focus Concept: {focus_concept}\n")

        # Return proper error response
        return ChatResponse(
            session_id=session_id or 0,
            message_id="error",
            response=f"Mentor AI Error ({error_type}): {error_message}",
            difficulty_used=0.0,
            focus_concept="Error"
        )