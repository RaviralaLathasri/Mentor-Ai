"""
services/__init__.py
--------------------
Service layer containing all business logic for the AI Mentor System.

Services are responsible for:
- Data access and manipulation
- Business rule enforcement
- External integrations (LLM calls, etc.)
- Complex computations and analysis

Architecture:
- Each service is a class with dependency injection
- Services use the database session
- Services are stateless and testable
- Routers call services, not database directly

Services:
1. StudentProfileService - Manage student profiles
2. WeaknessAnalyzerService - Analyze quiz performance and track weaknesses
3. MentorAIService - Generate adaptive mentor responses
4. FeedbackService - Process and store feedback
5. AdaptiveLearningService - Coordination of adaptive loop
"""

from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from app.database import (
    Student, StudentProfile, WeaknessScore, Feedback, MentorResponse,
    AdaptiveSession, DifficultyLevel, FeedbackType
)
from app.schemas import (
    WeaknessAnalysisResult, MistakeExplanation, AdaptationUpdate,
    StudentContextSnapshot
)


# ════════════════════════════════════════════════════════════════════════════════
# SERVICE 1: StudentProfileService
# ════════════════════════════════════════════════════════════════════════════════

class StudentProfileService:
    """
    Manages student profile creation, updates, and retrieval.
    
    Enforces business rules:
    - Only one profile per student
    - Confidence must be 0.0-1.0
    - Safe profile updates
    """

    def __init__(self, db: Session):
        self.db = db

    def create_profile(
        self,
        student_id: int,
        skills: List[str] = None,
        interests: List[str] = None,
        goals: str = "",
        confidence_level: float = 0.5,
        preferred_difficulty: str = "medium"
    ) -> StudentProfile:
        """Create a new student profile."""
        # Validate student exists
        student = self.db.query(Student).filter(Student.id == student_id).first()
        if not student:
            raise ValueError(f"Student {student_id} not found")

        # Ensure no duplicate profile
        existing = self.db.query(StudentProfile).filter(
            StudentProfile.student_id == student_id
        ).first()
        if existing:
            raise ValueError(f"Profile already exists for student {student_id}")

        # Validate confidence
        if not (0.0 <= confidence_level <= 1.0):
            raise ValueError("Confidence must be between 0.0 and 1.0")

        profile = StudentProfile(
            student_id=student_id,
            skills=skills or [],
            interests=interests or [],
            goals=goals,
            confidence_level=confidence_level,
            preferred_difficulty=DifficultyLevel(preferred_difficulty)
        )
        self.db.add(profile)
        self.db.commit()
        self.db.refresh(profile)
        return profile

    def get_profile(self, student_id: int) -> Optional[StudentProfile]:
        """Get student profile by student ID."""
        return self.db.query(StudentProfile).filter(
            StudentProfile.student_id == student_id
        ).first()

    def update_profile(
        self,
        student_id: int,
        skills: Optional[List[str]] = None,
        interests: Optional[List[str]] = None,
        goals: Optional[str] = None,
        confidence_level: Optional[float] = None,
        preferred_difficulty: Optional[str] = None
    ) -> StudentProfile:
        """Update student profile fields."""
        profile = self.get_profile(student_id)
        if not profile:
            raise ValueError(f"Profile not found for student {student_id}")

        if skills is not None:
            profile.skills = skills
        if interests is not None:
            profile.interests = interests
        if goals is not None:
            profile.goals = goals
        if confidence_level is not None:
            if not (0.0 <= confidence_level <= 1.0):
                raise ValueError("Confidence must be between 0.0 and 1.0")
            profile.confidence_level = confidence_level
        if preferred_difficulty is not None:
            profile.preferred_difficulty = DifficultyLevel(preferred_difficulty)

        profile.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(profile)
        return profile

    def get_learning_context(self, student_id: int) -> Dict:
        """Get learning context for LLM prompting."""
        profile = self.get_profile(student_id)
        if not profile:
            return {}

        return profile.learning_style_summary


# ════════════════════════════════════════════════════════════════════════════════
# SERVICE 2: WeaknessAnalyzerService
# ════════════════════════════════════════════════════════════════════════════════

