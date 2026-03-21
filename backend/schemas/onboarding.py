from pydantic import BaseModel, EmailStr
from typing import List, Optional

class QuestionMcqBase(BaseModel):
    id: int
    question: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    difficulty: str

class ListeningQuestionResponse(BaseModel):
    id: int
    sentence: str
    difficulty: str
    audio_url: Optional[str] = None

class VocabularyQuestionResponse(BaseModel):
    id: int
    image_url: str

class PictureQuestionResponse(BaseModel):
    id: int
    image_url: str
    difficulty: str

# Schema for the completely generated test
class OnboardingTestStartResponse(BaseModel):
    grammar: List[QuestionMcqBase]
    sentence_correction: List[QuestionMcqBase]
    listening: List[ListeningQuestionResponse]
    vocabulary: List[VocabularyQuestionResponse]
    picture_description: List[PictureQuestionResponse]

# Input request schema for submitting an MCQ answer
class AnswerSubmitRequest(BaseModel):
    question_type: str # 'grammar', 'sentence_correction'
    question_id: int
    user_answer: str
    response_time: Optional[float] = 0.0

class AnswerSubmitResponse(BaseModel):
    status: str
    score: float

class SpeechUploadResponse(BaseModel):
    status: str
    speech_text: str
    score: float

class OnboardingResultResponse(BaseModel):
    grammar_score: float
    sentence_correction_score: float
    listening_score: float
    vocabulary_score: float
    picture_description_score: float
    total_score: float
    level: str # A1, A2, B1, B2
