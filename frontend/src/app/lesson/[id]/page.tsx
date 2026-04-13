'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { lessonService } from '@/services/lessons';
import '@/styles/lesson.css';

const speak = (text: string) => {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = 0.85;
    window.speechSynthesis.speak(u);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// buildSteps — maps every JSON task type to an internal step type
// ─────────────────────────────────────────────────────────────────────────────
function buildSteps(lesson: any): any[] {
  const steps: any[] = [];

  // New JSON format (A1-unit 1 files) — tasks array at root
  const tasks: any[] = lesson.tasks ?? lesson.content_data?.tasks ?? [];

  if (tasks.length > 0) {
    for (const task of tasks) {
      const c = task.content ?? {};

      switch (task.type) {
        // ── Teaching cards ──────────────────────────────────────────────────
        case 'learn_card':
          steps.push({
            type: 'LEARN_CARD',
            data: {
              title: task.title,
              explanation: c.explanation,
              items: c.items,               // [{phrase, note}]
              table: c.table,               // [{subject, verb, example}]
              short_forms: c.short_forms,
              examples: c.examples,         // [{statement, question, yes_reply, no_reply}]
              rule: c.rule,                 // grammar rule string
              summary: c.summary,           // [{lesson, topic}] — for review cards
              congratulations: c.congratulations,
              all_grammar_covered: c.all_grammar_covered,
              all_vocabulary_covered: c.all_vocabulary_covered,
              what_you_learned: c.what_you_learned,
            },
          });
          break;

        case 'listen_repeat':
          // Show as a LEARN_CARD with pronunciation instructions + speak buttons
          steps.push({
            type: 'LISTEN_REPEAT',
            data: {
              title: task.title,
              instruction: c.instruction,
              phrases: c.phrases, // [{text, audio_key}]
            },
          });
          break;

        // ── Multiple choice ─────────────────────────────────────────────────
        case 'mcq':
        case 'scenario_mcq': {
          const correctIdx = c.correct_index ?? 0;
          steps.push({
            type: 'MULTIPLE_CHOICE',
            data: {
              question: c.scenario
                ? `📍 ${c.scenario}\n\n${c.question}`
                : c.question,
              options: c.options,
              correct_index: correctIdx,
              explanation: c.explanation,
            },
          });
          break;
        }

        // ── Fill in the blank ────────────────────────────────────────────────
        case 'fill_blank': {
          if (c.blanks && Array.isArray(c.blanks)) {
            // Multi-blank → ONE combined step so user fills all blanks before checking
            steps.push({
              type: 'FILL_BLANK_MULTI',
              data: {
                sentence: c.sentence,   // original with _+ placeholders
                blanks: c.blanks,       // [{ position, options, correct }]
                explanation: c.explanation,
              },
            });
          } else {
            // Single blank
            let sentence = c.sentence;
            if (/_+/.test(sentence)) {
              sentence = sentence.replace(/_+/, '[___]');
            }
            steps.push({
              type: 'FILL_BLANK',
              data: {
                sentence,
                options: c.options,
                correct: c.correct,
                explanation: c.explanation,
                full_sentence: c.sentence,
              },
            });
          }
          break;
        }

        // ── Sort / scramble words ────────────────────────────────────────────
        case 'sort_words': {
          const shuffled = [...(c.words ?? [])].sort(() => Math.random() - 0.5);
          steps.push({
            type: 'SCRAMBLE',
            data: {
              instruction: c.instruction,
              shuffled_words: shuffled,
              correct_sequence: c.correct_sentence,
              alternative_correct: c.alternative_correct,
              explanation: c.explanation,
            },
          });
          break;
        }

        // ── Matching pairs ──────────────────────────────────────────────────
        case 'match_pairs': {
          const pairs = (c.pairs ?? []).map((p: any) => ({
            left: p.prompt,
            right: p.answer,
          }));
          // Shuffle the right column
          const rights = pairs.map((p: any) => p.right).sort(() => Math.random() - 0.5);
          const shuffledPairs = pairs.map((p: any, i: number) => ({
            left: p.left,
            right: rights[i],
          }));
          steps.push({
            type: 'MATCHING',
            data: {
              instruction: c.instruction,
              pairs: shuffledPairs,
              // correct pairs keyed by left text
              correct_map: Object.fromEntries(pairs.map((p: any) => [p.left, p.right])),
            },
          });
          break;
        }

        // ── Speaking ────────────────────────────────────────────────────────
        case 'speaking':
          steps.push({
            type: 'SPEAKING',
            data: {
              title: task.title,
              instruction: c.instruction,
              script: c.example_response || c.prompt,
              prompt: c.prompt,
              key_phrases: c.key_phrases,
              min_words: c.min_words,
            },
          });
          break;

        // ── Error correction ────────────────────────────────────────────────
        case 'error_correction': {
          const correctIdx = c.correct_index ?? 0;
          steps.push({
            type: 'ERROR_CORRECTION',
            data: {
              sentence: c.wrong_sentence ?? c.wrong_text ?? '',
              question: c.instruction ?? 'Choose the correct version:',
              options: c.options,
              correct_index: correctIdx,
              explanation: c.explanation,
            },
          });
          break;
        }

        // ── Lesson summary ───────────────────────────────────────────────────
        case 'lesson_summary':
          // We handle this as the SUMMARY step — skip, we add one at the end
          break;

        // ── Family tree ──────────────────────────────────────────────────────
        case 'family_tree':
          steps.push({
            type: 'FAMILY_TREE',
            data: {
              title: task.title,
              explanation: c.explanation,
              members: c.members,
            },
          });
          break;

        default:
          break;
      }
    }

    // Fix MULTIPLE_CHOICE — ensure correct_index is resolved
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      if (s.type === 'MULTIPLE_CHOICE' && s.data.correct_index === undefined && s.data.correct_answer) {
        s.data.correct_index = s.data.options.indexOf(s.data.correct_answer);
      }
    }

    steps.push({ type: 'SUMMARY', data: { lesson } });
    return steps;
  }

  // ── Legacy API format fallback ──────────────────────────────────────────────
  const d = lesson.content_data ?? {};
  const legacySteps: any[] = [];
  if (d.tasks && Array.isArray(d.tasks)) {
    legacySteps.push(...d.tasks);
  } else {
    if (d.text) legacySteps.push({ type: 'LEARNING_TIP', data: { title: lesson.title, explanation: d.text } });
    if (d.vocabulary?.length > 0) legacySteps.push({ type: 'OLD_VOCAB', data: { words: d.vocabulary } });
    if (d.examples?.length > 0) legacySteps.push({ type: 'OLD_EXAMPLE', data: { examples: d.examples } });
    if (d.questions?.length > 0) {
      d.questions.forEach((q: any) => legacySteps.push({ type: 'MULTIPLE_CHOICE', data: { question: q.question, options: q.options, correct_answer: q.answer } }));
    }
  }
  legacySteps.forEach(s => {
    if ((s.type === 'MULTIPLE_CHOICE' || s.type === 'REVIEW') && s.data.correct_index === undefined && s.data.correct_answer) {
      s.data.correct_index = s.data.options.indexOf(s.data.correct_answer);
    }
  });
  legacySteps.push({ type: 'SUMMARY', data: {} });
  return legacySteps;
}

