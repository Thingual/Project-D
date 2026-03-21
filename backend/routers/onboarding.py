from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import cloudinary
import cloudinary.uploader

from database import get_db
from models import TestResult, UserLevel, User
from schemas.onboarding import (
    OnboardingTestStartResponse,
    AnswerSubmitRequest,
    AnswerSubmitResponse,
    SpeechUploadResponse,
    OnboardingResultResponse
)
from utils.dataset_loader import (
    generate_onboarding_test,
    get_mcq_correct_answer,
    get_listening_original_sentence,
    get_vocabulary_keywords,
    get_picture_keywords,
    get_picture_sample_answers
)
from utils.scoring import (
    calculate_similarity,
    calculate_keyword_match_score,
    score_picture_description,
    calculate_final_level,
    calculate_avt_weighted_score,
    transcribe_audio
)
# In a real app, this should protect these routes.
from routers.auth import get_current_user

# Initialize Cloudinary
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True
)

router = APIRouter()

# Placeholder for user dependency. Using a dummy ID 1 for now if no auth is set up.
# Removed dummy helper

@router.post("/start", response_model=OnboardingTestStartResponse)
def start_onboarding_test(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Generates a randomized onboarding test with 10 questions across 5 sections.
    """
    user_id = current_user.id
    # Clear previous results for this user so they start fresh
    db.query(TestResult).filter(TestResult.user_id == user_id).delete()
    db.commit()
    
    test_data = generate_onboarding_test()
    return test_data

@router.post("/answer", response_model=AnswerSubmitResponse)
def submit_mcq_answer(
    answer: AnswerSubmitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Submits a multiple-choice question answer.
    """
    user_id = current_user.id
    correct_answer = get_mcq_correct_answer(answer.question_type, answer.question_id)
    
    if correct_answer is None:
        raise HTTPException(status_code=400, detail="Invalid question type or ID")
        
    is_correct = correct_answer.lower() == answer.user_answer.lower()
    raw_score = 1.0 if is_correct else 0.0
    
    # Apply AVT weighting: faster correct answers get a bonus
    score = calculate_avt_weighted_score(raw_score, answer.response_time or 0.0, answer.question_type)
    print(f"MCQ q{answer.question_id}: raw={raw_score}, time={answer.response_time}s, AVT-weighted={score:.3f}")
    
    # Save the result
    result = TestResult(
        user_id=user_id,
        question_type=answer.question_type,
        question_id=answer.question_id,
        user_answer=answer.user_answer,
        score=score,
        response_time=answer.response_time
    )
    db.add(result)
    db.commit()
    
    return AnswerSubmitResponse(
        status="success",
        score=score
    )

@router.post("/speech", response_model=SpeechUploadResponse)
async def submit_speech(
    audio: Optional[UploadFile] = File(None),
    question_type: str = Form(...), # listening, vocabulary, picture_description
    question_id: int = Form(...),
    duration: float = Form(0.0),    # Passed from client (duration of speech in seconds)
    provided_text: Optional[str] = Form(None), # Fallback text from browser STT
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Uploads audio, transcribes it using Whisper (or uses provided_text), 
    calculates the score and saves to database.
    """
    user_id = current_user.id
    
    if question_type not in ["listening", "vocabulary", "picture_description"]:
        raise HTTPException(status_code=400, detail="Invalid question type for speech")
        
    try:
        # Transcribe or use provided text
        speech_text = ""
        audio_url = None

        if audio:
            # Read file contents
            audio_bytes = await audio.read()
            
            # Upload to Cloudinary for storage optimization
            print(f"Uploading audio to Cloudinary (bytes length: {len(audio_bytes)})...")
            upload_result = cloudinary.uploader.upload(
                audio_bytes, 
                resource_type="video",
                folder="thingual_assessments",
                public_id=f"user_{user_id}_q_{question_id}_{os.urandom(4).hex()}"
            )
            audio_url = upload_result.get("secure_url")
            print(f"Audio uploaded successfully: {audio_url}")

            if provided_text:
                print(f"Using provided text from browser: {provided_text}")
                speech_text = provided_text
            else:
                try:
                    print(f"Attempting Whisper transcription for user {user_id}, q {question_id}...")
                    speech_text = transcribe_audio(audio_bytes)
                    print(f"Transcription result: {speech_text}")
                except Exception as e:
                    print(f"Whisper error: {str(e)}")
                    # On Windows, missing ffmpeg shows as FileNotFoundError [WinError 2]
                    if "ffmpeg" in str(e).lower() or isinstance(e, FileNotFoundError) or "[WinError 2]" in str(e):
                        raise HTTPException(
                            status_code=400,
                            detail="Voice processing failed: ffmpeg is not installed on the server. Please use Chrome/Edge for browser-based transcription, or type your answer using the 'Or type' button."
                        )
                    raise e
        elif provided_text:
            print(f"Using provided text ONLY: {provided_text}")
            speech_text = provided_text
        else:
            raise HTTPException(status_code=400, detail="Either audio or text must be provided")
        
        # Calculate score based on type
        score = 0.0
        if question_type == "listening":
            print(f"Calculating similarity for listening q {question_id}...")
            original = get_listening_original_sentence(question_id)
            score = calculate_similarity(original, speech_text)
            print(f"Similarity score: {score}")
            
        elif question_type == "vocabulary":
            print(f"Calculating keyword match for vocabulary q {question_id}...")
            keywords = get_vocabulary_keywords(question_id)
            score = calculate_keyword_match_score(speech_text, keywords)
            print(f"Keyword score: {score}")
            
        elif question_type == "picture_description":
            print(f"Calculating picture description score for q {question_id}...")
            keywords = get_picture_keywords(question_id)
            samples = get_picture_sample_answers(question_id)
            score = score_picture_description(speech_text, keywords, samples, duration)
            print(f"Picture score: {score}")
            
        # Apply AVT weighting to speech scores
        raw_score = score
        score = calculate_avt_weighted_score(raw_score, duration, question_type)
        print(f"Speech q{question_id}: raw={raw_score:.3f}, time={duration}s, AVT-weighted={score:.3f}")
            
        # Save result
        result = TestResult(
            user_id=user_id,
            question_type=question_type,
            question_id=question_id,
            speech_text=speech_text,
            score=score,
            response_time=duration
        )
        db.add(result)
        db.commit()
        
        return SpeechUploadResponse(
            status="success",
            speech_text=speech_text,
            score=score
        )
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error during speech processing:\n{error_details}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to process audio: {str(e)}"
        )

@router.get("/result", response_model=OnboardingResultResponse)
def get_onboarding_result(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Calculates total score across all 10 questions and determines the user's level.
    """
    user_id = current_user.id
    
    # Fetch all results for this user (ideally taking the latest set of 10)
    # For a robust system, we would group by attempt session ID.
    # Here we assume just querying their latest responses per question type.
    results = db.query(TestResult).filter(TestResult.user_id == user_id).all()
    
    if not results:
        raise HTTPException(status_code=404, detail="No test results found")
        
    # Group scores by question type (scores are already AVT-weighted)
    scores_by_type = {
        "grammar": [],
        "sentence_correction": [],
        "listening": [],
        "vocabulary": [],
        "picture_description": []
    }
    
    for r in results:
        if r.question_type in scores_by_type:
            scores_by_type[r.question_type].append(r.score)
            
    # Calculate section scores (already AVT-weighted)
    g_score = sum(scores_by_type["grammar"]) if scores_by_type["grammar"] else 0
    sc_score = sum(scores_by_type["sentence_correction"]) if scores_by_type["sentence_correction"] else 0
    l_score = sum(scores_by_type["listening"]) if scores_by_type["listening"] else 0
    v_score = sum(scores_by_type["vocabulary"]) if scores_by_type["vocabulary"] else 0
    pd_score = sum(scores_by_type["picture_description"]) if scores_by_type["picture_description"] else 0
    
    # Total AVT-weighted score
    total_score = g_score + sc_score + l_score + v_score + pd_score
    # Calculate proficiency out of the total potential (typically 10 questions)
    # But we use the actual count in case some were missing/skipped
    num_questions = 10 
    
    # Determine CEFR level using AVT-weighted total
    level = calculate_final_level(total_score, num_questions)
    
    print(f"=== CEFR Result for user {user_id} ===")
    print(f"  Grammar: {g_score:.2f}, Sentence: {sc_score:.2f}, Listening: {l_score:.2f}")
    print(f"  Vocabulary: {v_score:.2f}, Picture: {pd_score:.2f}")
    print(f"  Total (AVT-weighted): {total_score:.2f}/{num_questions}")
    print(f"  CEFR Level: {level}")
    
    # Save level back to database
    user_level = UserLevel(
        user_id=user_id,
        level=level,
        score=total_score
    )
    db.add(user_level)
    db.commit()
    
    return OnboardingResultResponse(
        grammar_score=g_score,
        sentence_correction_score=sc_score,
        listening_score=l_score,
        vocabulary_score=v_score,
        picture_description_score=pd_score,
        total_score=total_score,
        level=level
    )
