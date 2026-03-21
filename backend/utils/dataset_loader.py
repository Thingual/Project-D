import json
import random
import os

from schemas.onboarding import (
    QuestionMcqBase, ListeningQuestionResponse,
    VocabularyQuestionResponse, PictureQuestionResponse,
    OnboardingTestStartResponse
)

# Base path for datasets
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATASETS_DIR = os.path.join(BASE_DIR, "datasets")

def load_json(filename):
    """Loads a JSON file from the datasets directory."""
    filepath = os.path.join(DATASETS_DIR, filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def get_random_questions_by_difficulty(data: list, num_easy: int, num_medium: int, num_hard: int):
    """Selects a specified number of random questions by difficulty."""
    easy = [item for item in data if item.get('difficulty') == 'easy']
    medium = [item for item in data if item.get('difficulty') == 'medium']
    hard = [item for item in data if item.get('difficulty') == 'hard']

    selected = []
    if num_easy > 0 and easy:
        selected.extend(random.sample(easy, min(num_easy, len(easy))))
    if num_medium > 0 and medium:
        selected.extend(random.sample(medium, min(num_medium, len(medium))))
    if num_hard > 0 and hard:
        selected.extend(random.sample(hard, min(num_hard, len(hard))))
    
    return selected

def generate_onboarding_test() -> OnboardingTestStartResponse:
    """Generates a randomized onboarding test matching the specified constraints."""
    
    # Load datasets
    grammar_data = load_json('grammar_dataset.json')
    sentence_data = load_json('sentence_dataset.json')
    listening_data = load_json('listening_dataset.json')
    vocab_data = load_json('vocabulary_dataset.json')
    picture_data = load_json('picture_dataset.json')

    # Grammar questions (1 easy, 1 medium, 1 hard)
    grammar_questions = get_random_questions_by_difficulty(grammar_data, 1, 1, 1)
    
    # Sentence correction questions (1 easy, 1 medium, 1 hard)
    sentence_questions = get_random_questions_by_difficulty(sentence_data, 1, 1, 1)

    # Listening questions (7-9: 3 questions)
    listening_questions = get_random_questions_by_difficulty(listening_data, 1, 1, 1)

    # Picture description (10: 1 random image)
    picture_questions = random.sample(picture_data, min(1, len(picture_data)))

    # Construct the response object directly matching Pydantic schemas
    return OnboardingTestStartResponse(
        grammar=[QuestionMcqBase(**q) for q in grammar_questions],
        sentence_correction=[QuestionMcqBase(**q) for q in sentence_questions],
        listening=[ListeningQuestionResponse(**q) for q in listening_questions],
        vocabulary=[], # Removed from active 10-question set
        picture_description=[PictureQuestionResponse(**q) for q in picture_questions]
    )

def get_mcq_correct_answer(question_type: str, question_id: int):
    if question_type == 'grammar':
        data = load_json('grammar_dataset.json')
    elif question_type == 'sentence_correction':
        data = load_json('sentence_dataset.json')
    else:
        return None
    
    for item in data:
        if item['id'] == question_id:
            return item['correct_answer']
    return None

def get_listening_original_sentence(question_id: int):
    data = load_json('listening_dataset.json')
    for item in data:
        if item['id'] == question_id:
            return item['sentence']
    return ""

def get_vocabulary_keywords(question_id: int):
    data = load_json('vocabulary_dataset.json')
    for item in data:
        if item['id'] == question_id:
            return item['keywords']
    return []

def get_picture_keywords(question_id: int):
    data = load_json('picture_dataset.json')
    for item in data:
        if item['id'] == question_id:
            return item.get('keywords', [])
    return []

def get_picture_sample_answers(question_id: int):
    data = load_json('picture_dataset.json')
    for item in data:
        if item['id'] == question_id:
            return item.get('sample_answers', [])
    return []
