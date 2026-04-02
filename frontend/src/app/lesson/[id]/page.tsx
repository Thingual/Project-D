'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { lessonService } from '@/services/lessons';
import '@/styles/lesson.css';

/* ─── Types ─────────────────────────────────────────────────── */
type Step = {
  type: 'learn' | 'vocab' | 'quiz' | 'speak' | 'example' | 'summary';
  data: any;
};

/* ─── Text-to-Speech helper ─────────────────────────────────── */
const speak = (text: string) => {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = 0.85;
    window.speechSynthesis.speak(u);
  }
};

/* ─── Build steps from content_data ─────────────────────────── */
function buildSteps(lesson: any): Step[] {
  const d = lesson.content_data ?? {};
  const steps: Step[] = [];
  const ct = lesson.content_type;

  // 1. Theory intro
  if (d.text) {
    steps.push({ type: 'learn', data: { text: d.text } });
  }

  // 2. Vocabulary cards (one step with all words)
  if (d.vocabulary && d.vocabulary.length > 0) {
    steps.push({ type: 'vocab', data: { words: d.vocabulary } });
  }

  // 3. Examples
  if (d.examples && d.examples.length > 0) {
    steps.push({ type: 'example', data: { examples: d.examples } });
  }

  // 4. Speaking prompt
  if (ct === 'speaking' || d.prompt) {
    steps.push({
      type: 'speak',
      data: {
        prompt: d.prompt || 'Practice saying the words from this lesson.',
        tip: d.tip || 'Speak clearly and naturally.',
        keywords: d.keywords || [],
        model_answer: d.model_answer || '',
      },
    });
  }

  // 5. Quiz questions (one step per question)
  if (d.questions && d.questions.length > 0) {
    for (const q of d.questions) {
      steps.push({ type: 'quiz', data: q });
    }
  }

  // 6. Summary / completion
  steps.push({ type: 'summary', data: {} });

  // Ensure at least 2 steps
  if (steps.length < 2) {
    steps.unshift({ type: 'learn', data: { text: `Let's learn about: ${lesson.title}` } });
  }

  return steps;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function LessonPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const [lesson, setLesson] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [steps, setSteps] = useState<Step[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [canContinue, setCanContinue] = useState(false);

  // Quiz state
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [quizChecked, setQuizChecked] = useState(false);
  const [quizCorrect, setQuizCorrect] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [totalQuiz, setTotalQuiz] = useState(0);

  // Vocab state
  const [revealedWords, setRevealedWords] = useState<Set<number>>(new Set());

  // Feedback
  const [feedback, setFeedback] = useState<{ show: boolean; correct: boolean; msg: string }>({
    show: false, correct: false, msg: '',
  });

  useEffect(() => {
    lessonService.getLesson(id)
      .then((data: any) => {
        setLesson(data);
        const s = buildSteps(data);
        setSteps(s);
        setLoading(false);
      })
      .catch(() => {
        setLesson({
          id, title: 'Basic Greetings', content_type: 'theory',
          content_data: {
            text: 'Use "Hello" or "Hi" to greet someone. "Good morning" is for before noon.',
            vocabulary: [
              { word: 'Hello', definition: 'A common greeting', example: 'Hello, how are you?' },
              { word: 'Hi', definition: 'Informal greeting', example: 'Hi there!' },
            ],
            examples: ['Hello, how are you?', 'Good morning, class!'],
            flashcards: [{ front: 'Hello', back: 'A standard greeting' }],
          },
        });
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    if (lesson && steps.length === 0) {
      const s = buildSteps(lesson);
      setSteps(s);
    }
  }, [lesson]);

  const step = steps[currentStep];
  const progress = steps.length > 1 ? ((currentStep) / (steps.length - 1)) * 100 : 0;

  /* ── Next step / complete ── */
  const goNext = useCallback(async () => {
    setFeedback({ show: false, correct: false, msg: '' });
    setSelectedOption(null);
    setQuizChecked(false);
    setRevealedWords(new Set());

    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
      setCanContinue(false);
    }
  }, [currentStep, steps.length]);

  const handleComplete = async () => {
    try {
      await lessonService.completeLesson(id);
    } catch { /* ignore */ }
    router.push('/path');
  };

  /* ── Quiz check ── */
  const checkQuiz = () => {
    if (!selectedOption || !step) return;
    const correct = selectedOption === step.data.answer;
    setQuizChecked(true);
    setQuizCorrect(correct);
    setTotalQuiz(prev => prev + 1);
    if (correct) {
      setCorrectCount(prev => prev + 1);
      setFeedback({ show: true, correct: true, msg: '✨ Correct!' });
    } else {
      setFeedback({ show: true, correct: false, msg: `Answer: ${step.data.answer}` });
    }
    setCanContinue(true);
    setTimeout(() => setFeedback({ show: false, correct: false, msg: '' }), 2500);
  };

  /* ── Vocab reveal ── */
  const toggleVocabReveal = (idx: number) => {
    setRevealedWords(prev => {
      const s = new Set(prev);
      s.has(idx) ? s.delete(idx) : s.add(idx);
      // Allow continue once all are revealed
      if (s.size >= (step?.data?.words?.length ?? 0)) {
        setCanContinue(true);
      }
      return s;
    });
  };

  /* ── Auto-enable continue for passive steps ── */
  useEffect(() => {
    if (!step) return;
    if (step.type === 'learn' || step.type === 'example' || step.type === 'speak') {
      const timer = setTimeout(() => setCanContinue(true), 800);
      return () => clearTimeout(timer);
    }
    if (step.type === 'summary') {
      setCanContinue(true);
    }
  }, [currentStep, step]);

  if (loading) return <div className="lesson-loading">Loading lesson...</div>;
  if (!lesson || !step) return <div className="lesson-loading">Lesson not found</div>;

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  return (
    <div className="lesson-shell">
      {/* ── Top Bar ── */}
      <div className="lesson-topbar">
        <button className="lesson-close-btn" onClick={() => router.push('/path')} title="Exit lesson">
          ✕
        </button>
        <div className="lesson-progress-track">
          <motion.div
            className="lesson-progress-fill"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
        <span className="lesson-step-counter">
          {currentStep + 1}/{steps.length}
        </span>
      </div>

      {/* ── Body ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          className="lesson-body"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.3 }}
        >
          {/* ═══════ LEARN / THEORY ═══════ */}
          {step.type === 'learn' && (
            <>
              <div className="step-type-badge learn">📖 Learn</div>
              <h2 className="step-instruction">{lesson.title}</h2>
              <div className="theory-card">
                <p className="theory-text">{step.data.text}</p>
              </div>
            </>
          )}

          {/* ═══════ VOCABULARY ═══════ */}
          {step.type === 'vocab' && (
            <>
              <div className="step-type-badge vocab">📝 New Words</div>
              <h2 className="step-instruction">Tap each word to learn it</h2>
              <div className="vocab-grid">
                {step.data.words.map((w: any, i: number) => (
                  <motion.div
                    key={i}
                    className={`vocab-item ${revealedWords.has(i) ? 'revealed' : ''}`}
                    onClick={() => { toggleVocabReveal(i); speak(w.word); }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                  >
                    <div className="vocab-word">{w.word}</div>
                    <div className="vocab-divider" />
                    {revealedWords.has(i) ? (
                      <div className="vocab-info">
                        <p className="vocab-definition">{w.definition}</p>
                        {w.example && <p className="vocab-example">"{w.example}"</p>}
                      </div>
                    ) : (
                      <div className="vocab-info">
                        <p className="vocab-definition" style={{ color: '#cbd5e1' }}>Tap to reveal</p>
                      </div>
                    )}
                    <button
                      className="vocab-speaker"
                      onClick={(e) => { e.stopPropagation(); speak(w.word); }}
                    >
                      🔊
                    </button>
                  </motion.div>
                ))}
              </div>
            </>
          )}

          {/* ═══════ EXAMPLES ═══════ */}
          {step.type === 'example' && (
            <>
              <div className="step-type-badge practice">💡 Examples</div>
              <h2 className="step-instruction">Study these sentences</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
                {step.data.examples.map((ex: string, i: number) => (
                  <motion.div
                    key={i}
                    className="example-box"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    onClick={() => speak(ex)}
                    style={{ cursor: 'pointer' }}
                  >
                    <p className="example-label">Example {i + 1}</p>
                    <p className="example-text">{ex}</p>
                  </motion.div>
                ))}
              </div>
              <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '16px', fontWeight: 600 }}>
                🔊 Tap any example to hear it spoken
              </p>
            </>
          )}

          {/* ═══════ QUIZ ═══════ */}
          {step.type === 'quiz' && (
            <>
              <div className="step-type-badge quiz">✏️ Quiz</div>
              <h2 className="quiz-question">{step.data.question}</h2>
              <div className="quiz-options">
                {step.data.options.map((opt: string, i: number) => {
                  let cls = 'quiz-option';
                  if (quizChecked) {
                    if (opt === step.data.answer) cls += ' correct';
                    else if (opt === selectedOption) cls += ' wrong';
                  } else if (opt === selectedOption) {
                    cls += ' selected';
                  }
                  return (
                    <motion.button
                      key={i}
                      className={cls}
                      onClick={() => { if (!quizChecked) setSelectedOption(opt); }}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}
                    >
                      <span className="quiz-option-num">{i + 1}</span>
                      {opt}
                    </motion.button>
                  );
                })}
              </div>
            </>
          )}

          {/* ═══════ SPEAKING ═══════ */}
          {step.type === 'speak' && (
            <>
              <div className="step-type-badge speak">🎤 Speaking</div>
              <h2 className="step-instruction">Say this out loud</h2>
              <div className="speaking-prompt">
                <p className="speaking-text">"{step.data.prompt}"</p>
                {step.data.tip && <p className="speaking-tip">💡 {step.data.tip}</p>}
              </div>
              <button
                className="mic-button"
                onClick={() => speak(step.data.model_answer || step.data.prompt)}
                title="Hear model pronunciation"
              >
                🔊
              </button>
              <p style={{ textAlign: 'center', marginTop: '12px', fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>
                Tap to hear the model answer
              </p>
            </>
          )}

          {/* ═══════ SUMMARY / DONE ═══════ */}
          {step.type === 'summary' && (
            <div className="lesson-done-wrap">
              <motion.div
                className="lesson-done-emoji"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 10 }}
              >
                🏆
              </motion.div>
              <h2 className="lesson-done-title">Lesson Complete!</h2>
              <p className="lesson-done-sub">{lesson.title}</p>
              <div className="lesson-done-stats">
                <div className="lesson-done-stat">
                  <div className="lesson-done-val">{steps.length - 1}</div>
                  <div className="lesson-done-label">Steps</div>
                </div>
                {totalQuiz > 0 && (
                  <div className="lesson-done-stat">
                    <div className="lesson-done-val">{correctCount}/{totalQuiz}</div>
                    <div className="lesson-done-label">Correct</div>
                  </div>
                )}
                <div className="lesson-done-stat">
                  <div className="lesson-done-val">+{20 + (lesson.order || 1) * 5}</div>
                  <div className="lesson-done-label">XP</div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── Feedback Banner ── */}
      <AnimatePresence>
        {feedback.show && (
          <motion.div
            className={`feedback-banner ${feedback.correct ? 'correct' : 'wrong'}`}
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
          >
            {feedback.correct ? '✅' : '❌'} {feedback.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bottom Bar ── */}
      <div className="lesson-bottom-bar">
        {step.type === 'summary' ? (
          <button className="lesson-continue-btn success" onClick={handleComplete}>
            Continue to Path →
          </button>
        ) : step.type === 'quiz' && !quizChecked ? (
          <button
            className="lesson-continue-btn primary"
            disabled={!selectedOption}
            onClick={checkQuiz}
          >
            Check Answer
          </button>
        ) : (
          <button
            className="lesson-continue-btn primary"
            disabled={!canContinue}
            onClick={goNext}
          >
            Continue
          </button>
        )}
      </div>
    </div>
  );
}