class WeaknessAnalyzerService:
    """
    Analyzes student quiz performance and tracks concept weaknesses.
    
    Weaknesses are used to:
    - Prioritize topics for future learning
    - Adjust explanation difficulty
    - Guide Socratic questioning
    
    Weakness score ranges:
    - 0.0 = strong understanding
    - 1.0 = very weak/struggling
    """

    def __init__(self, db: Session):
        self.db = db

    def get_or_create_weakness(
        self,
        student_id: int,
        concept_name: str
    ) -> WeaknessScore:
        """Get existing weakness score or create new one."""
        weakness = self.db.query(WeaknessScore).filter(
            WeaknessScore.student_id == student_id,
            WeaknessScore.concept_name == concept_name
        ).first()

        if not weakness:
            weakness = WeaknessScore(
                student_id=student_id,
                concept_name=concept_name,
                weakness_score=0.0
            )
            self.db.add(weakness)
            self.db.commit()
            self.db.refresh(weakness)

        return weakness

    def analyze_quiz_result(
        self,
        student_id: int,
        concept_name: str,
        is_correct: bool,
        student_answer: str = "",
        correct_answer: str = ""
    ) -> WeaknessAnalysisResult:
        """
        Analyze quiz result and update weakness score.
        
        Returns analysis result with learning priority.
        """
        weakness = self.get_or_create_weakness(student_id, concept_name)
        old_weakness = weakness.weakness_score

        # Update weakness
        weakness.update_from_quiz_result(is_correct)
        self.db.commit()

        # Detect misconception if wrong
        misconception = None
        if not is_correct and student_answer:
            misconception = self._detect_misconception(
                student_answer,
                correct_answer,
                concept_name
            )

        # Determine learning priority
        priority = self._calculate_learning_priority(weakness.weakness_score)

        return WeaknessAnalysisResult(
            concept_name=concept_name,
            is_correct=is_correct,
            old_weakness_score=round(old_weakness, 3),
            new_weakness_score=round(weakness.weakness_score, 3),
            misconception_detected=misconception,
            learning_priority=priority
        )

    def get_weakest_concepts(
        self,
        student_id: int,
        limit: int = 5
    ) -> List[WeaknessScore]:
        """Get top N weakest concepts for student."""
        return self.db.query(WeaknessScore).filter(
            WeaknessScore.student_id == student_id
        ).order_by(desc(WeaknessScore.weakness_score)).limit(limit).all()

    def _detect_misconception(
        self,
        student_answer: str,
        correct_answer: str,
        concept_name: str
    ) -> Optional[str]:
        """
        Detect misconception from wrong answer.
        
        In production, this could call a specialized LLM.
        For now, returns a simple pattern-based detection.
        """
        # Placeholder: in production call LLM to analyze misconception
        return f"Possible misconception in '{concept_name}'"

    @staticmethod
    def _calculate_learning_priority(weakness_score: float) -> str:
        """Calculate learning priority based on weakness score."""
        if weakness_score >= 0.75:
            return "critical"
        elif weakness_score >= 0.5:
            return "high"
        elif weakness_score >= 0.25:
            return "medium"
        else:
            return "low"


# ════════════════════════════════════════════════════════════════════════════════
# SERVICE 3: MentorAIService
# ════════════════════════════════════════════════════════════════════════════════