// ─────────────────────────────────────────────────────────────────────────────
// MATCHING — uses correct_map to validate, right column is pre-shuffled
// ─────────────────────────────────────────────────────────────────────────────
export default function LessonPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();

  const [lesson, setLesson] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [steps, setSteps] = useState<any[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [canContinue, setCanContinue] = useState(false);

  const [stepStartTime, setStepStartTime] = useState(Date.now());
  const [totalQuiz, setTotalQuiz] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [inputText, setInputText] = useState('');
  const [scrambleAnswer, setScrambleAnswer] = useState<string[]>([]);

  // Matching state
  const [matchingSelections, setMatchingSelections] = useState<number[]>([]);
  const [matchingMatched, setMatchingMatched] = useState<number[]>([]);
  const [matchingWrongPairs, setMatchingWrongPairs] = useState<number[]>([]);
  const [matchingMistakes, setMatchingMistakes] = useState(0);

  // Fill-blank (single) state
  const [fillSelected, setFillSelected] = useState<number | null>(null);

  // Fill-blank (multi) state
  const [multiBlankAnswers, setMultiBlankAnswers] = useState<(number | null)[]>([]);
  const [activeBlankIdx, setActiveBlankIdx] = useState(0);

  const [quizChecked, setQuizChecked] = useState(false);
  const [feedback, setFeedback] = useState({ show: false, correct: false, msg: '' });
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Listen-repeat: which phrases have been played
  const [playedPhrases, setPlayedPhrases] = useState<number[]>([]);
  const [useTypingFallback, setUseTypingFallback] = useState(false);

  useEffect(() => {
    // ── Reset step position for every new lesson ──
    setCurrentStep(0);
    setLesson(null);
    setSteps([]);
    setLoading(true);
    setTotalQuiz(0);
    setCorrectCount(0);
    setFeedback({ show: false, correct: false, msg: '' });

    lessonService.getLesson(id)
      .then((data: any) => {
        setLesson(data);
        setSteps(buildSteps(data));
        setLoading(false);
      })
      .catch(() => setLoading(false));

    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.onresult = (event: any) => {
          const result = event.results[0][0].transcript;
          setInputText(result);
          setIsRecording(false);
        };
        recognitionRef.current.onerror = () => setIsRecording(false);
        recognitionRef.current.onend = () => setIsRecording(false);
      }
    }
  }, [id]);

  useEffect(() => {
    setStepStartTime(Date.now());
    setCanContinue(false);
    setSelectedOption(null);
    setFillSelected(null);
    setMultiBlankAnswers([]);
    setActiveBlankIdx(0);
    setInputText('');
    setScrambleAnswer([]);
    setMatchingSelections([]);
    setMatchingWrongPairs([]);
    setMatchingMistakes(0);
    setQuizChecked(false);
    setFeedback({ show: false, correct: false, msg: '' });
    setPlayedPhrases([]);
    setUseTypingFallback(false);

    if (steps[currentStep]?.type !== 'MATCHING') {
      setMatchingMatched([]);
    }

    const step = steps[currentStep];
    if (!step) return;

    // Non-quiz steps: allow immediate continue
    if (['LEARNING_TIP', 'FLASHCARD', 'LEARN_CARD', 'LISTEN_REPEAT', 'FAMILY_TREE', 'SUMMARY', 'OLD_VOCAB', 'OLD_EXAMPLE'].includes(step.type)) {
      setCanContinue(true);
    }
  }, [currentStep, steps]);

  const step = steps[currentStep];
  const progress = steps.length > 1 ? ((currentStep) / (steps.length - 1)) * 100 : 0;

  const logStats = async (isCorrect: boolean) => {
    const rTime = Date.now() - stepStartTime;
    try { await lessonService.logVelocity({ lesson_id: Number(id), response_time_ms: rTime }); } catch (e) {}
  };

  const handleSkipSpeaking = () => {
    if (!step._isRetry) {
      setSteps(prev => {
        const clone = { ...step, _isRetry: true };
        const newArr = [...prev];
        const summaryIdx = newArr.findIndex(s => s.type === 'SUMMARY');
        if (summaryIdx >= 0) newArr.splice(summaryIdx, 0, clone);
        else newArr.push(clone);
        return newArr;
      });
    }
    goNext();
  };

  const checkAnswer = async () => {
    let isCorrect = false;
    let correctMsg = 'Correct!';

    if (step.type === 'MULTIPLE_CHOICE' || step.type === 'REVIEW') {
      isCorrect = selectedOption === step.data.correct_index;
      correctMsg = step.data.explanation || step.data.options?.[step.data.correct_index];
    } else if (step.type === 'FILL_BLANK') {
      const correctOpt = step.data.options?.[fillSelected as number];
      isCorrect = correctOpt?.toLowerCase() === step.data.correct?.toLowerCase();
      correctMsg = step.data.explanation || `Correct answer: ${step.data.correct}`;
    } else if (step.type === 'TRANSLATE' || step.type === 'LISTENING') {
      const ans = step.type === 'TRANSLATE' ? step.data.correct_variants : [step.data.correct_answer];
      isCorrect = ans.some((a: string) => a.toLowerCase().trim() === inputText.toLowerCase().trim());
      correctMsg = ans[0];
    } else if (step.type === 'SCRAMBLE') {
      // Normalize both sides: lowercase + strip leading/trailing punctuation
      const normalize = (s: string) => s.toLowerCase().replace(/[.,!?;:'"]+$/g, '').trim();
      const userStr = normalize(scrambleAnswer.join(' '));
      const targetStr = normalize(step.data.correct_sequence ?? '');
      const altStr = normalize(step.data.alternative_correct ?? '');
      isCorrect = userStr === targetStr || (altStr.length > 0 && userStr === altStr);
      correctMsg = step.data.correct_sequence + (step.data.explanation ? ` (${step.data.explanation})` : '');
    } else if (step.type === 'FILL_BLANK_MULTI') {
      const blanks: any[] = step.data.blanks ?? [];
      isCorrect = blanks.every((blank: any, i: number) => {
        const selIdx = multiBlankAnswers[i];
        if (selIdx == null) return false;
        return (blank.options?.[selIdx] ?? '').toLowerCase() === (blank.correct ?? '').toLowerCase();
      });
      correctMsg = step.data.explanation || 'Check your answers!';
    } else if (step.type === 'SPEAKING') {
      const target = (step.data.script || '').toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '');
      const actual = inputText.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '');
      const keyPhrases: string[] = step.data.key_phrases ?? [];
      const phraseHits = keyPhrases.filter(kp => actual.includes(kp.toLowerCase().replace(/[.,]/g, '')));
      isCorrect = actual.length > 5 && (phraseHits.length >= Math.ceil(keyPhrases.length * 0.4) || actual.includes(target) || target.includes(actual));
      correctMsg = step.data.script;

      if (useTypingFallback && !step._isRetry) {
        setSteps(prev => {
          const clone = { ...step, _isRetry: true };
          const newArr = [...prev];
          const summaryIdx = newArr.findIndex(s => s.type === 'SUMMARY');
          if (summaryIdx >= 0) newArr.splice(summaryIdx, 0, clone);
          else newArr.push(clone);
          return newArr;
        });
      }
    } else if (step.type === 'ERROR_CORRECTION') {
      isCorrect = selectedOption === step.data.correct_index;
      correctMsg = step.data.explanation || '';
    } else if (step.type === 'SENTENCE_BUILDER') {
      const normalize2 = (s: string) => s.toLowerCase().replace(/[.,!?;:'"]+$/g, '').trim();
      isCorrect = normalize2(scrambleAnswer.join(' ')) === normalize2(step.data.correct_answer ?? '');
      correctMsg = step.data.correct_answer;
    }

    setQuizChecked(true);
    setTotalQuiz(prev => prev + 1);

    if (isCorrect) {
      setCorrectCount(prev => prev + 1);
      setFeedback({ show: true, correct: true, msg: 'Excellent!' });
    } else {
      setFeedback({ show: true, correct: false, msg: correctMsg });
    }
    setCanContinue(true);
    logStats(isCorrect);
  };

  const goNext = () => {
    if (currentStep < steps.length - 1) setCurrentStep(prev => prev + 1);
  };

  const completeLesson = async () => {
    const accuracy = totalQuiz > 0 ? (correctCount / totalQuiz) : 1.0;
    try { await lessonService.completeLesson(id, { accuracy }); } catch (e) {}
    router.push('/dashboard');
  };

  // ── MATCHING logic — uses correct_map for validation ──────────────────────
  const handleMatchingClick = (idx: number, isLeft: boolean) => {
    if (quizChecked) return;
    const items = step.data.pairs;
    const globalIdx = isLeft ? idx : idx + items.length;

    if (matchingMatched.includes(globalIdx)) return;

    let newSel = [...matchingSelections];
    if (newSel.includes(globalIdx)) {
      newSel = newSel.filter(i => i !== globalIdx);
    } else {
      if (newSel.length === 2) newSel = [globalIdx];
      else newSel.push(globalIdx);
    }
    setMatchingSelections(newSel);

    if (newSel.length === 2) {
      const [i1, i2] = newSel;
      const isI1Left = i1 < items.length;
      const isI2Left = i2 < items.length;

      if (isI1Left !== isI2Left) {
        const leftIdx = isI1Left ? i1 : i2;
        const rightIdx = isI1Left ? i2 - items.length : i1 - items.length;
        const leftText = items[leftIdx].left;
        const rightText = items[rightIdx].right;
        const correctRight = step.data.correct_map?.[leftText];
        const isMatch = correctRight ? correctRight === rightText : leftIdx === rightIdx;

        if (isMatch) {
          setMatchingMatched(prev => [...prev, i1, i2]);
          setMatchingSelections([]);
          const newMatched = matchingMatched.length + 2;
          if (newMatched === items.length * 2) {
            setCanContinue(true);
            setQuizChecked(true);
            setTotalQuiz(prev => prev + 1);
            if (matchingMistakes === 0) setCorrectCount(prev => prev + 1);
            logStats(matchingMistakes === 0);
            setFeedback({ show: true, correct: matchingMistakes === 0, msg: matchingMistakes === 0 ? 'Great job!' : 'You matched them all, but made some mistakes!' });
          }
        } else {
          setMatchingMistakes(prev => prev + 1);
          setMatchingWrongPairs([i1, i2]);
          setMatchingSelections([]);
          setTimeout(() => setMatchingWrongPairs([]), 800);
        }
      } else {
        setMatchingSelections([globalIdx]);
      }
    }
  };

  if (loading) return <div className="lesson-loading">Loading the fun...</div>;
  if (!lesson || !step) return <div className="lesson-loading">Lesson not found.</div>;

  const isCheckableTask = !['LEARNING_TIP', 'LEARN_CARD', 'LISTEN_REPEAT', 'FLASHCARD', 'FAMILY_TREE', 'MATCHING', 'OLD_VOCAB', 'OLD_EXAMPLE', 'SUMMARY'].includes(step.type);

  const isInputEmpty =
    step.type === 'SCRAMBLE' ? scrambleAnswer.length === 0 :
    step.type === 'FILL_BLANK' ? fillSelected === null :
    step.type === 'FILL_BLANK_MULTI' ? (
      multiBlankAnswers.length < (step.data.blanks?.length ?? 0) ||
      multiBlankAnswers.some((a) => a == null)
    ) :
    (step.type === 'TRANSLATE' || step.type === 'LISTENING') ? inputText.trim() === '' :
    (step.type === 'MULTIPLE_CHOICE' || step.type === 'REVIEW' || step.type === 'ERROR_CORRECTION') ? selectedOption === null :
    step.type === 'SPEAKING' ? inputText.trim() === '' :
    step.type === 'SENTENCE_BUILDER' ? scrambleAnswer.length === 0 : false;

  return (
    <div className="lesson-shell">
      {/* Top Progress Bar */}
      <div className="lesson-topbar">
        <button className="lesson-close-btn" onClick={() => router.push('/dashboard')}>✕</button>
        <div className="lesson-progress-track">
          <motion.div className="lesson-progress-fill" initial={{ width: 0 }} animate={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="lesson-body">
        <AnimatePresence mode="wait">
          <motion.div key={currentStep} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} style={{ width: '100%', maxWidth: '600px', margin: '0 auto' }}>

            {/* ── LEARN CARD ────────────────────────────────────────────── */}
            {step.type === 'LEARN_CARD' && (() => {
              const d = step.data;
              return (
                <div style={{ width: '100%' }}>
                  <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#4f46e5', margin: '0 0 6px 0' }}>
                    {d.title}
                  </h2>
                  {d.explanation && (
                    <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '20px', lineHeight: 1.6 }}>
                      {d.explanation}
                    </p>
                  )}
                  {d.congratulations && (
                    <div style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', borderRadius: '16px', padding: '20px 24px', marginBottom: '20px', color: 'white' }}>
                      <p style={{ fontSize: '15px', lineHeight: 1.7, margin: 0 }}>{d.congratulations}</p>
                    </div>
                  )}

                  {/* Phrase items */}
                  {d.items && d.items.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {d.items.map((item: any, i: number) => (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                          background: 'white', borderRadius: '12px', padding: '13px 16px',
                          border: '1.5px solid #e0e7ff', boxShadow: '0 2px 6px rgba(79,70,229,0.06)',
                          cursor: 'pointer', gap: '12px',
                        }}
                          onClick={() => speak(item.phrase)}
                        >
                          <span style={{ fontWeight: 700, fontSize: '15px', color: '#1e293b' }}>{item.phrase}</span>
                          {item.note && <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500, textAlign: 'right', flexShrink: 0, maxWidth: '45%' }}>{item.note}</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Grammar table */}
                  {d.table && d.table.length > 0 && (
                    <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                        <thead>
                          <tr style={{ background: '#eef2ff' }}>
                            {Object.keys(d.table[0]).map((k) => (
                              <th key={k} style={{ padding: '10px 14px', fontWeight: 800, color: '#4f46e5', textAlign: 'left', textTransform: 'capitalize' }}>{k}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {d.table.map((row: any, i: number) => (
                            <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                              {Object.values(row).map((val: any, j: number) => (
                                <td key={j} style={{ padding: '10px 14px', color: '#1e293b', fontWeight: j === 1 ? 800 : 500 }}>{val}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Grammar Examples — supports both {sentence,structure} and {statement,question,...} formats */}
                  {d.examples && d.examples.length > 0 && (() => {
                    const isSentenceFormat = d.examples[0]?.sentence !== undefined;
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                        {d.examples.map((ex: any, i: number) => (
                          isSentenceFormat ? (
                            <div key={i} style={{
                              background: 'white', borderRadius: '12px', padding: '13px 16px',
                              border: '1.5px solid #e0e7ff', display: 'flex', flexDirection: 'column', gap: '4px',
                              cursor: 'pointer',
                            }} onClick={() => speak(ex.sentence)}>
                              <span style={{ fontWeight: 700, fontSize: '15px', color: '#1e293b' }}>💬 {ex.sentence}</span>
                              {ex.structure && <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500, fontStyle: 'italic' }}>{ex.structure}</span>}
                            </div>
                          ) : (
                            <div key={i} style={{ background: '#f8fafc', borderRadius: '12px', padding: '14px', border: '1px solid #e2e8f0', cursor: 'pointer' }} onClick={() => speak(ex.question || ex.statement || '')}>
                              {ex.statement && <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#64748b' }}>Statement: <strong style={{ color: '#1e293b' }}>{ex.statement}</strong></p>}
                              {ex.question && <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#4f46e5', fontWeight: 'bold' }}>Question: {ex.question}</p>}
                              <div style={{ display: 'flex', gap: '12px', fontSize: '13px' }}>
                                {(ex.yes_reply || ex.yes) && <span style={{ color: '#16a34a', fontWeight: 'bold' }}>Yes: {ex.yes_reply || ex.yes}</span>}
                                {(ex.no_reply || ex.no) && <span style={{ color: '#ef4444', fontWeight: 'bold' }}>No: {ex.no_reply || ex.no}</span>}
                              </div>
                            </div>
                          )
                        ))}
                      </div>
                    );
                  })()}

                  {/* Grammar Rule */}
                  {d.rule && (
                    <div style={{ background: '#fffbeb', borderLeft: '4px solid #fbbf24', padding: '12px 16px', borderRadius: '0 8px 8px 0', marginBottom: '16px' }}>
                      <p style={{ margin: 0, fontSize: '14px', color: '#92400e', fontWeight: 600 }}>💡 {d.rule}</p>
                    </div>
                  )}

                  {/* Short forms */}
                  {d.short_forms && d.short_forms.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
                      {d.short_forms.map((sf: any, i: number) => (
                        <div key={i} style={{
                          background: '#f0fdf4', border: '1.5px solid #bbf7d0',
                          borderRadius: '10px', padding: '8px 14px',
                          fontSize: '13px', fontWeight: 700, color: '#16a34a',
                        }}>
                          {sf.full} → <strong>{sf.short}</strong>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Summary list (review card) */}
                  {d.summary && d.summary.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {d.summary.map((s: any, i: number) => (
                        <div key={i} style={{ display: 'flex', gap: '12px', background: '#f8fafc', borderRadius: '10px', padding: '10px 14px', border: '1px solid #e2e8f0' }}>
                          <span style={{ fontWeight: 800, color: '#4f46e5', fontSize: '13px', minWidth: '64px' }}>{s.lesson}</span>
                          <span style={{ fontSize: '13px', color: '#475569', fontWeight: 500 }}>{s.topic}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* What you learned */}
                  {d.what_you_learned && d.what_you_learned.length > 0 && (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {d.what_you_learned.map((item: string, i: number) => (
                        <li key={i} style={{ display: 'flex', gap: '10px', fontSize: '13px', color: '#374151', fontWeight: 500 }}>
                          <span style={{ color: '#16a34a', fontWeight: 800 }}>✓</span> {item}
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* All grammar/vocab (unit summary) */}
                  {d.all_grammar_covered && (
                    <div style={{ marginTop: '12px' }}>
                      <p style={{ fontWeight: 800, color: '#4f46e5', fontSize: '13px', marginBottom: '8px' }}>Grammar covered:</p>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {d.all_grammar_covered.map((g: string, i: number) => (
                          <li key={i} style={{ fontSize: '13px', color: '#1e293b', fontWeight: 500 }}>📌 {g}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {d.all_vocabulary_covered && (
                    <div style={{ marginTop: '12px' }}>
                      <p style={{ fontWeight: 800, color: '#0ea5e9', fontSize: '13px', marginBottom: '8px' }}>Vocabulary covered:</p>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {d.all_vocabulary_covered.map((v: string, i: number) => (
                          <li key={i} style={{ fontSize: '13px', color: '#1e293b', fontWeight: 500 }}>📝 {v}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p style={{ fontSize: '12px', color: '#c4c4c4', marginTop: '20px', textAlign: 'center' }}>🔊 Tap any phrase to hear it</p>
                </div>
              );
            })()}

            {/* ── FAMILY TREE ─────────────────────────────────────────────── */}
            {step.type === 'FAMILY_TREE' && (() => {
              const d = step.data;
              const members: any[] = d.members ?? [];
              // Build a mini tree: grandparents row → parents row → siblings+you row
              const grandparents = members.filter((m: any) => m.generation === 0);
              const parents      = members.filter((m: any) => m.generation === 1);
              const siblings     = members.filter((m: any) => m.generation === 2);
              const renderRow = (people: any[]) => (
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  {people.map((m: any, i: number) => (
                    <div key={i} style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                      background: m.isYou ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : 'white',
                      border: `2px solid ${m.isYou ? '#4f46e5' : '#e0e7ff'}`,
                      borderRadius: '14px', padding: '10px 14px', minWidth: '80px',
                      boxShadow: '0 2px 8px rgba(79,70,229,0.10)',
                    }}>
                      <span style={{ fontSize: '26px' }}>{m.emoji ?? '🧑'}</span>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: m.isYou ? 'white' : '#1e293b' }}>{m.name}</span>
                      <span style={{ fontSize: '10px', fontWeight: 600, color: m.isYou ? 'rgba(255,255,255,0.8)' : '#4f46e5', background: m.isYou ? 'rgba(255,255,255,0.15)' : '#eef2ff', borderRadius: '6px', padding: '2px 6px' }}>{m.role}</span>
                    </div>
                  ))}
                </div>
              );
              const connectorLine = () => (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
                  <div style={{ width: '2px', height: '20px', background: '#c7d2fe' }} />
                </div>
              );
              return (
                <div style={{ width: '100%' }}>
                  <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#4f46e5', margin: '0 0 6px 0' }}>{d.title ?? 'Family Tree'}</h2>
                  {d.explanation && <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '20px', lineHeight: 1.6 }}>{d.explanation}</p>}
                  <div style={{ background: 'linear-gradient(135deg, #eef2ff, #f0fdf4)', borderRadius: '20px', padding: '24px 16px', border: '1.5px solid #e0e7ff' }}>
                    {grandparents.length > 0 && <>{renderRow(grandparents)}{connectorLine()}</>}
                    {parents.length > 0 && <>{renderRow(parents)}{connectorLine()}</>}
                    {siblings.length > 0 && renderRow(siblings)}
                    {grandparents.length === 0 && parents.length === 0 && members.length > 0 && renderRow(members)}
                  </div>
                  <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {members.map((m: any, i: number) => (
                      <div key={i} style={{
                        display: 'flex', gap: '10px', alignItems: 'center',
                        background: 'white', borderRadius: '10px', padding: '10px 14px',
                        border: '1px solid #e0e7ff',
                      }}>
                        <span style={{ fontSize: '20px' }}>{m.emoji ?? '🧑'}</span>
                        <span style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b', minWidth: '60px' }}>{m.name}</span>
                        <span style={{ fontSize: '12px', color: '#4f46e5', fontWeight: 600, background: '#eef2ff', borderRadius: '6px', padding: '2px 8px' }}>{m.role}</span>
                        {m.relation && <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500, marginLeft: 'auto' }}>"Your {m.relation}"</span>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* ── LISTEN & REPEAT ────────────────────────────────────────── */}
            {step.type === 'LISTEN_REPEAT' && (
              <div style={{ width: '100%' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#1cb0f6', margin: '0 0 6px 0' }}>{step.data.title}</h2>
                <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '20px', lineHeight: 1.6 }}>{step.data.instruction}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {(step.data.phrases ?? []).map((ph: any, i: number) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: '14px',
                      background: playedPhrases.includes(i) ? '#f0fdf4' : 'white',
                      border: `1.5px solid ${playedPhrases.includes(i) ? '#86efac' : '#e0e7ff'}`,
                      borderRadius: '14px', padding: '14px 18px',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                      cursor: 'pointer', transition: 'all 0.2s',
                    }}
                      onClick={() => {
                        speak(ph.text);
                        setPlayedPhrases(prev => prev.includes(i) ? prev : [...prev, i]);
                      }}
                    >
                      <span style={{ fontSize: '20px' }}>{playedPhrases.includes(i) ? '✅' : '🔊'}</span>
                      <span style={{ fontWeight: 700, fontSize: '15px', color: '#1e293b', flex: 1 }}>{ph.text}</span>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: '12px', color: '#c4c4c4', marginTop: '16px', textAlign: 'center' }}>Tap each phrase to listen. Repeat it aloud!</p>
              </div>
            )}

            {/* ── LEGACY LEARNING_TIP ────────────────────────────────────── */}
            {step.type === 'LEARNING_TIP' && (() => {
              const exampleStr: string = step.data.example || '';
              const dialogueLines = exampleStr.includes(' | ')
                ? exampleStr.split(' | ').map((part: string) => {
                    const colonIdx = part.indexOf(': ');
                    return colonIdx > -1 ? { speaker: part.slice(0, colonIdx).trim(), line: part.slice(colonIdx + 2).trim() } : { speaker: '', line: part.trim() };
                  })
                : null;
              return (
                <div style={{ width: '100%', maxWidth: '560px', margin: '0 auto' }}>
                  <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#1cb0f6', margin: '0 0 8px 0' }}>{step.data.title || 'Tip'}</h2>
                  <p style={{ fontSize: '15px', color: '#64748b', marginBottom: '20px', lineHeight: 1.6 }}>{step.data.explanation}</p>
                  {dialogueLines ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {dialogueLines.map((dl: any, idx: number) => {
                        const isEven = idx % 2 === 0;
                        return (
                          <div key={idx} style={{ display: 'flex', flexDirection: isEven ? 'row' : 'row-reverse', alignItems: 'flex-end', gap: '10px' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0, background: isEven ? '#4f46e5' : '#1cb0f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 800, color: 'white' }}>{dl.speaker ? dl.speaker[0].toUpperCase() : '?'}</div>
                            <div style={{ maxWidth: '75%', background: isEven ? '#eef2ff' : '#f0fdf4', border: `1.5px solid ${isEven ? '#c7d2fe' : '#bbf7d0'}`, borderRadius: isEven ? '18px 18px 18px 4px' : '18px 18px 4px 18px', padding: '10px 16px' }}>
                              {dl.speaker && <p style={{ fontSize: '11px', fontWeight: 800, color: isEven ? '#4f46e5' : '#16a34a', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{dl.speaker}</p>}
                              <p style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b', margin: 0, lineHeight: 1.5 }}>{dl.line}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : exampleStr ? (
                    <div style={{ background: '#eef2ff', border: '2px solid #c7d2fe', borderRadius: '14px', padding: '16px 20px', fontSize: '16px', fontWeight: 700, color: '#4f46e5', lineHeight: 1.6 }}>{exampleStr}</div>
                  ) : null}
                </div>
              );
            })()}

            {/* ── FLASHCARD (legacy) ─────────────────────────────────────── */}
            {step.type === 'FLASHCARD' && (
              <>
                <h2 className="step-instruction">Tap to reveal the meaning</h2>
                <div className="vocab-grid">
                  <div className={`vocab-item ${selectedOption === 1 ? 'revealed' : ''}`} onClick={() => { setSelectedOption(1); speak(step.data.primary_text); }}>
                    <div className="vocab-word" style={{ fontSize: '32px' }}>{step.data.primary_text}</div>
                    <div className="vocab-divider" />
                    <div className="vocab-info">
                      {selectedOption === 1 ? <p className="vocab-definition" style={{ fontSize: '28px', color: '#1cb0f6' }}>{step.data.secondary_text}</p> : <p className="vocab-definition" style={{ color: '#c4c4c4', fontSize: '24px' }}>?</p>}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── MULTIPLE CHOICE ────────────────────────────────────────── */}
            {(step.type === 'MULTIPLE_CHOICE' || step.type === 'REVIEW') && (
              <>
                {/* Scenario / multi-line question support */}
                {step.data.question?.includes('\n\n') ? (
                  <>
                    <div style={{ background: '#fef9ec', border: '2px solid #fde68a', borderRadius: '14px', padding: '14px 18px', marginBottom: '16px', fontSize: '13px', color: '#92400e', fontWeight: 600, lineHeight: 1.6 }}>
                      {step.data.question.split('\n\n')[0].replace('📍 ', '')}
                    </div>
                    <h2 className="quiz-question">{step.data.question.split('\n\n')[1]}</h2>
                  </>
                ) : (
                  <h2 className="quiz-question">{step.data.question}</h2>
                )}
                <div className="quiz-options">
                  {step.data.options.map((opt: string, i: number) => {
                    let cls = 'quiz-option';
                    if (quizChecked) {
                      if (i === step.data.correct_index) cls += ' correct';
                      else if (i === selectedOption) cls += ' wrong';
                    } else if (i === selectedOption) cls += ' selected';
                    return (
                      <button key={i} className={cls} onClick={() => !quizChecked && setSelectedOption(i)}>
                        <span className="quiz-option-num">{i + 1}</span> {opt}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* ── FILL IN THE BLANK ──────────────────────────────────────── */}
            {step.type === 'FILL_BLANK' && (
              <>
                <div style={{ background: '#eef2ff', border: '2px solid #c7d2fe', borderRadius: '16px', padding: '18px 22px', marginBottom: '24px', textAlign: 'center' }}>
                  <p style={{ fontSize: '13px', fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Fill in the blank</p>
                  <p style={{ fontSize: '19px', fontWeight: 700, color: '#1e293b', lineHeight: 1.7, margin: 0 }}>
                    {step.data.sentence.split(/(_+|\[___\])/).map((part: string, i: number) => {
                      if (part === '[___]') {
                        return (
                          <span key={i} style={{
                            display: 'inline-block', minWidth: '70px', borderBottom: '3px solid #6366f1',
                            color: quizChecked
                              ? (step.data.options?.[fillSelected as number]?.toLowerCase() === step.data.correct?.toLowerCase() ? '#16a34a' : '#dc2626')
                              : (fillSelected !== null ? '#4f46e5' : 'transparent'),
                            fontWeight: 900, padding: '0 8px', margin: '0 4px',
                          }}>
                            {fillSelected !== null ? step.data.options?.[fillSelected] : '___'}
                          </span>
                        );
                      } else if (/^_+$/.test(part)) {
                        return (
                          <span key={i} style={{
                            display: 'inline-block', minWidth: '50px', borderBottom: '2px solid #cbd5e1',
                            margin: '0 4px', color: 'transparent',
                          }}>
                            ___
                          </span>
                        );
                      } else {
                        return <span key={i}>{part}</span>;
                      }
                    })}
                  </p>
                </div>
                <div className="quiz-options">
                  {(step.data.options ?? []).map((opt: string, i: number) => {
                    let cls = 'quiz-option';
                    if (quizChecked) {
                      if (opt.toLowerCase() === step.data.correct?.toLowerCase()) cls += ' correct';
                      else if (i === fillSelected) cls += ' wrong';
                    } else if (i === fillSelected) cls += ' selected';
                    return (
                      <button key={i} className={cls} onClick={() => !quizChecked && setFillSelected(i)}>
                        <span className="quiz-option-num">{i + 1}</span> {opt}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* ── FILL IN THE BLANK (MULTI) ──────────────────────────────── */}
            {step.type === 'FILL_BLANK_MULTI' && (() => {
              const blanks: any[] = step.data.blanks ?? [];
              let blankCount = 0;
              const parts: string[] = step.data.sentence.split(/(_+)/);

              return (
                <div style={{ width: '100%' }}>
                  {/* Sentence with all blanks visible */}
                  <div style={{ background: '#eef2ff', border: '2px solid #c7d2fe', borderRadius: '16px', padding: '18px 22px', marginBottom: '24px', textAlign: 'center' }}>
                    <p style={{ fontSize: '13px', fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
                      Fill in the blanks
                    </p>
                    <p style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', lineHeight: 1.8, margin: 0 }}>
                      {parts.map((part, i) => {
                        if (/^_+$/.test(part)) {
                          const bIdx = blankCount++;
                          const blank = blanks[bIdx];
                          const selIdx = multiBlankAnswers[bIdx];
                          const filledWord = selIdx != null ? blank?.options?.[selIdx] : null;
                          const isActive = !quizChecked && bIdx === activeBlankIdx;
                          const isCorrectBlank = quizChecked && (blank?.options?.[selIdx as number] ?? '').toLowerCase() === (blank?.correct ?? '').toLowerCase();
                          return (
                            <span
                              key={i}
                              onClick={() => !quizChecked && setActiveBlankIdx(bIdx)}
                              style={{
                                display: 'inline-block',
                                minWidth: '72px',
                                borderBottom: `3px solid ${quizChecked ? (isCorrectBlank ? '#16a34a' : '#dc2626') : isActive ? '#6366f1' : filledWord ? '#a5b4fc' : '#cbd5e1'}`,
                                color: quizChecked ? (isCorrectBlank ? '#16a34a' : '#dc2626') : filledWord ? '#4f46e5' : '#94a3b8',
                                fontWeight: 900,
                                padding: '0 8px',
                                margin: '0 4px',
                                background: isActive ? 'rgba(99,102,241,0.1)' : 'transparent',
                                borderRadius: '6px',
                                cursor: quizChecked ? 'default' : 'pointer',
                                transition: 'all 0.2s',
                              }}
                            >
                              {filledWord ?? (isActive ? '___' : '_ _')}
                            </span>
                          );
                        }
                        return <span key={i}>{part}</span>;
                      })}
                    </p>
                  </div>

                  {/* Options for the CURRENT active blank */}
                  {!quizChecked && (
                    <div>
                      <p style={{ textAlign: 'center', fontSize: '13px', color: '#6366f1', fontWeight: 700, marginBottom: '14px' }}>
                        ✏️ Blank {activeBlankIdx + 1} of {blanks.length} — choose the correct word
                      </p>
                      <div className="quiz-options">
                        {(blanks[activeBlankIdx]?.options ?? []).map((opt: string, i: number) => {
                          const isChosen = multiBlankAnswers[activeBlankIdx] === i;
                          return (
                            <button
                              key={i}
                              className={`quiz-option${isChosen ? ' selected' : ''}`}
                              onClick={() => {
                                const updated = [...multiBlankAnswers];
                                updated[activeBlankIdx] = i;
                                setMultiBlankAnswers(updated);
                                // Auto-advance to next unanswered blank
                                const nextUnanswered = updated.findIndex((a, idx) => idx > activeBlankIdx && a == null);
                                if (nextUnanswered !== -1) {
                                  setActiveBlankIdx(nextUnanswered);
                                } else if (activeBlankIdx < blanks.length - 1) {
                                  setActiveBlankIdx(activeBlankIdx + 1);
                                }
                              }}
                            >
                              <span className="quiz-option-num">{i + 1}</span> {opt}
                            </button>
                          );
                        })}
                      </div>

                      {/* Blank navigation pills */}
                      {blanks.length > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
                          {blanks.map((_: any, bIdx: number) => (
                            <button
                              key={bIdx}
                              onClick={() => setActiveBlankIdx(bIdx)}
                              style={{
                                padding: '5px 14px',
                                borderRadius: '99px',
                                border: `2px solid ${bIdx === activeBlankIdx ? '#6366f1' : multiBlankAnswers[bIdx] != null ? '#a5b4fc' : '#e2e8f0'}`,
                                background: bIdx === activeBlankIdx ? '#eef2ff' : 'white',
                                fontSize: '12px', fontWeight: 700,
                                color: bIdx === activeBlankIdx ? '#6366f1' : multiBlankAnswers[bIdx] != null ? '#4f46e5' : '#94a3b8',
                                cursor: 'pointer',
                              }}
                            >
                              Blank {bIdx + 1} {multiBlankAnswers[bIdx] != null ? '✓' : ''}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* After check: show result per blank */}
                  {quizChecked && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {blanks.map((blank: any, bIdx: number) => {
                        const ansIdx = multiBlankAnswers[bIdx];
                        const ansWord = ansIdx != null ? blank.options?.[ansIdx] : '—';
                        const ok = (ansWord ?? '').toLowerCase() === (blank.correct ?? '').toLowerCase();
                        return (
                          <div key={bIdx} style={{
                            display: 'flex', alignItems: 'center', gap: '12px',
                            padding: '12px 16px', borderRadius: '12px',
                            background: ok ? '#f0fdf4' : '#fef2f2',
                            border: `1.5px solid ${ok ? '#86efac' : '#fca5a5'}`,
                          }}>
                            <span style={{ fontSize: '18px' }}>{ok ? '✅' : '❌'}</span>
                            <div>
                              <span style={{ fontSize: '14px', fontWeight: 800, color: ok ? '#16a34a' : '#dc2626' }}>
                                {ansWord}
                              </span>
                              {!ok && (
                                <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500, marginLeft: '8px' }}>
                                  → Correct: <strong style={{ color: '#16a34a' }}>{blank.correct}</strong>
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── SCRAMBLE / SORT WORDS ──────────────────────────────────── */}
            {step.type === 'SCRAMBLE' && (
              <>
                {step.data.instruction && (
                  <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px', textAlign: 'center', fontWeight: 600 }}>{step.data.instruction}</p>
                )}
                <h2 className="quiz-question">Arrange the words into the correct order</h2>
                <div style={{ minHeight: '60px', borderBottom: '2px solid #e5e5e5', marginBottom: '32px', display: 'flex', gap: '8px', flexWrap: 'wrap', paddingBottom: '12px' }}>
                  {scrambleAnswer.map((w, i) => {
                    let cls = 'quiz-option';
                    if (quizChecked) cls += feedback.correct ? ' correct' : ' wrong';
                    return (
                      <button key={`ans-${i}`} className={cls} style={{ padding: '12px 20px', width: 'auto' }} onClick={() => {
                        if (!quizChecked) setScrambleAnswer(prev => prev.filter((_, idx) => idx !== i));
                      }}>{w}</button>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  {step.data.shuffled_words.map((w: string, i: number) => {
                    const isUsed = scrambleAnswer.includes(w);
                    return (
                      <button key={`bank-${i}`} className="quiz-option" style={{ padding: '12px 20px', width: 'auto', background: isUsed ? '#e5e5e5' : '', borderColor: isUsed ? '#e5e5e5' : '', color: isUsed ? 'transparent' : '', pointerEvents: isUsed ? 'none' : 'auto' }} onClick={() => {
                        if (!quizChecked && !isUsed) setScrambleAnswer(prev => [...prev, w]);
                      }}>{w}</button>
                    );
                  })}
                </div>
              </>
            )}

            {/* ── TRANSLATE (legacy) ─────────────────────────────────────── */}
            {step.type === 'TRANSLATE' && (
              <>
                <div className="mascot-bubble-container">
                  <svg className="mascot-svg" viewBox="0 0 100 100" fill="none">
                    <path d="M50 90C72.0914 90 90 67.6142 90 40C90 12.3858 72.0914 10 50 10C27.9086 10 10 12.3858 10 40C10 67.6142 27.9086 90 50 90Z" fill="#4f46e5" />
                    <circle cx="35" cy="40" r="5" fill="white" />
                    <circle cx="65" cy="40" r="5" fill="white" />
                    <path d="M40 60Q50 70 60 60" stroke="white" strokeWidth="4" strokeLinecap="round" />
                  </svg>
                  <div className="mascot-bubble"><p className="theory-text" style={{ fontSize: '24px' }}>{step.data.source_text}</p></div>
                </div>
                <input type="text" autoFocus className={`lesson-input ${quizChecked ? (feedback.correct ? 'correct' : 'wrong') : ''}`} placeholder={`Translate to ${step.data.target_language}...`} value={inputText} onChange={e => setInputText(e.target.value)} disabled={quizChecked} />
              </>
            )}

            {/* ── LISTENING (legacy) ─────────────────────────────────────── */}
            {step.type === 'LISTENING' && (
              <>
                <h2 className="quiz-question">Tap to listen and type what you hear</h2>
                <button className="mic-button" onClick={() => speak(step.data.correct_answer)}>🔊</button>
                <div style={{ height: '32px' }} />
                <input type="text" autoFocus className={`lesson-input ${quizChecked ? (feedback.correct ? 'correct' : 'wrong') : ''}`} placeholder="Type here..." value={inputText} onChange={e => setInputText(e.target.value)} disabled={quizChecked} />
              </>
            )}

            {/* ── SPEAKING ──────────────────────────────────────────────── */}
            {step.type === 'SPEAKING' && (
              <>
                {step.data.title && <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#4f46e5', marginBottom: '6px' }}>{step.data.title}</h2>}
                {step.data.instruction && <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px', lineHeight: 1.6 }}>{step.data.instruction}</p>}
                {step.data.prompt && (
                  <div style={{ background: '#eef2ff', border: '2px solid #c7d2fe', borderRadius: '14px', padding: '14px 18px', marginBottom: '16px', cursor: 'pointer' }}
                    onClick={() => speak(step.data.script)}
                  >
                    <p style={{ fontSize: '15px', fontWeight: 700, color: '#4f46e5', margin: 0 }}>📌 {step.data.prompt}</p>
                  </div>
                )}
                {step.data.key_phrases && step.data.key_phrases.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '18px' }}>
                    {step.data.key_phrases.map((kp: string, i: number) => (
                      <span key={i} style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '20px', padding: '4px 12px', fontSize: '12px', fontWeight: 700, color: '#16a34a' }}>
                        {kp}
                      </span>
                    ))}
                  </div>
                )}
                {useTypingFallback ? (
                  <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <input type="text" autoFocus className={`lesson-input ${quizChecked ? (feedback.correct ? 'correct' : 'wrong') : ''}`} placeholder="Type what you meant to say..." value={inputText} onChange={e => setInputText(e.target.value)} disabled={quizChecked} />
                    {!quizChecked && (
                      <button onClick={() => setUseTypingFallback(false)} style={{ background: 'none', border: 'none', color: '#64748b', textDecoration: 'underline', marginTop: '12px', cursor: 'pointer', fontWeight: 600 }}>Use microphone instead</button>
                    )}
                  </div>
                ) : (
                  <>
                    <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                      {isRecording
                        ? <motion.p animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity }} style={{ color: '#ff4b4b', fontWeight: 800 }}>Listening...</motion.p>
                        : <p style={{ color: '#afafaf', fontWeight: 700 }}>Tap the mic to start recording</p>}
                    </div>
                    <button className={`mic-button ${isRecording ? 'active' : ''}`}
                      style={{ background: isRecording ? '#ff4b4b' : '#4f46e5', borderBottomColor: isRecording ? '#ea2b2b' : '#3730a3' }}
                      onClick={() => {
                        if (isRecording) { recognitionRef.current?.stop(); }
                        else { setInputText(''); recognitionRef.current?.start(); setIsRecording(true); }
                      }}>
                      {isRecording ? '⏹️' : '🎙️'}
                    </button>
                    {inputText && !quizChecked && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginTop: '24px', textAlign: 'center' }}>
                        <p style={{ fontSize: '16px', color: '#4f46e5', fontWeight: 800 }}>I heard: "{inputText}"</p>
                      </motion.div>
                    )}

                    {!quizChecked && (
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '30px' }}>
                        <button onClick={() => setUseTypingFallback(true)} style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: 600, cursor: 'pointer' }}>⌨️ Type instead</button>
                        <button onClick={handleSkipSpeaking} style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: 600, cursor: 'pointer' }}>⏭️ Skip for now</button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {/* ── ERROR CORRECTION ─────────────────────────────────────── */}
            {step.type === 'ERROR_CORRECTION' && (
              <>
                <div style={{ background: '#fef9ec', border: '2px solid #ffd700', borderRadius: '16px', padding: '20px 24px', marginBottom: '28px', textAlign: 'center' }}>
                  <p style={{ fontSize: '11px', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Find the error</p>
                  <p style={{ fontSize: '17px', fontWeight: 700, color: '#1e293b', lineHeight: 1.6 }}>{step.data.sentence}</p>
                </div>
                <h2 className="quiz-question" style={{ marginBottom: '20px' }}>{step.data.question}</h2>
                <div className="quiz-options">
                  {step.data.options.map((opt: string, i: number) => {
                    let cls = 'quiz-option';
                    if (quizChecked) {
                      if (i === step.data.correct_index) cls += ' correct';
                      else if (i === selectedOption) cls += ' wrong';
                    } else if (i === selectedOption) cls += ' selected';
                    return (
                      <button key={i} className={cls} onClick={() => !quizChecked && setSelectedOption(i)}>
                        <span className="quiz-option-num">{i + 1}</span> {opt}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* ── SENTENCE BUILDER (legacy) ──────────────────────────────── */}
            {step.type === 'SENTENCE_BUILDER' && (
              <>
                <div style={{ background: '#eef2ff', border: '2px solid #c7d2fe', borderRadius: '16px', padding: '16px 24px', marginBottom: '28px', textAlign: 'center' }}>
                  <p style={{ fontSize: '16px', fontWeight: 700, color: '#4f46e5' }}>{step.data.prompt}</p>
                </div>
                <h2 className="quiz-question">Build the sentence</h2>
                <div style={{ minHeight: '60px', borderBottom: '2px solid #e5e5e5', marginBottom: '24px', display: 'flex', gap: '8px', flexWrap: 'wrap', paddingBottom: '12px' }}>
                  {scrambleAnswer.map((w, i) => {
                    let cls = 'quiz-option';
                    if (quizChecked) cls += feedback.correct ? ' correct' : ' wrong';
                    return (
                      <button key={`sb-ans-${i}`} className={cls} style={{ padding: '12px 20px', width: 'auto' }} onClick={() => { if (!quizChecked) setScrambleAnswer(prev => prev.filter((_, idx) => idx !== i)); }}>{w}</button>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  {step.data.options.map((w: string, i: number) => {
                    const isUsed = scrambleAnswer.includes(w);
                    return (
                      <button key={`sb-bank-${i}`} className="quiz-option" style={{ padding: '12px 20px', width: 'auto', background: isUsed ? '#e5e5e5' : '', borderColor: isUsed ? '#e5e5e5' : '', color: isUsed ? 'transparent' : '', pointerEvents: isUsed ? 'none' : 'auto' }} onClick={() => { if (!quizChecked && !isUsed) setScrambleAnswer(prev => [...prev, w]); }}>{w}</button>
                    );
                  })}
                </div>
              </>
            )}

            {/* ── MATCHING ─────────────────────────────────────────────── */}
            {step.type === 'MATCHING' && (
              <>
                {step.data.instruction && <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '12px', textAlign: 'center', fontWeight: 600 }}>{step.data.instruction}</p>}
                <h2 className="quiz-question">Match the pairs</h2>
                <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '50%' }}>
                    {step.data.pairs.map((p: any, i: number) => {
                      const isSel = matchingSelections.includes(i);
                      const isWrong = matchingWrongPairs.includes(i);
                      const selCls = isWrong ? 'wrong' : (isSel ? 'selected' : '');
                      const matCls = matchingMatched.includes(i) ? 'correct' : '';
                      return (
                        <button key={`L-${i}`} className={`quiz-option ${selCls} ${matCls}`} style={{ justifyContent: 'center' }} onClick={() => handleMatchingClick(i, true)} disabled={matCls !== '' || matchingWrongPairs.length > 0}>{p.left}</button>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '50%' }}>
                    {step.data.pairs.map((p: any, i: number) => {
                      const globalIdx = i + step.data.pairs.length;
                      const isSel = matchingSelections.includes(globalIdx);
                      const isWrong = matchingWrongPairs.includes(globalIdx);
                      const selCls = isWrong ? 'wrong' : (isSel ? 'selected' : '');
                      const matCls = matchingMatched.includes(globalIdx) ? 'correct' : '';
                      return (
                        <button key={`R-${i}`} className={`quiz-option ${selCls} ${matCls}`} style={{ justifyContent: 'center' }} onClick={() => handleMatchingClick(i, false)} disabled={matCls !== '' || matchingWrongPairs.length > 0}>{p.right}</button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* ── SUMMARY ─────────────────────────────────────────────── */}
            {step.type === 'SUMMARY' && (
              <div className="lesson-done-wrap">
                <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', damping: 10, stiffness: 100 }} className="lesson-done-emoji">
                  🥳
                </motion.div>
                <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="lesson-done-title">
                  Lesson Complete!
                </motion.h2>
                {lesson?.title && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} style={{ fontSize: '15px', color: '#64748b', textAlign: 'center', fontWeight: 600, marginBottom: '8px' }}>
                    {lesson.title}
                  </motion.p>
                )}
                <div className="lesson-done-stats">
                  <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }} className="lesson-done-stat">
                    <div className="lesson-done-val">{totalQuiz}</div>
                    <div className="lesson-done-label">Questions</div>
                  </motion.div>
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }} className="lesson-done-stat">
                    <div className="lesson-done-val">{Math.round((correctCount / Math.max(1, totalQuiz)) * 100)}%</div>
                    <div className="lesson-done-label">Accuracy</div>
                  </motion.div>
                </div>
                {lesson?.xp_reward && (
                  <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6 }}
                    style={{ background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', borderRadius: '99px', padding: '10px 28px', fontWeight: 900, fontSize: '18px', color: 'white', marginTop: '16px', boxShadow: '0 4px 16px rgba(245,158,11,0.4)' }}>
                    +{lesson.xp_reward} XP 🏆
                  </motion.div>
                )}
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Bottom Bar — always visible ── */}
      <AnimatePresence mode="wait">
        {feedback.show ? (
          <motion.div
            key="feedback"
            className={`feedback-banner-area ${feedback.correct ? 'correct' : 'wrong'}`}
            initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
          >
            <div className="feedback-content">
              <div className={`feedback-icon ${feedback.correct ? 'correct' : 'wrong'}`}>
                {feedback.correct ? '✓' : '✗'}
              </div>
              <div className={`feedback-text ${feedback.correct ? 'correct' : 'wrong'}`}>
                <h2>{feedback.correct ? 'Awesome!' : 'Correct answer:'}</h2>
                {!feedback.correct && <p>{feedback.msg}</p>}
              </div>
              <button autoFocus className={`lesson-continue-btn ${feedback.correct ? 'primary' : 'wrong-btn'}`} style={{ marginLeft: 'auto', marginBottom: 0 }} onClick={goNext}>
                CONTINUE
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="bottombar" className="lesson-bottom-bar" initial={{ y: 0 }} animate={{ y: 0 }}>
            <div className="lesson-bottom-bar-inner">
              {step.type === 'SUMMARY' ? (
                <button className="lesson-continue-btn success" onClick={completeLesson}>FINISH LESSON</button>
              ) : isCheckableTask && !quizChecked ? (
                <button className="lesson-continue-btn primary" disabled={isInputEmpty} onClick={checkAnswer}>CHECK</button>
              ) : (
                <button className="lesson-continue-btn primary" disabled={!canContinue} onClick={goNext}>CONTINUE</button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
