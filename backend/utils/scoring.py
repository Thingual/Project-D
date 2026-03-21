try:
    import whisper  # type: ignore[import]
except ImportError:
    whisper = None  # type: ignore[assignment]
import os
import io
import tempfile
import string
import re
from typing import Optional, List

# Load Whisper model lazily to avoid long startup times if not used immediately
_whisper_model = None

def get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        if whisper is None:
            raise RuntimeError("Whisper is not installed. Run: pip install openai-whisper")
        _whisper_model = whisper.load_model("base")
    return _whisper_model

def transcribe_audio(audio_bytes: bytes) -> str:
    """
    Saves audio bytes to a temporary file, transcribes using Whisper,
    and returns the transcribed text.
    """
    model = get_whisper_model()
    
    # Whisper requires a file path, so we use a temp file
    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_audio:
        temp_audio.write(audio_bytes)
        temp_file_path = temp_audio.name
    
    text = ""
    try:
        # Transcribe
        result = model.transcribe(temp_file_path)
        text = result["text"].strip()
    except Exception as e:
        print(f"Whisper transcription failed: {e}")
        if "ffmpeg" in str(e).lower():
            print("ERROR: ffmpeg is not installed or not in PATH. Please install ffmpeg.")
        raise e
    finally:
        # Clean up temp file
        if os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except:
                pass
    return text

def clean_text(text: str) -> str:
    """Removes punctuation and converts to lowercase for better matching."""
    text = text.lower()
    text = text.translate(str.maketrans('', '', string.punctuation))
    # Replace multiple spaces with a single space
    text = re.sub(' +', ' ', text)
    return text.strip()

def calculate_similarity(original: str, spoken: str) -> float:
    """
    Calculates a simple Jaccard similarity score between original and spoken text.
    Returns a score from 0.0 to 1.0
    """
    orig_clean = clean_text(original)
    spoken_clean = clean_text(spoken)
    
    orig_words = set(orig_clean.split())
    spoken_words = set(spoken_clean.split())
    
    if not orig_words:
        return 0.0
        
    intersection = orig_words.intersection(spoken_words)
    union = orig_words.union(spoken_words)
    
    if not union:
        return 0.0
        
    return len(intersection) / len(union)

def calculate_keyword_match_score(spoken: str, keywords: list) -> float:
    """
    Calculates percentage of keywords present in the spoken text.
    Returns a score from 0.0 to 1.0
    """
    spoken_clean = clean_text(spoken)
    spoken_words = set(spoken_clean.split())
    
    if not keywords:
        return 0.0

    matched = sum(
        1 for kw in keywords
        if clean_text(kw) in spoken_words or any(clean_text(kw) in word for word in spoken_words)
    )

    return float(matched) / len(keywords)

def score_picture_description(spoken: str, keywords: list, sample_answers: Optional[List[str]] = None, speech_duration: float = 10.0) -> float:
    """
    Scores picture description based on keywords, word count, unique words, 
    similarity to sample answers, and duration.
    Returns a score from 0.0 to 1.0
    """
    spoken_clean = clean_text(spoken)
    words = spoken_clean.split()
    
    if not words:
        return 0.0
        
    word_count = len(words)
    unique_words = len(set(words))
    
    # Keyword score (up to 40% of total score)
    kw_score = calculate_keyword_match_score(spoken, keywords) * 0.4
    
    # Sample similarity bonus (up to 30% of total score)
    sim_score = 0.0
    if sample_answers:
        max_sim = 0.0
        for ans in sample_answers:
            sim = calculate_similarity(ans, spoken)
            if sim > max_sim:
                max_sim = sim
        sim_score = max_sim * 0.3
    else:
        # If no samples, give standard length-based score
        sim_score = min(word_count / 20.0, 1.0) * 0.3
    
    # Unique vocabulary score (up to 20% of total score, target: 8+ unique words)
    vocab_score = min(unique_words / 8.0, 1.0) * 0.2
    
    # Duration score (up to 10% of total score, target: at least 5 seconds)
    duration_score = min(speech_duration / 5.0, 1.0) * 0.1
    
    total_score = kw_score + sim_score + vocab_score + duration_score
    return min(total_score, 1.0)

def calculate_avt_bonus(response_time: float, question_type: str) -> float:
    """
    Answer Velocity Tracking (AVT) bonus.
    Rewards faster correct answers with a velocity multiplier.
    
    Time thresholds vary by question type:
    - MCQ (grammar/sentence_correction): ideal < 10s, max 30s
    - Listening: ideal < 15s, max 45s  
    - Picture description: ideal < 30s, max 90s
    
    Returns a multiplier between 1.0 (slow) and 1.25 (very fast).
    """
    if response_time <= 0:
        return 1.0
    
    # Define ideal and max times per question type
    thresholds = {
        'grammar': (10, 30),
        'sentence_correction': (10, 30),
        'listening': (15, 45),
        'vocabulary': (20, 60),
        'picture_description': (30, 90),
    }
    
    ideal_time, max_time = thresholds.get(question_type, (15, 45))
    
    if response_time <= ideal_time:
        # Very fast — full 25% bonus
        return 1.25
    elif response_time >= max_time:
        # Too slow — no bonus
        return 1.0
    else:
        # Linear interpolation between ideal and max
        # Closer to ideal → higher bonus
        ratio = 1.0 - ((response_time - ideal_time) / (max_time - ideal_time))
        return 1.0 + (0.25 * ratio)


def calculate_avt_weighted_score(raw_score: float, response_time: float, question_type: str) -> float:
    """
    Combines raw correctness score with AVT bonus.
    
    Formula: final_score = raw_score * avt_multiplier
    Capped at 1.0 per question.
    
    This rewards users who answer correctly AND quickly.
    Slow but correct answers still get full raw_score.
    Fast but wrong answers get 0 * multiplier = 0 (no gaming).
    """
    avt_multiplier = calculate_avt_bonus(response_time, question_type)
    weighted = raw_score * avt_multiplier
    return min(weighted, 1.0)


def calculate_final_level(total_weighted_score: float, num_questions: int = 10) -> str:
    """
    Maps the AVT-weighted total score to CEFR levels.
    
    Score is the sum of individual question scores (each 0.0–1.0, boosted by AVT up to 1.0).
    Maximum possible: num_questions (10).
    
    CEFR Mapping:
    - A1 (Beginner):        0 – 25%  (0.0 – 2.5)
    - A2 (Elementary):      26 – 40% (2.6 – 4.0) 
    - B1 (Intermediate):    41 – 60% (4.1 – 6.0)
    - B2 (Upper-Intermediate): 61 – 75% (6.1 – 7.5)
    - C1 (Advanced):        76 – 90% (7.6 – 9.0)
    - C2 (Proficient):      91 – 100% (9.1 – 10.0)
    """
    percentage = (total_weighted_score / num_questions) * 100
    
    if percentage <= 25:
        return "A1"
    elif percentage <= 40:
        return "A2"
    elif percentage <= 60:
        return "B1"
    elif percentage <= 75:
        return "B2"
    elif percentage <= 90:
        return "C1"
    else:
        return "C2"