class MentorAIService:
    """
    Generates adaptive mentor responses using student context.
    
    Considers:
    - Student confidence level
    - Concept weakness on target topic
    - Preferred difficulty level
    - Recent feedback trends
    
    Generates Socratic responses (guiding questions, not direct answers).
    """

    def __init__(self, db: Session):
        self.db = db
        self.profile_service = StudentProfileService(db)
        self.weakness_service = WeaknessAnalyzerService(db)

    def generate_response(
        self,
        student_id: int,
        query: str,
        focus_concept: Optional[str] = None,
        context: Optional[Dict] = None
    ) -> Dict:
        """
        Generate adaptive mentor response.
        
        Process:
        1. Get student profile and learning context
        2. Analyze student weaknesses on target concept
        3. Determine explanation style (simple/conceptual/deep)
        4. Generate Socratic response
        5. Generate follow-up guiding question
        """
        # Get student context
        profile = self.profile_service.get_profile(student_id)
        if not profile:
            raise ValueError(f"Profile not found for student {student_id}")

        # Determine target concept
        target_concept = focus_concept or self._infer_concept(query)

        # Get weakness for target concept
        weakness = self.weakness_service.get_or_create_weakness(
            student_id,
            target_concept
        )

        # Determine explanation style based on student context
        explanation_style = self._determine_explanation_style(
            profile.confidence_level,
            weakness.weakness_score,
            profile.preferred_difficulty
        )

        # Generate response (in production: call LLM)
        response_text = self._generate_socratic_response(
            query,
            target_concept,
            explanation_style,
            profile.learning_style_summary
        )

        # Generate follow-up guiding question
        follow_up = self._generate_guiding_question(
            target_concept,
            explanation_style
        )

        # Store response for audit trail
        response_id = self._store_response(
            student_id,
            query,
            response_text,
            explanation_style,
            target_concept,
            weakness.weakness_score,
            profile.confidence_level
        )

        return {
            "response_id": response_id,
            "response": response_text,
            "explanation_style": explanation_style,
            "target_concept": target_concept,
            "follow_up_question": follow_up
        }

    @staticmethod
    def _determine_explanation_style(
        confidence: float,
        weakness: float,
        preferred_difficulty: DifficultyLevel
    ) -> str:
        """
        Determine explanation style based on student state.
        
        Rules:
        - High weakness + low confidence → "simple" (very basic)
        - Medium weakness & confidence → "conceptual" (structured with examples)
        - Low weakness + high confidence → "deep" (rigorous, mathematical)
        """
        if weakness > 0.6 or confidence < 0.3:
            return "simple"
        elif 0.3 <= weakness <= 0.6 and 0.3 <= confidence <= 0.7:
            return "conceptual"
        else:
            return "deep"

    @staticmethod
    def _infer_concept(query: str) -> str:
        """
        Infer concept from student query.
        
        Uses keyword extraction to identify likely concepts from the question.
        In production: use NLP/NER for more sophisticated topic extraction.
        """
        query_lower = query.lower()
        
        # Comprehensive concept keywords mapping
        concept_keywords = {
            'gradient descent': ['gradient', 'descent', 'optimization', 'learning rate', 'backprop'],
            'machine learning': ['machine learning', 'ml', 'supervised', 'unsupervised', 'classification', 'regression', 'train', 'model'],
            'neural networks': ['neural', 'network', 'deep learning', 'activation', 'backpropagation', 'layer', 'perceptron'],
            'data analysis': ['data analysis', 'data analyst', 'analytics', 'analyze data', 'data science', 'data scientist', 'data-driven'],
            'statistics': ['statistics', 'statistic', 'probability', 'distribution', 'variance', 'mean', 'median', 'standard deviation', 'hypothesis'],
            'pandas': ['pandas', 'dataframe', 'series', 'groupby', 'merge', 'pivot'],
            'sql': ['sql', 'query', 'select', 'where', 'join', 'aggregate', 'database'],
            'python': ['python', 'list', 'dictionary', 'function', 'class', 'module', 'import'],
            'linear algebra': ['matrix', 'vector', 'linear', 'eigenvalue', 'determinant', 'transpose'],
            'calculus': ['derivative', 'integral', 'limit', 'function', 'differential', 'chain rule'],
            'recursion': ['recursion', 'recursive', 'base case', 'stack', 'return'],
            'algorithm': ['algorithm', 'sorting', 'searching', 'complexity', 'big o', 'time complexity'],
            'data structure': ['data structure', 'array', 'linked list', 'hash table', 'tree', 'graph', 'queue', 'stack'],
            'web development': ['html', 'css', 'javascript', 'react', 'api', 'server', 'frontend', 'backend'],
            'git': ['git', 'commit', 'branch', 'merge', 'repository', 'version control', 'push', 'pull'],
            'visualization': ['visualization', 'plot', 'chart', 'graph', 'matplotlib', 'seaborn', 'tableau', 'dashboard'],
            'excel': ['excel', 'spreadsheet', 'pivot table', 'vlookup', 'formulas'],
            'business analytics': ['business', 'analytics', 'kpi', 'dashboard', 'roi', 'metrics'],
        }
        
        # Check which concept has the most keyword matches
        best_concept = None
        max_matches = 0
        
        for concept, keywords in concept_keywords.items():
            matches = sum(1 for keyword in keywords if keyword in query_lower)
            if matches > max_matches:
                max_matches = matches
                best_concept = concept
        
        return best_concept if max_matches > 0 else 'general'

    @staticmethod
    def _generate_socratic_response(
        query: str,
        concept: str,
        style: str,
        context: Dict
    ) -> str:
        """
        Generate Socratic response (guiding questions, not direct answers).
        
        Calls LLM with adaptive prompts based on explanation style.
        """
        try:
            from openai import OpenAI
            
            # Initialize OpenAI client (supports local or OpenRouter)
            client = OpenAI(
                api_key="any-key"  # Using local or mock mode
            )
            
            # Craft style-specific system prompt
            style_guidance = {
                "simple": "Use very basic language. Break down the concept into small, digestible pieces. Avoid jargon.",
                "conceptual": "Explain the concept with structured approach. Use examples and analogies. Focus on understanding.",
                "deep": "Provide rigorous, mathematical explanation. Include derivations and formal definitions."
            }
            
            system_prompt = f"""You are an expert Socratic mentor specializing in {concept}.
Your role is to guide students through understanding by asking thoughtful questions and providing hints.
DO NOT give direct answers. Instead, ask guiding questions that help students discover the answer themselves.

Explanation style: {style}
{style_guidance.get(style, '')}

Student context: {context or 'General learning'}

Respond concisely with 2-3 guiding questions or hints that help the student understand."""

            # Format user message
            user_message = f"The student asks: '{query}'\n\nHelp them understand '{concept}' through Socratic questioning."
            
            # Call LLM (with fallback to mock response)
            try:
                response = client.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_message}
                    ],
                    temperature=0.7,
                    max_tokens=300
                )
                return response.choices[0].message.content
            except Exception as e:
                # Fallback: Return a context-aware response
                print(f"[WARNING] LLM call failed ({str(e)}), using fallback response")
                return MentorAIService._generate_fallback_response(query, concept, style)
                
        except ImportError:
            # Fallback if openai not available
            return MentorAIService._generate_fallback_response(query, concept, style)
    
    @staticmethod
    def _generate_fallback_response(query: str, concept: str, style: str) -> str:
        """
        Generate a fallback Socratic response when LLM is unavailable.
        Provides query-specific guidance instead of generic responses.
        """
        query_lower = query.lower()
        
        # Detect question type from the query
        is_how_question = any(word in query_lower for word in ['how', 'what is the process', 'steps', 'procedure'])
        is_why_question = any(word in query_lower for word in ['why', 'reason', 'purpose', 'importance'])
        is_what_question = any(word in query_lower for word in ['what is', 'definition', 'meaning', 'concept'])
        is_learn_question = any(word in query_lower for word in ['learn', 'study', 'understand', 'master', 'skill'])
        is_career_question = any(word in query_lower for word in ['career', 'job', 'profession', 'role', 'analyst'])
        is_recommend_question = any(word in query_lower for word in ['recommend', 'suggest', 'certificates', 'courses', 'resources', 'best'])
        
        # Special handling for direct definition questions
        if is_what_question and len(query.split()) <= 5 and not any(word in query_lower.split() for word in ['how', 'why', 'learn']):
            # Provide direct definition for simple "what is" questions
            definitions = {
                'machine learning': "Machine learning is a subset of artificial intelligence that enables computers to learn and improve from experience without being explicitly programmed. It uses algorithms to identify patterns in data and make predictions or decisions.",
                'gradient descent': "Gradient descent is an optimization algorithm used to minimize a function by iteratively moving in the direction of steepest descent, commonly used in machine learning to train models by adjusting parameters.",
                'neural networks': "Neural networks are computing systems inspired by biological neural networks, consisting of interconnected nodes (neurons) that process and transmit information, used for pattern recognition and machine learning tasks.",
                'data analysis': "Data analysis is the process of inspecting, cleaning, transforming, and modeling data to discover useful information, draw conclusions, and support decision-making.",
                'statistics': "Statistics is the study of data collection, analysis, interpretation, and presentation, involving methods for summarizing and drawing inferences from data.",
                'python': "Python is a high-level programming language known for its simplicity and readability, widely used for data science, web development, automation, and artificial intelligence.",
                'sql': "SQL (Structured Query Language) is a programming language designed for managing and manipulating relational databases, used for querying, updating, and managing data.",
                'pandas': "Pandas is a Python library for data manipulation and analysis, providing data structures like DataFrames for working with structured data.",
                'linear algebra': "Linear algebra is a branch of mathematics dealing with vectors, matrices, and linear transformations, fundamental to many areas including machine learning and computer graphics.",
                'calculus': "Calculus is a branch of mathematics that studies continuous change, including derivatives (rates of change) and integrals (accumulation), essential for understanding optimization and many algorithms.",
                'recursion': "Recursion is a programming technique where a function calls itself to solve a problem by breaking it down into smaller, similar subproblems.",
                'algorithm': "An algorithm is a step-by-step procedure or formula for solving a problem, often used in computer science to process data and perform calculations.",
                'data structure': "A data structure is a way of organizing and storing data so that it can be accessed and modified efficiently, such as arrays, lists, trees, and graphs.",
                'web development': "Web development is the process of creating websites and web applications, involving frontend (user interface) and backend (server-side) technologies.",
                'git': "Git is a distributed version control system that tracks changes in source code during software development, enabling collaboration and version management.",
                'visualization': "Data visualization is the graphical representation of information and data, using charts, graphs, and other visual elements to communicate insights effectively.",
                'excel': "Excel is a spreadsheet software developed by Microsoft, used for data analysis, calculations, charting, and database management.",
                'business analytics': "Business analytics is the practice of using data analysis techniques to understand business performance and make informed decisions."
            }
            
            if concept in definitions:
                definition = definitions[concept]
                if style == "simple":
                    return f"{definition}\n\nCan you think of a real-world example where this concept is used?"
                elif style == "conceptual":
                    return f"{definition}\n\nHow does this concept relate to problems you've encountered?"
                else:  # deep
                    return f"{definition}\n\nWhat mathematical principles underlie this concept?"
            else:
                # Generic definition for unknown concepts
                return f"'{concept}' refers to a specific area of knowledge or technique. To understand it better: What context or field is this concept from? What do you already know about related topics?"
        
        # Special handling for recommendation questions
        if is_recommend_question:
            if 'certificate' in query_lower or 'certification' in query_lower:
                if concept == 'machine learning' or concept == 'general':
                    return """Here are some highly recommended certifications for machine learning:

**Beginner to Intermediate:**
- Google Data Analytics Professional Certificate (Coursera)
- IBM Data Science Professional Certificate (Coursera)
- Microsoft Certified: Azure AI Fundamentals
- AWS Certified Machine Learning - Specialty

**Advanced:**
- TensorFlow Developer Certificate (Google)
- Certified Machine Learning Engineer (SAS)
- Deep Learning Specialization (Coursera/Andrew Ng)

**Comprehensive Programs:**
- Machine Learning Engineer Nanodegree (Udacity)
- AI Product Manager Certification (Duke University/Coursera)

Start with Google's Data Analytics certificate if you're new to the field. Which level interests you most?"""
                elif concept == 'data analysis':
                    return """Recommended certifications for data analysis:

**Entry Level:**
- Google Data Analytics Professional Certificate (Coursera) - Most popular
- IBM Data Analyst Professional Certificate (Coursera)
- Microsoft Certified: Power BI Data Analyst Associate

**Intermediate:**
- SAS Certified Data Scientist
- Cloudera Certified Associate (CCA) Data Analyst
- Oracle Business Intelligence Certification

**Advanced:**
- Certified Analytics Professional (CAP)
- INFORMS Certified Analytics Professional

The Google certificate is excellent for beginners and highly recognized by employers. What specific tools are you most interested in learning?"""
                else:
                    return f"For '{concept}' certifications, I recommend checking platforms like Coursera, edX, and LinkedIn Learning. Look for industry-recognized credentials from Google, IBM, or Microsoft. What specific skills are you looking to certify?"
            
            elif 'course' in query_lower:
                return f"""For learning '{concept}', here are excellent course recommendations:

**Online Platforms:**
- Coursera: Specializations from top universities
- edX: University-level courses from MIT, Harvard, etc.
- Udacity: Practical, career-focused nanodegrees
- DataCamp: Interactive coding courses
- LinkedIn Learning: Professional skill development

**Free Resources:**
- Khan Academy: Foundational concepts
- freeCodeCamp: Practical projects
- YouTube channels: 3Blue1Brown (math), StatQuest (statistics)

What learning style works best for you - video lectures, hands-on projects, or reading?"""
            
            else:
                return f"""For '{concept}' recommendations, consider:

**Learning Resources:**
- Online courses on Coursera/edX
- Books by domain experts
- YouTube tutorials and explanations
- Practice platforms like Kaggle, LeetCode

**Tools & Technologies:**
- Start with free/open-source options
- Build practical projects
- Join communities (Stack Overflow, Reddit)

What type of recommendation are you looking for - courses, books, tools, or career advice?"""
        
        # Generate query-specific responses based on style and question type
        if is_learn_question or is_career_question:
            # For "how to learn X" or career-related questions - provide PRACTICAL guidance
            if style == "simple":
                return f"""Here's a practical roadmap to learn '{concept}':
1. **Start with basics**: Learn the fundamental concepts and terminology
2. **Hands-on practice**: Work on small projects using real data
3. **Build skills progressively**: Master one tool/technology at a time
4. **Apply what you learn**: Use '{concept}' to solve real problems
5. **Get feedback**: Share your work and learn from others

What specific aspect of '{concept}' interests you most?"""
            elif style == "conceptual":
                return f"""To become proficient in '{concept}', focus on these key areas:
- **Core skills**: Master the essential tools and techniques
- **Data handling**: Learn how to collect, clean, and prepare data
- **Analysis methods**: Understand different approaches and when to use them
- **Visualization**: Communicate insights effectively through charts and dashboards
- **Business context**: Understand how '{concept}' drives decision-making

Consider starting with online courses on platforms like Coursera, edX, or Udacity. What experience level are you at currently?"""
            else:  # deep
                return f"""For comprehensive mastery of '{concept}', develop expertise across:
- **Technical foundation**: Advanced statistics, programming, and algorithms
- **Domain knowledge**: Industry-specific applications and best practices
- **Tools and technologies**: Latest frameworks, cloud platforms, and automation
- **Soft skills**: Problem-solving, communication, and project management
- **Continuous learning**: Stay updated with emerging trends and research

Recommended path: Start with structured learning (certifications), then build portfolio projects, contribute to open-source, and network with professionals. What are your long-term career goals in this field?"""
        
        elif is_how_question:
            # For "how X works" questions  
            if style == "simple":
                return f"""Let's break down how '{concept}' works:
1. What happens first? (What's the initial input or condition?)
2. What happens in the middle? (What are the main steps?)
3. What's the final result? (How do you know it worked?)
4. Can you find a simple real-world example?"""
            elif style == "conceptual":
                return f"""To understand how '{concept}' works:
- What are the key components or parts involved?
- How do these components interact with each other?
- What's the sequence of events or logic?
- What assumptions does this rely on?
- Where might this approach fail or have limitations?"""
            else:  # deep
                return f"""For a deep understanding of how '{concept}' works:
- What are the underlying mechanisms and algorithms?
- What is the mathematical or theoretical basis?
- How does performance scale with complexity?
- What are the optimization strategies?
- How does this compare to alternative approaches?"""
        
        elif is_why_question:
            # For "why X" questions
            if style == "simple":
                return f"""Great question about why '{concept}' matters:
1. What problem does '{concept}' solve?
2. What would happen without '{concept}'?
3. Can you think of examples where '{concept}' is helpful?
4. Who benefits from using '{concept}'?"""
            elif style == "conceptual":
                return f"""To understand why '{concept}' is important:
- What problems existed before '{concept}' was developed?
- What makes '{concept}' better than alternatives?
- How does it impact efficiency, accuracy, or outcomes?
- What industries or fields rely on '{concept}'?
- How might '{concept}' evolve in the future?"""
            else:  # deep
                return f"""For deep insight into why '{concept}' matters:
- What are the historical and theoretical origins?
- What are the fundamental advantages and trade-offs?
- How does '{concept}' integrate with related fields?
- What are current research frontiers and innovations?
- What are the long-term implications and impact?"""
        
        elif is_what_question or concept == 'general':
            # Default for "what is" or general questions
            if style == "simple":
                return f"""Let's explore '{concept}' together:
1. In one sentence, how would you describe '{concept}'?
2. What are the most important parts to know?
3. Can you think of real examples you've seen?
4. Why do you think this topic matters?"""
            elif style == "conceptual":
                return f"""To build understanding of '{concept}':
- What's the core definition and key terminology?
- What are the main components or categories?
- How does '{concept}' relate to things you already understand?
- What are common misconceptions about '{concept}'?
- How would you explain it to someone new to the topic?"""
            else:  # deep
                return f"""For comprehensive knowledge of '{concept}':
- What are the precise technical definitions?
- What are the theoretical foundations and principles?
- How does '{concept}' generalize or extend?
- What are the mathematical or formal proofs?
- What are the cutting-edge advances in this area?"""
        
        # Fallback for any unmatched pattern
        if style == "simple":
            return f"""Let's discuss '{concept}' step by step:
1. What do you already know about this topic?
2. What specific aspect are you most curious about?
3. Can you think of ways you'd use this in practice?
4. What would help make this clearer for you?"""
        elif style == "conceptual":
            return f"""Regarding '{concept}':
- What is the central concept or idea?
- How does it fit into the broader field?
- What are practical applications?
- How can you deepen your understanding through examples?"""
        else:
            return f"""Exploring '{concept}' in depth:
- What are the foundational principles?
- What are advanced topics and extensions?
- How does this connect to cutting-edge research?
- What are the open questions in this field?"""

    @staticmethod
    def _generate_guiding_question(concept: str, style: str) -> str:
        """Generate follow-up guiding question to deepen understanding."""
        guiding_questions = {
            "simple": [
                f"Can you explain {concept} in simpler terms?",
                f"What's the first step to understanding {concept}?",
                f"What real-world example relates to {concept}?"
            ],
            "conceptual": [
                f"How would you compare {concept} to something you already know?",
                f"What happens if you change one variable in {concept}?",
                f"Can you describe the relationship between the parts of {concept}?"
            ],
            "deep": [
                f"What's the mathematical proof behind {concept}?",
                f"How does {concept} extend to more complex scenarios?",
                f"What are the limitations and assumptions in {concept}?"
            ]
        }
        
        import random
        questions = guiding_questions.get(style, guiding_questions["conceptual"])
        return random.choice(questions)

    def _store_response(
        self,
        student_id: int,
        query: str,
        response: str,
        style: str,
        concept: str,
        weakness: float,
        confidence: float
    ) -> str:
        """Store response for audit trail and learning."""
        import uuid
        response_id = str(uuid.uuid4())

        mentor_response = MentorResponse(
            response_id=response_id,
            student_id=student_id,
            student_weakness_state={"concepts": [concept]},
            student_confidence=confidence,
            query=query,
            response=response,
            explanation_style=style,
            target_concept=concept
        )
        self.db.add(mentor_response)
        self.db.commit()

        return response_id


