'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '@/components/DashboardLayout';
import { lessonService } from '@/services/lessons';
import '@/styles/review.css';

type Card = {
  id: number;
  front: string;
  back: string;
  is_weak: boolean;
  interval: number;
  repetitions: number;
  easiness: number;
  correct_count: number;
  incorrect_count: number;
};

type SessionSummary = {
  total: number;
  correct: number;
  avgTime: number;
  avgHesitation: number;
};

export default function ReviewPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'due' | 'weak'>('due');
  const [cards, setCards] = useState<Card[]>([]);
  const [weakCards, setWeakCards] = useState<Card[]>([]);
  const [sessionCards, setSessionCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionActive, setSessionActive] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [results, setResults] = useState<{ id: number; correct: boolean; time: number; hes: number }[]>([]);
  
  // Velocity tracking
  const cardStartRef = useRef<number>(0);
  const flipTimeRef = useRef<number>(0);
  const hesitationRef = useRef<number>(0);

  // Heatmap state (real data from backend)
  const currentYearInt = new Date().getFullYear();
  const currentMonthInt = new Date().getMonth(); // 0-indexed
  const [heatmap, setHeatmap] = useState<{ date: string; day: string; count: number; level: number }[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(currentYearInt);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonthInt);
  const [availableYears, setAvailableYears] = useState<number[]>([currentYearInt]);
  const [heatmapLoading, setHeatmapLoading] = useState(true);
  const [totalYearlyReviews, setTotalYearlyReviews] = useState(0);
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  useEffect(() => { fetchCards(); }, []);
  useEffect(() => { fetchHeatmap(selectedYear); }, [selectedYear]);

  const fetchCards = async () => {
    setLoading(true);
    try {
      const [due, weak] = await Promise.all([
        lessonService.getDueCards(30),
        lessonService.getWeakCards()
      ]);
      setCards(due || []);
      setWeakCards(weak || []);
    } catch (e) {
      setCards(MOCK_CARDS);
      setWeakCards(MOCK_WEAK_CARDS);
    }
    setLoading(false);
  };

  const fetchHeatmap = async (year: number) => {
    setHeatmapLoading(true);
    try {
      const prog = await lessonService.getProgress(year);
      setHeatmap(prog.heatmap || []);
      const total = (prog.heatmap || []).reduce((acc: number, day: any) => acc + day.count, 0);
      setTotalYearlyReviews(total);
      if (prog.first_year) {
        const first = Number(prog.first_year);
        const current = new Date().getFullYear();
        const years: number[] = [];
        for (let y = current; y >= first; y--) years.push(y);
        setAvailableYears(years.length > 0 ? years : [currentYearInt]);
      }
    } catch {
      setHeatmap([]);
    }
    setHeatmapLoading(false);
  };

  const startSession = (type: 'due' | 'weak') => {
    const source = type === 'due' ? cards : weakCards;
    if (!source.length) return;
    setSessionCards(source.slice(0, 20));
    setCurrentIndex(0);
    setFlipped(false);
    setAnswered(false);
    setSessionDone(false);
    setResults([]);
    setSessionActive(true);
    cardStartRef.current = Date.now();
    hesitationRef.current = 0;
  };

  const handleFlip = () => {
    if (!flipped) {
      flipTimeRef.current = Date.now();
      setFlipped(true);
    }
  };

  const handleAnswer = useCallback(async (correct: boolean) => {
    if (answered) return;
    setAnswered(true);

    const now = Date.now();
    const responseTimeMs = flipTimeRef.current - cardStartRef.current;
    const answerDurationMs = now - flipTimeRef.current;
    const hesCount = hesitationRef.current;
    const card = sessionCards[currentIndex];

    // Log result
    setResults(prev => [...prev, {
      id: card.id,
      correct,
      time: responseTimeMs,
      hes: hesCount
    }]);

    // Submit to backend (don't await to keep UI snappy)
    try {
      await lessonService.submitSM2({
        card_id: card.id,
        is_correct: correct,
        response_time_ms: Math.max(0, responseTimeMs),
        answer_duration_ms: Math.max(0, answerDurationMs),
        hesitation_count: hesCount,
      });
    } catch (e) { /* offline mode ok */ }

    // Move to next card after a brief delay
    setTimeout(() => {
      if (currentIndex + 1 >= sessionCards.length) {
        endSession();
      } else {
        setCurrentIndex(idx => idx + 1);
        setFlipped(false);
        setAnswered(false);
        cardStartRef.current = Date.now();
        hesitationRef.current = 0;
      }
    }, 600);
  }, [answered, currentIndex, sessionCards]);

  const endSession = () => {
    const allResults = results;
    const correct = allResults.filter(r => r.correct).length + (allResults.length > 0 ? 0 : 0);
    const total = sessionCards.length;
    const avgTime = allResults.length ? allResults.reduce((s, r) => s + r.time, 0) / allResults.length : 0;
    const avgHes = allResults.length ? allResults.reduce((s, r) => s + r.hes, 0) / allResults.length : 0;
    setSummary({ total, correct: allResults.filter(r => r.correct).length, avgTime, avgHesitation: avgHes });
    setSessionDone(true);
    setSessionActive(false);
    fetchCards(); // Refresh counts
  };

  // ── Build Full Year GitHub-style week grid ────────────────────────────────
  // Group days into columns of 7 (Sunday to Saturday or Monday to Sunday).
  // Assuming days are sequential from start of the year.
  const buildFullYearGrid = () => {
    if (!heatmap.length) return [];
    
    // Find the weekday of the first day to pad the first column
    const firstDayStr = heatmap[0].date;
    const firstDate = new Date(firstDayStr);
    // JS getDay() is 0=Sun, 1=Mon. Let's make our weeks start on Monday (0=Mon, 6=Sun)
    const dayOfWeek = firstDate.getDay(); 
    const padCount = dayOfWeek === 0 ? 6 : dayOfWeek - 1; 
    
    // Pad the start with empty slots
    const paddedDays = [
      ...Array.from({ length: padCount }, () => ({ date: '', day: '', count: 0, level: 0 })),
      ...heatmap
    ];
    
    const weeks: typeof heatmap[] = [];
    for (let i = 0; i < paddedDays.length; i += 7) {
      weeks.push(paddedDays.slice(i, i + 7));
    }
    return weeks;
  };
  
  const weekGrid = buildFullYearGrid();
  // Using Monday start for days
  const DAY_LABELS = ['Mon', 'Wed', 'Fri']; // Usually only show a few labels
  const HEAT_COLORS = ['#ede9fe', '#c4b5fd', '#7c3aed', '#4f46e5'];

  // Identify months transitions to show month labels above the grid
  const monthLabels: { label: string; colIndex: number }[] = [];
  let lastMonth = -1;
  weekGrid.forEach((week, index) => {
    // Find first valid date in the week
    const d = week.find(day => day.date);
    if (!d) return;
    const dateObj = new Date(d.date);
    if (isNaN(dateObj.getTime())) return;
    const month = dateObj.getMonth();
    if (month !== lastMonth) {
      monthLabels.push({ label: dateObj.toLocaleString('default', { month: 'short' }), colIndex: index });
      lastMonth = month;
    }
  });

  // ── Session card ────────────────────────────────────────────────────────
  if (sessionActive && !sessionDone) {
    const card = sessionCards[currentIndex];
    const progress = ((currentIndex) / sessionCards.length) * 100;

    return (
      <DashboardLayout title="Flashcard Review">
        <div className="review-session-wrapper">
          {/* Progress bar */}
          <div className="review-progress-bar-wrap">
            <div className="review-progress-bar-track">
              <motion.div className="review-progress-bar-fill" animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} />
            </div>
            <span className="review-progress-count">{currentIndex + 1} / {sessionCards.length}</span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={card.id + '-' + currentIndex}
              initial={{ opacity: 0, x: 80 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -80 }}
              className="flashcard-scene"
              onClick={!flipped ? handleFlip : undefined}
            >
              {/* Flashcard */}
              <div className={`flashcard-inner ${flipped ? 'flipped' : ''}`}>
                {/* Front */}
                <div className="flashcard-face flashcard-front">
                  {card.is_weak && <span className="weak-badge">⚠️ Weak Area</span>}
                  <p className="flashcard-label">What does this mean?</p>
                  <h2 className="flashcard-word">{card.front}</h2>
                  {!flipped && <p className="flashcard-hint">Tap to reveal answer</p>}
                </div>
                {/* Back */}
                <div className="flashcard-face flashcard-back">
                  <p className="flashcard-label">Answer</p>
                  <h2 className="flashcard-word">{card.back}</h2>
                  <p className="flashcard-stats-mini">
                    EF: {card.easiness?.toFixed(1)} · Interval: {card.interval}d · Reps: {card.repetitions}
                  </p>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Answer buttons */}
          <AnimatePresence>
            {flipped && !answered && (
              <motion.div
                className="review-answer-buttons"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <button
                  className="review-btn review-btn-wrong"
                  onClick={() => handleAnswer(false)}
                >
                  <span className="review-btn-icon">✗</span>
                  Didn&apos;t Know
                </button>
                <button
                  className="review-btn review-btn-hard"
                  onClick={() => { hesitationRef.current += 2; handleAnswer(true); }}
                >
                  <span className="review-btn-icon">〜</span>
                  Hard
                </button>
                <button
                  className="review-btn review-btn-good"
                  onClick={() => { hesitationRef.current += 1; handleAnswer(true); }}
                >
                  <span className="review-btn-icon">✓</span>
                  Good
                </button>
                <button
                  className="review-btn review-btn-easy"
                  onClick={() => handleAnswer(true)}
                >
                  <span className="review-btn-icon">⚡</span>
                  Easy
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {answered && (
            <motion.div className="review-answer-feedback" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              Next card…
            </motion.div>
          )}
        </div>
      </DashboardLayout>
    );
  }

  // ── Session done ────────────────────────────────────────────────────────
  if (sessionDone && summary) {
    const accuracy = summary.total ? Math.round((summary.correct / summary.total) * 100) : 0;
    const speedLabel = summary.avgTime < 1500 ? '⚡ Fast' : summary.avgTime < 3500 ? '📘 Moderate' : '🐢 Slow';
    return (
      <DashboardLayout title="Review Complete">
        <motion.div
          className="review-done-wrapper"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="review-done-emoji">{accuracy >= 80 ? '🏆' : accuracy >= 50 ? '💪' : '📚'}</div>
          <h1 className="review-done-title">Session Complete!</h1>
          <p className="review-done-subtitle">{accuracy >= 80 ? 'Outstanding work!' : accuracy >= 50 ? 'Good effort! Keep going!' : 'Review these cards again soon.'}</p>

          <div className="review-done-stats">
            <div className="review-done-stat">
              <div className="review-done-stat-val">{accuracy}%</div>
              <div className="review-done-stat-label">Accuracy</div>
            </div>
            <div className="review-done-stat">
              <div className="review-done-stat-val">{summary.correct}/{summary.total}</div>
              <div className="review-done-stat-label">Cards Correct</div>
            </div>
            <div className="review-done-stat">
              <div className="review-done-stat-val">{speedLabel}</div>
              <div className="review-done-stat-label">Speed</div>
            </div>
          </div>

          <div className="review-done-actions">
            <button className="review-done-btn-primary" onClick={() => { setSessionDone(false); startSession(tab); }}>
              Review Again
            </button>
            <button className="review-done-btn-secondary" onClick={() => router.push('/dashboard')}>
              Back to Home
            </button>
          </div>
        </motion.div>
      </DashboardLayout>
    );
  }

  // ── Main Review Page ─────────────────────────────────────────────────────
  return (
    <DashboardLayout title="Review">
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>

        {/* Hero Header */}
        <div className="review-header-card">
          <div className="review-info">
            <h3 className="review-header-title">Ready to Review 🧠</h3>
            <p className="review-header-sub">
              {loading ? 'Loading cards…' : `${cards.length} due · ${weakCards.length} weak areas`}
            </p>
          </div>
          <button
            className="review-start-btn"
            onClick={() => startSession(tab)}
            disabled={loading || (tab === 'due' ? !cards.length : !weakCards.length)}
          >
            ▶
          </button>
        </div>

        {/* Tabs */}
        <div className="review-tabs">
          <button className={`review-tab ${tab === 'due' ? 'active' : ''}`} onClick={() => setTab('due')}>
            📅 Due Now <span className="review-tab-badge">{cards.length}</span>
          </button>
          <button className={`review-tab ${tab === 'weak' ? 'active' : ''}`} onClick={() => setTab('weak')}>
            ⚠️ Weak Areas <span className="review-tab-badge weak">{weakCards.length}</span>
          </button>
        </div>

        <div className="review-grid">

          {/* ── INTENSITY CALENDAR ─────────────────────────────────── */}
          <section className="intensity-calendar" style={{ paddingBottom: '20px' }}>

            {/* ── Nav: Month ‹ April 2026 › Year ── */}
            {(() => {
              const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
              const DAY_LABELS  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
              const HEAT_BG     = ['#f1f5f9','#ddd6fe','#a78bfa','#7c3aed','#4f46e5'];
              const HEAT_BORDER = ['#e2e8f0','#c4b5fd','#8b5cf6','#6d28d9','#3730a3'];
              const HEAT_TEXT   = ['#94a3b8','#6d28d9','#fff','#fff','#fff'];

              // Navigation helpers
              const prevMonth = () => {
                if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear(y => y - 1); }
                else setSelectedMonth(m => m - 1);
              };
              const nextMonth = () => {
                const now = new Date();
                if (selectedYear === now.getFullYear() && selectedMonth === now.getMonth()) return;
                if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear(y => y + 1); }
                else setSelectedMonth(m => m + 1);
              };
              const isAtMax = selectedYear === new Date().getFullYear() && selectedMonth === new Date().getMonth();
              const isAtMin = selectedYear === Math.min(...availableYears) && selectedMonth === 0;

              // Build day map
              const dayMap: Record<string, { count: number }> = {};
              heatmap.forEach(h => { if (h.date) dayMap[h.date] = { count: h.count }; });

              // Stats — compute BEFORE building cells so we have maxMonthCount
              const monthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
              const monthEntries = Object.entries(dayMap).filter(([d]) => d.startsWith(monthKey));
              const monthTotal  = monthEntries.reduce((s, [, v]) => s + v.count, 0);
              const activeDays  = monthEntries.filter(([, v]) => v.count > 0).length;
              const bestDay     = monthEntries.reduce((best, [, v]) => Math.max(best, v.count), 0);
              const maxMonthCount = bestDay || 1; // avoid divide-by-zero

              // Dynamic level helper: 0=none, 1=low, 2=mid-low, 3=mid-high, 4=high
              const dynLevel = (count: number): number => {
                if (count === 0) return 0;
                const ratio = count / maxMonthCount;
                if (ratio <= 0.25) return 1;
                if (ratio <= 0.5)  return 2;
                if (ratio <= 0.75) return 3;
                return 4;
              };

              // Build month cells
              const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
              const firstDow = new Date(selectedYear, selectedMonth, 1).getDay(); // 0=Sun
              const cells: { day: number; dateStr: string; count: number; level: number }[] = [];
              for (let b = 0; b < firstDow; b++) cells.push({ day: 0, dateStr: '', count: 0, level: 0 });
              for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                const count = dayMap[dateStr]?.count ?? 0;
                cells.push({ day: d, dateStr, count, level: dynLevel(count) });
              }
              while (cells.length % 7 !== 0) cells.push({ day: 0, dateStr: '', count: 0, level: 0 });
              const weeks: typeof cells[] = [];
              for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

              // Today
              const today = new Date();
              const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

              return (
                <div>
                  {/* Header row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#1e293b' }}>📅 Review Intensity</h4>
                      <p style={{ fontSize: '12px', color: '#64748b', margin: '3px 0 0', fontWeight: 500 }}>
                        {heatmapLoading ? 'Loading…' : monthTotal > 0 ? `${monthTotal} reviews this month` : 'No activity this month'}
                      </p>
                    </div>
                    {/* Month ‹ Apr 2026 › nav */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button onClick={prevMonth} disabled={isAtMin} style={{
                        width: '32px', height: '32px', borderRadius: '10px', border: '1.5px solid #e2e8f0',
                        background: 'white', cursor: isAtMin ? 'not-allowed' : 'pointer', fontSize: '16px',
                        color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: isAtMin ? 0.3 : 1, fontWeight: 700,
                      }}>‹</button>
                      <div style={{ textAlign: 'center', minWidth: '120px' }}>
                        <div style={{ fontSize: '15px', fontWeight: 800, color: '#1e293b' }}>
                          {MONTH_NAMES[selectedMonth]}
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#4f46e5' }}>{selectedYear}</div>
                      </div>
                      <button onClick={nextMonth} disabled={isAtMax} style={{
                        width: '32px', height: '32px', borderRadius: '10px', border: '1.5px solid #e2e8f0',
                        background: 'white', cursor: isAtMax ? 'not-allowed' : 'pointer', fontSize: '16px',
                        color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: isAtMax ? 0.3 : 1, fontWeight: 700,
                      }}>›</button>
                    </div>
                  </div>

                  {/* Stats pills */}
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                    {[
                      { label: 'Total Reviews', value: monthTotal, icon: '📝', color: '#eef2ff', text: '#4f46e5' },
                      { label: 'Active Days',   value: activeDays,  icon: '🔥', color: '#fef3c7', text: '#d97706' },
                      { label: 'Best Day',      value: bestDay,     icon: '⚡', color: '#f0fdf4', text: '#16a34a' },
                    ].map(stat => (
                      <div key={stat.label} style={{
                        flex: 1, background: stat.color, borderRadius: '12px', padding: '12px 14px',
                        display: 'flex', flexDirection: 'column', gap: '2px',
                      }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: stat.text, opacity: 0.75 }}>{stat.icon} {stat.label}</span>
                        <span style={{ fontSize: '20px', fontWeight: 900, color: stat.text, lineHeight: 1.1 }}>{stat.value || '—'}</span>
                      </div>
                    ))}
                  </div>

                  {heatmapLoading ? (
                    <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px' }}>
                      Loading your activity…
                    </div>
                  ) : (
                    <div style={{ background: '#f8fafc', borderRadius: '16px', padding: '16px', border: '1px solid #f1f5f9' }}>
                      {/* Day-of-week headers */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '6px' }}>
                        {DAY_LABELS.map(d => (
                          <div key={d} style={{ textAlign: 'center', fontSize: '11px', fontWeight: 700, color: '#94a3b8', padding: '4px 0' }}>{d}</div>
                        ))}
                      </div>
                      {/* Day cells */}
                      {weeks.map((week, wi) => (
                        <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '4px' }}>
                          {week.map((cell, di) => {
                            const isToday = cell.dateStr === todayStr;
                            const isEmpty = cell.day === 0;
                            return (
                              <div
                                key={di}
                                title={cell.count > 0 ? `${cell.count} review${cell.count > 1 ? 's' : ''} on ${cell.dateStr}` : cell.dateStr || ''}
                                onMouseEnter={() => cell.dateStr && setHoveredDay(cell.dateStr)}
                                onMouseLeave={() => setHoveredDay(null)}
                                style={{
                                  borderRadius: '10px',
                                  background: isEmpty ? 'transparent' : cell.level === 0 ? 'white' : HEAT_BG[Math.min(cell.level, 4)],
                                  border: isEmpty ? 'none' : isToday ? '2px solid #4f46e5' : `1.5px solid ${cell.level === 0 ? '#e2e8f0' : HEAT_BORDER[Math.min(cell.level, 4)]}`,
                                  padding: '8px 4px',
                                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                  cursor: cell.count > 0 ? 'pointer' : 'default',
                                  transition: 'transform 0.15s, box-shadow 0.15s',
                                  transform: hoveredDay === cell.dateStr ? 'scale(1.08)' : 'scale(1)',
                                  boxShadow: hoveredDay === cell.dateStr ? '0 4px 12px rgba(79,70,229,0.15)' : 'none',
                                  minHeight: '52px',
                                }}
                              >
                                {!isEmpty && (
                                  <>
                                    <span style={{
                                      fontSize: '13px', fontWeight: isToday ? 900 : 600,
                                      color: cell.level > 1 ? 'white' : isToday ? '#4f46e5' : '#475569',
                                      lineHeight: 1,
                                    }}>{cell.day}</span>
                                    {cell.count > 0 && (
                                      <span style={{
                                        fontSize: '10px', fontWeight: 800, marginTop: '4px',
                                        color: cell.level > 1 ? 'rgba(255,255,255,0.9)' : '#7c3aed',
                                        background: cell.level > 1 ? 'rgba(255,255,255,0.2)' : '#ede9fe',
                                        borderRadius: '4px', padding: '0 4px', lineHeight: '16px',
                                      }}>{cell.count}</span>
                                    )}
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Legend */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', marginTop: '14px' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>Less</span>
                    {HEAT_BG.map((c, i) => (
                      <div key={i} title={['0','1–4','5–9','10–14','15+'][i]} style={{
                        width: '14px', height: '14px', borderRadius: '4px', background: c,
                        border: `1.5px solid ${HEAT_BORDER[i]}`,
                      }} />
                    ))}
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>More</span>
                  </div>
                </div>
              );
            })()}
          </section>

          {/* Card List */}
          <section className="review-card-list">
            {loading ? (
              <div className="review-loading">Loading your cards…</div>
            ) : (
              <>
                {/* Due Cards */}
                {tab === 'due' && (
                  <div>
                    <h4 className="review-section-title due">
                      <span className="dot-pulse" />
                      Due Now ({cards.length})
                    </h4>
                    {cards.length === 0 ? (
                      <div className="review-empty">🎉 All caught up! No cards due.</div>
                    ) : (
                      <div className="card-list">
                        {cards.slice(0, 8).map((c) => (
                          <div key={c.id} className="card-list-item">
                            <div>
                              <div className="card-list-front">{c.front}</div>
                              <div className="card-list-meta">
                                Interval: {c.interval}d · EF: {c.easiness?.toFixed(1)}
                              </div>
                            </div>
                            <span className="card-list-due">Due</span>
                          </div>
                        ))}
                        {cards.length > 8 && (
                          <div className="card-list-more">+{cards.length - 8} more cards</div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Weak Areas */}
                {tab === 'weak' && (
                  <div>
                    <h4 className="review-section-title weak-title">
                      <span className="dot-weak" />
                      Weak Areas ({weakCards.length})
                    </h4>
                    {weakCards.length === 0 ? (
                      <div className="review-empty">✅ No weak areas detected yet. Keep reviewing!</div>
                    ) : (
                      <div className="card-list">
                        {weakCards.map((c) => (
                          <div key={c.id} className="card-list-item weak">
                            <div>
                              <div className="card-list-front">{c.front}</div>
                              <div className="card-list-meta">
                                Wrong: {c.incorrect_count}x · Right: {c.correct_count}x
                              </div>
                            </div>
                            <span className="card-list-weak-badge">⚠️ Weak</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </section>

        </div>
      </motion.div>
    </DashboardLayout>
  );
}

// Mock data for offline / empty state
const MOCK_CARDS: Card[] = [
  { id: 1, front: 'Hello', back: 'A standard greeting used anytime', is_weak: false, interval: 1, repetitions: 0, easiness: 2.5, correct_count: 0, incorrect_count: 0 },
  { id: 2, front: 'Good morning', back: 'Used before 12 PM', is_weak: false, interval: 1, repetitions: 0, easiness: 2.5, correct_count: 2, incorrect_count: 0 },
  { id: 3, front: 'Thank you', back: 'Showing gratitude', is_weak: false, interval: 6, repetitions: 2, easiness: 2.6, correct_count: 4, incorrect_count: 0 },
];
const MOCK_WEAK_CARDS: Card[] = [
  { id: 4, front: 'Quarter past', back: '15 minutes past the hour', is_weak: true, interval: 1, repetitions: 0, easiness: 1.7, correct_count: 1, incorrect_count: 3 },
  { id: 5, front: 'Excuse me', back: 'Getting someone\'s attention', is_weak: true, interval: 1, repetitions: 0, easiness: 1.9, correct_count: 2, incorrect_count: 4 },
];