# ════════════════════════════════════════════════════════════════════════════════
# SERVICE 4: FeedbackService
# ════════════════════════════════════════════════════════════════════════════════

class FeedbackService:
    """
    Processes human-in-the-loop feedback.
    
    Updates adaptive system based on student reactions to mentor responses.
    """

    def __init__(self, db: Session):
        self.db = db
        self.profile_service = StudentProfileService(db)

    def submit_feedback(
        self,
        student_id: int,
        response_id: str,
        feedback_type: str,
        rating: Optional[float] = None,
        comments: Optional[str] = None,
        focus_concept: Optional[str] = None
    ) -> Tuple[Feedback, Optional[AdaptationUpdate]]:
        """
        Process student feedback and trigger adaptations.
        
        Returns: (feedback record, adaptation result if any)
        """
        # Store feedback
        feedback = Feedback(
            student_id=student_id,
            response_id=response_id,
            feedback_type=FeedbackType(feedback_type),
            rating=rating,
            comments=comments,
            focus_concept=focus_concept
        )
        self.db.add(feedback)
        self.db.commit()
        self.db.refresh(feedback)

        # Adapt based on feedback
        adaptation = self._adapt_to_feedback(
            student_id,
            feedback_type,
            rating
        )

        return feedback, adaptation

    def _adapt_to_feedback(
        self,
        student_id: int,
        feedback_type: str,
        rating: Optional[float] = None
    ) -> Optional[AdaptationUpdate]:
        """
        Apply adaptive changes based on feedback.
        
        Rules:
        - "too_easy" → increase difficulty
        - "too_hard" → decrease difficulty
        - Low rating → adjust confidence estimate
        - "helpful" → maintain current level
        """
        profile = self.profile_service.get_profile(student_id)
        if not profile:
            return None

        old_difficulty = profile.preferred_difficulty.value
        adjustment_reason = ""

        # Adjust based on feedback
        if feedback_type == "too_easy":
            if profile.preferred_difficulty == DifficultyLevel.EASY:
                profile.preferred_difficulty = DifficultyLevel.MEDIUM
                adjustment_reason = "Content was too easy; increasing difficulty"
            elif profile.preferred_difficulty == DifficultyLevel.MEDIUM:
                profile.preferred_difficulty = DifficultyLevel.HARD
                adjustment_reason = "Content was too easy; increasing to hard"

        elif feedback_type == "too_hard":
            if profile.preferred_difficulty == DifficultyLevel.HARD:
                profile.preferred_difficulty = DifficultyLevel.MEDIUM
                adjustment_reason = "Content was too hard; decreasing difficulty"
            elif profile.preferred_difficulty == DifficultyLevel.MEDIUM:
                profile.preferred_difficulty = DifficultyLevel.EASY
                adjustment_reason = "Content was too hard; decreasing to easy"

        # Adjust confidence based on rating
        if rating:
            if rating <= 2.0:  # Low satisfaction
                profile.confidence_level = max(0.0, profile.confidence_level - 0.1)
            elif rating >= 4.0:  # High satisfaction
                profile.confidence_level = min(1.0, profile.confidence_level + 0.1)

        profile.updated_at = datetime.utcnow()
        self.db.commit()

        new_difficulty = profile.preferred_difficulty.value
        confidence_change = profile.confidence_level

        return AdaptationUpdate(
            previous_difficulty=old_difficulty,
            new_difficulty=new_difficulty,
            adjustment_reason=adjustment_reason,
            confidence_change=confidence_change
        ) if old_difficulty != new_difficulty or adjustment_reason else None


# ════════════════════════════════════════════════════════════════════════════════
# SERVICE 5: AdaptiveLearningService
# ════════════════════════════════════════════════════════════════════════════════

class AdaptiveLearningService:
    """
    Orchestrates the complete adaptive learning loop.
    
    Coordinates all other services to create a seamless learning experience.
    """

    def __init__(self, db: Session):
        self.db = db
        self.profile_service = StudentProfileService(db)
        self.weakness_service = WeaknessAnalyzerService(db)
        self.mentor_service = MentorAIService(db)
        self.feedback_service = FeedbackService(db)

    def get_student_context_snapshot(self, student_id: int) -> StudentContextSnapshot:
        """Get full snapshot of student learning context."""
        profile = self.profile_service.get_profile(student_id)
        weaknesses = self.weakness_service.get_weakest_concepts(student_id, limit=3)

        # Determine sentiment from recent feedback
        recent_feedback = self.db.query(Feedback).filter(
            Feedback.student_id == student_id
        ).order_by(desc(Feedback.created_at)).limit(5).all()

        sentiment = self._analyze_feedback_sentiment(recent_feedback)

        return StudentContextSnapshot(
            confidence_level=profile.confidence_level,
            primary_weakness_concepts=[w.concept_name for w in weaknesses],
            strength_areas=[],  # TODO: Extract strength areas
            preferred_difficulty=profile.preferred_difficulty.value,
            recent_feedback_sentiment=sentiment
        )

    @staticmethod
    def _analyze_feedback_sentiment(feedbacks: List[Feedback]) -> str:
        """Analyze sentiment of recent feedback."""
        if not feedbacks:
            return "neutral"

        positive = sum(1 for f in feedbacks if f.feedback_type == FeedbackType.HELPFUL)
        negative = sum(1 for f in feedbacks if f.feedback_type in [
            FeedbackType.TOO_HARD,
            FeedbackType.UNCLEAR
        ])

        if positive > negative:
            return "positive"
        elif negative > positive:
            return "negative"
        else:
            return "neutral"


# Export all services for easy importing
__all__ = [
    "StudentProfileService",
    "WeaknessAnalyzerService",
    "MentorAIService",
    "FeedbackService",
    "AdaptiveLearningService"
]
