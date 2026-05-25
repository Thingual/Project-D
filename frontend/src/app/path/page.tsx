'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { lessonService } from '@/services/lessons';
import DashboardLayout from '@/components/DashboardLayout';
import '@/styles/path.css';

/* ─── Types ──────────────────────────────────────────────────── */
type Lesson = {
  id: string | number;
  title: string;
  content_type: 'theory' | 'quiz' | 'speaking' | 'listening';
  order: number;
  is_completed: boolean;
};

type Unit = {
  id: number;
  title: string;
  description: string;
  icon: string;
  order: number;
  lessons: Lesson[];
};

type DashData = {
  user_name: string;
  current_level: string;
  units: Unit[];
};

/* ─── Content type meta ─────────────────────────────────────── */
const TYPE_META: Record<string, { icon: string; label: string; color: string }> = {
  theory:    { icon: '📖', label: 'Lesson',    color: 'theory'    },
  quiz:      { icon: '✏️', label: 'Quiz',      color: 'quiz'      },
  speaking:  { icon: '🎤', label: 'Speaking',  color: 'speaking'  },
  listening: { icon: '🎧', label: 'Listening', color: 'listening' },
};

/* ─── AI interest labels (pulled from localStorage if set) ───── */
const getInterestLabel = () => {
  try {
    const stored = localStorage.getItem('thingual_user');
    if (stored) {
      const u = JSON.parse(stored);
      const cats: string[] = u.interest_categories || u.categories || [];
      if (cats.length > 0) return cats.slice(0, 2).join(' & ');
    }
  } catch { /* ignore */ }
  return 'Your Interests';
};

/* ─── Unit progress helper ───────────────────────────────────── */
const unitProgress = (unit: Unit) => {
  const total = unit.lessons.length;
  if (!total) return 0;
  const done = unit.lessons.filter(l => l.is_completed).length;
  return Math.round((done / total) * 100);
};

/* ─── Is unit locked? First lesson of next unit not yet active ─ */
const isUnitLocked = (units: Unit[], uIndex: number) => {
  if (uIndex === 0) return false;
  const prev = units[uIndex - 1];
  const prevDone = prev.lessons.every(l => l.is_completed);
  return !prevDone;
};

export default function PathPage() {
  const router = useRouter();
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [interestLabel, setInterestLabel] = useState('Your Interests');
  const [selectedLesson, setSelectedLesson] = useState<{ lesson: Lesson; unitTitle: string } | null>(null);

  // ── A1 Unit 1 lesson slugs — must match /public/a1_unit_1/ filenames ──
  const [showA2, setShowA2] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<'A1' | 'A2'>('A1');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // ── A1 Unit 1 lesson slugs ──
  const A1_UNIT1_LESSONS: Lesson[] = [
    { id: 'a1_unit1_lesson01', title: 'Hello & Goodbye',                  content_type: 'theory',   order: 1, is_completed: false },
    { id: 'a1_unit1_lesson02', title: 'Introducing yourself',             content_type: 'speaking', order: 2, is_completed: false },
    { id: 'a1_unit1_lesson03', title: 'Asking about others',              content_type: 'quiz',     order: 3, is_completed: false },
    { id: 'a1_unit1_lesson04', title: 'Family & Friends',                 content_type: 'theory',   order: 4, is_completed: false },
    { id: 'a1_unit1_lesson05', title: 'Where I live',                     content_type: 'theory',   order: 5, is_completed: false },
    { id: 'a1_unit1_lesson06', title: 'Daily Routines',                   content_type: 'quiz',     order: 6, is_completed: false },
    { id: 'a1_unit1_lesson07', title: 'Hobbies & Preferences',            content_type: 'speaking', order: 7, is_completed: false },
    { id: 'a1_unit1_lesson08', title: 'Unit 1 Review',                    content_type: 'quiz',     order: 8, is_completed: false },
  ];

  // ── A2 units with correct lesson slugs ─────────────────────────────────
  const A2_UNITS: Unit[] = [
    {
      id: 7, title: 'Obligations, Rules & Advice',
      description: 'Use must, have to, need to, and should to talk about rules, obligations and advice.',
      icon: '📜', order: 7,
      lessons: [
        { id: 'a2_unit7_lesson01', title: 'Must & Mustn\'t — Rules', content_type: 'theory', order: 1, is_completed: false },
        { id: 'a2_unit7_lesson02', title: 'Have To & Don\'t Have To', content_type: 'theory', order: 2, is_completed: false },
        { id: 'a2_unit7_lesson03', title: 'Need To — Necessity', content_type: 'quiz', order: 3, is_completed: false },
        { id: 'a2_unit7_lesson04', title: 'Asking For & Giving Advice', content_type: 'speaking', order: 4, is_completed: false },
        { id: 'a2_unit7_lesson05', title: 'Rules at Work and School', content_type: 'theory', order: 5, is_completed: false },
        { id: 'a2_unit7_lesson06', title: 'Safety & Warning Signs', content_type: 'quiz', order: 6, is_completed: false },
        { id: 'a2_unit7_lesson07', title: 'Advice for Common Problems', content_type: 'speaking', order: 7, is_completed: false },
      ],
    },
    {
      id: 8, title: 'Describing & Comparing',
      description: 'Master intensified comparatives, superlatives, adjective order and adverbs of manner.',
      icon: '⚖️', order: 8,
      lessons: [
        { id: 'a2_unit8_lesson01', title: 'Much Better, Far Cheaper', content_type: 'theory', order: 1, is_completed: false },
        { id: 'a2_unit8_lesson02', title: 'Superlatives with Experience', content_type: 'theory', order: 2, is_completed: false },
        { id: 'a2_unit8_lesson03', title: 'Adjective Order', content_type: 'quiz', order: 3, is_completed: false },
        { id: 'a2_unit8_lesson04', title: 'Adverbs of Manner', content_type: 'theory', order: 4, is_completed: false },
        { id: 'a2_unit8_lesson05', title: 'Describing Places in Detail', content_type: 'speaking', order: 5, is_completed: false },
        { id: 'a2_unit8_lesson06', title: 'Describing People', content_type: 'speaking', order: 6, is_completed: false },
        { id: 'a2_unit8_lesson07', title: 'Writing Product Reviews', content_type: 'quiz', order: 7, is_completed: false },
        { id: 'a2_unit8_lesson08', title: 'Unit 8 Review', content_type: 'quiz', order: 8, is_completed: false },
      ],
    },
    {
      id: 9, title: 'Present Perfect & Past Simple',
      description: 'Understand when to use the present perfect vs past simple in everyday English.',
      icon: '🕰️', order: 9,
      lessons: [
        { id: 'a2_unit9_lesson01', title: 'Present Perfect — Introduction', content_type: 'theory', order: 1, is_completed: false },
        { id: 'a2_unit9_lesson02', title: 'Have You Ever…?', content_type: 'speaking', order: 2, is_completed: false },
        { id: 'a2_unit9_lesson03', title: 'For & Since', content_type: 'theory', order: 3, is_completed: false },
        { id: 'a2_unit9_lesson04', title: 'Just, Already & Yet', content_type: 'quiz', order: 4, is_completed: false },
        { id: 'a2_unit9_lesson05', title: 'Present Perfect vs Past Simple', content_type: 'theory', order: 5, is_completed: false },
        { id: 'a2_unit9_lesson06', title: 'Life Experiences Speaking', content_type: 'speaking', order: 6, is_completed: false },
        { id: 'a2_unit9_lesson07', title: 'Past Simple Review', content_type: 'quiz', order: 7, is_completed: false },
        { id: 'a2_unit9_lesson08', title: 'Unit 9 Review', content_type: 'quiz', order: 8, is_completed: false },
      ],
    },
    {
      id: 10, title: 'Future, Plans & Communication',
      description: 'Talk about the future, make plans, write formal emails and give directions.',
      icon: '📅', order: 10,
      lessons: [
        { id: 'a2_unit10_lesson01', title: 'Present Continuous for Future', content_type: 'theory', order: 1, is_completed: false },
        { id: 'a2_unit10_lesson02', title: 'Going To — Plans', content_type: 'theory', order: 2, is_completed: false },
        { id: 'a2_unit10_lesson03', title: 'Will — Predictions', content_type: 'theory', order: 3, is_completed: false },
        { id: 'a2_unit10_lesson04', title: 'Three Futures Compared', content_type: 'quiz', order: 4, is_completed: false },
        { id: 'a2_unit10_lesson05', title: 'May & Might — Possibility', content_type: 'theory', order: 5, is_completed: false },
        { id: 'a2_unit10_lesson06', title: 'Possibility in Conversation', content_type: 'speaking', order: 6, is_completed: false },
        { id: 'a2_unit10_lesson07', title: 'Writing Formal Emails', content_type: 'theory', order: 7, is_completed: false },
        { id: 'a2_unit10_lesson08', title: 'Formal vs Informal Email', content_type: 'quiz', order: 8, is_completed: false },
        { id: 'a2_unit10_lesson09', title: 'Making Appointments', content_type: 'speaking', order: 9, is_completed: false },
        { id: 'a2_unit10_lesson10', title: 'Changing & Cancelling Plans', content_type: 'speaking', order: 10, is_completed: false },
        { id: 'a2_unit10_lesson11', title: 'Giving Directions in Writing', content_type: 'theory', order: 11, is_completed: false },
        { id: 'a2_unit10_lesson12', title: 'Plans, Scheduling & Calendars', content_type: 'quiz', order: 12, is_completed: false },
        { id: 'a2_unit10_lesson13', title: 'Unit 10 Review', content_type: 'quiz', order: 13, is_completed: false },
      ],
    },
    {
      id: 11, title: 'Everyday English in Real Life',
      description: 'Master question tags, polite requests, phone English, small talk and expressing opinions.',
      icon: '💬', order: 11,
      lessons: [
        { id: 'a2_unit11_lesson01', title: 'Question Tags', content_type: 'theory', order: 1, is_completed: false },
        { id: 'a2_unit11_lesson02', title: 'So do I / Neither do I', content_type: 'theory', order: 2, is_completed: false },
        { id: 'a2_unit11_lesson03', title: 'Indirect Questions', content_type: 'theory', order: 3, is_completed: false },
        { id: 'a2_unit11_lesson04', title: 'Polite Requests', content_type: 'speaking', order: 4, is_completed: false },
        { id: 'a2_unit11_lesson05', title: 'Phone English', content_type: 'listening', order: 5, is_completed: false },
        { id: 'a2_unit11_lesson06', title: 'Social Media & Texting', content_type: 'theory', order: 6, is_completed: false },
        { id: 'a2_unit11_lesson07', title: 'Online Communication', content_type: 'theory', order: 7, is_completed: false },
        { id: 'a2_unit11_lesson08', title: 'Small Talk', content_type: 'speaking', order: 8, is_completed: false },
        { id: 'a2_unit11_lesson09', title: 'Reactions & Follow-up Questions', content_type: 'speaking', order: 9, is_completed: false },
        { id: 'a2_unit11_lesson10', title: 'Expressing Opinions', content_type: 'speaking', order: 10, is_completed: false },
        { id: 'a2_unit11_lesson11', title: 'Complaints & Requests in Person', content_type: 'speaking', order: 11, is_completed: false },
        { id: 'a2_unit11_lesson12', title: 'Describing Problems & Solutions', content_type: 'theory', order: 12, is_completed: false },
        { id: 'a2_unit11_lesson13', title: 'Unit 11 Review & Speaking Test', content_type: 'quiz', order: 13, is_completed: false },
      ],
    },
    {
      id: 12, title: 'Life Experiences & Present Perfect',
      description: 'Master the full present perfect toolkit with experiences, duration, and natural speaking for real life.',
      icon: '🌍', order: 12,
      lessons: [
        { id: 'a2_unit12_lesson01', title: 'Introducing have/has + past participle', content_type: 'theory', order: 1, is_completed: false },
        { id: 'a2_unit12_lesson02', title: 'Irregular past participles', content_type: 'theory', order: 2, is_completed: false },
        { id: 'a2_unit12_lesson03', title: 'Ever and never — life experience questions', content_type: 'quiz', order: 3, is_completed: false },
        { id: 'a2_unit12_lesson04', title: 'Already and yet', content_type: 'theory', order: 4, is_completed: false },
        { id: 'a2_unit12_lesson05', title: 'Just and still', content_type: 'theory', order: 5, is_completed: false },
        { id: 'a2_unit12_lesson06', title: 'Present perfect listening practice', content_type: 'quiz', order: 6, is_completed: false },
        { id: 'a2_unit12_lesson07', title: 'Talk about experiences', content_type: 'speaking', order: 7, is_completed: false },
        { id: 'a2_unit12_lesson08', title: 'Present perfect review', content_type: 'listening', order: 8, is_completed: false },
        { id: 'a2_unit12_lesson09', title: 'For and since — duration with present perfect', content_type: 'theory', order: 9, is_completed: false },
        { id: 'a2_unit12_lesson10', title: 'Present perfect question practice', content_type: 'quiz', order: 10, is_completed: false },
        { id: 'a2_unit12_lesson11', title: 'Speaking with present perfect', content_type: 'speaking', order: 11, is_completed: false },
        { id: 'a2_unit12_lesson12', title: 'Present perfect review & test', content_type: 'quiz', order: 12, is_completed: false },
        { id: 'a2_unit12_lesson13', title: 'Life experiences — extended speaking', content_type: 'speaking', order: 13, is_completed: false },
        { id: 'a2_unit12_lesson14', title: 'Reading, reviews & bucket lists', content_type: 'quiz', order: 14, is_completed: false },
      ],
    },
  ];

  useEffect(() => {
    setInterestLabel(getInterestLabel());
    lessonService.getDashboard()
      .then((res: DashData) => {
        // Always inject local JSON slugs for Unit 1 so lesson routing works
        if (res?.units) {
          const u1 = res.units.find((u: Unit) =>
            (u.title.toLowerCase().includes('greet') || u.order === 1 || u.id === 1) && (u as any).level !== 'A2'
          );
          if (u1) {
            const dbCompleted = (u1.lessons ?? []).map(l => Boolean(l.is_completed));
            u1.lessons = A1_UNIT1_LESSONS.map((l, i) => ({
              ...l,
              is_completed: dbCompleted[i] ?? false
            }));
          }
          
          const a1Units = (res.units ?? []).filter(u => u.order <= 6 && (u as any).level !== 'A2');
          const allA1Done = a1Units.length > 0 && a1Units.every(u => u.lessons.every(l => l.is_completed));
          const hasAnyA2Unit = (res.units ?? []).some(u => u.order > 6 || (u as any).level === 'A2');
          const unlockA2 = allA1Done || res.current_level === 'A2' || hasAnyA2Unit;

          setShowA2(unlockA2);
          setSelectedLevel(res.current_level === 'A2' ? 'A2' : 'A1');

          if (unlockA2) {
            const missingA2Units = A2_UNITS.filter(a2 => !res.units.some(u => u.order === a2.order || u.order === a2.order - 6));
            if (missingA2Units.length > 0) {
              res.units = [...res.units, ...missingA2Units];
            }
          }
        }
        setData(res);
      })
      .catch(() => setData(FALLBACK_DATA))
      .finally(() => setLoading(false));
  }, []);

  /* Find first active lesson (first not completed) */
  let firstActiveId: string | number | null = null;
  if (data?.units) {
    outer: for (const u of data.units) {
      for (const l of u.lessons) {
        if (!l.is_completed) { firstActiveId = l.id; break outer; }
      }
    }
  }

  const filteredUnits = data?.units?.filter(unit => {
    const unitLevel = (unit as any).level || (unit.order >= 7 ? 'A2' : 'A1');
    return unitLevel === selectedLevel;
  }) ?? [];

  /* Total progress across filtered units */
  const totalLessons = filteredUnits.reduce((s, u) => s + u.lessons.length, 0);
  const doneLessons  = filteredUnits.reduce((s, u) => s + u.lessons.filter(l => l.is_completed).length, 0);
  const overallPct   = totalLessons ? Math.round((doneLessons / totalLessons) * 100) : 0;

  const titleElement = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      <span>Learning Path</span>
      {showA2 && (
        <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#f1f5f9',
              border: '1.5px solid #cbd5e1',
              borderRadius: '12px',
              padding: '6px 14px 6px 14px',
              fontSize: '13px',
              fontWeight: 800,
              color: '#1e293b',
              cursor: 'pointer',
              outline: 'none',
              transition: 'all 0.15s ease',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = '#e2e8f0';
              e.currentTarget.style.borderColor = '#94a3b8';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = '#f1f5f9';
              e.currentTarget.style.borderColor = '#cbd5e1';
            }}
          >
            <span>{selectedLevel === 'A1' ? '⚡ A1 Level' : '🚀 A2 Level'}</span>
            <motion.span
              animate={{ rotate: dropdownOpen ? 180 : 0 }}
              transition={{ duration: 0.15 }}
              style={{ display: 'inline-block', fontSize: '9px', color: '#64748b' }}
            >
              ▼
            </motion.span>
          </button>

          <AnimatePresence>
            {dropdownOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -8 }}
                transition={{ duration: 0.12, ease: 'easeOut' }}
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  width: '210px',
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '14px',
                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05)',
                  padding: '6px',
                  zIndex: 1000,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                }}
              >
                {[
                  { value: 'A1', label: 'A1 Level', desc: 'Beginner essentials & greetings', icon: '⚡' },
                  { value: 'A2', label: 'A2 Level', desc: 'Elementary speaking & grammar', icon: '🚀' }
                ].map((item) => {
                  const isSelected = selectedLevel === item.value;
                  return (
                    <button
                      key={item.value}
                      onClick={() => {
                        setSelectedLevel(item.value as 'A1' | 'A2');
                        setDropdownOpen(false);
                      }}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        width: '100%',
                        padding: '8px 10px',
                        border: 'none',
                        borderRadius: '10px',
                        background: isSelected ? '#f5f3ff' : 'transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.12s ease',
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = isSelected ? '#f5f3ff' : '#f8fafc';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = isSelected ? '#f5f3ff' : 'transparent';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '2px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: isSelected ? '#4f46e5' : '#1e293b' }}>
                          {item.icon} {item.label}
                        </span>
                        {isSelected && (
                          <span style={{ fontSize: '10px', color: '#4f46e5', fontWeight: 900 }}>✓</span>
                        )}
                      </div>
                      <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 500, lineHeight: '1.2' }}>
                        {item.desc}
                      </span>
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );

  return (
    <DashboardLayout title={titleElement} user_name={data?.user_name}>
      <div className="path-wrapper">

        {/* ── Hero ─────────────────────────────────────────── */}
        <motion.div
          className="path-hero"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div>
            <p className="path-hero-label">AI-Personalized Curriculum</p>
            <h1 className="path-hero-title">
              {selectedLevel} English Journey
            </h1>
            <p className="path-hero-sub">Tailored to {interestLabel}</p>
            <div style={{ marginTop: '14px' }}>
              <span className="ai-tag">✨ AI Personalized</span>
            </div>
          </div>
          <div className="path-hero-badge">
            <div className="path-hero-level">{selectedLevel}</div>
            <div className="path-hero-level-label">CEFR Level</div>
          </div>
        </motion.div>

        {/* ── Overall Progress ─────────────────────────────── */}
        {!loading && (
          <motion.div
            className="path-overall-progress"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <div className="path-progress-info">
              <p className="path-progress-label">Overall Progress</p>
              <div className="path-progress-bar-track">
                <motion.div
                  className="path-progress-bar-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${overallPct}%` }}
                  transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                />
              </div>
            </div>
            <div className="path-progress-pct">{overallPct}%</div>
          </motion.div>
        )}

        {/* ── Loading skeletons ─────────────────────────────── */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {[1,2,3].map(i => <div key={i} className="path-skeleton-unit" />)}
          </div>
        )}

        {/* ── A1 Units ─────────────────────────────── */}
        {!loading && filteredUnits.map((unit, uIndex) => {
          const isA2Unit = unit.order >= 7 || (unit as any).level === 'A2';
          const locked   = isUnitLocked(filteredUnits, uIndex);
          const progress = unitProgress(unit);
          const allDone  = progress === 100;
          const colorIdx = uIndex % 5;
          const levelLabel = (unit as any).level || (isA2Unit ? 'A2' : 'A1');

          return (
            <motion.div
              key={unit.id}
              className="unit-section"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + uIndex * 0.08, duration: 0.4 }}
            >
              {/* Unit Banner */}
              <div className={`unit-banner color-${colorIdx} ${locked ? 'unit-banner-locked' : ''}`}>
                <div className="unit-banner-icon">{locked ? '🔒' : unit.icon}</div>
                <div className="unit-banner-info">
                  <p className="unit-banner-num">Unit {unit.order} · {levelLabel}</p>
                  <h2 className="unit-banner-title">{unit.title}</h2>
                  <p className="unit-banner-desc">{unit.description}</p>
                  {!locked && (
                    <div className="unit-progress-bar" style={{ marginTop: '10px' }}>
                      <div className="unit-progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                  {locked ? (
                    <span className="unit-banner-chip">🔒 Locked</span>
                  ) : allDone ? (
                    <span className="unit-banner-chip">✅ Complete</span>
                  ) : (
                    <span className="unit-banner-chip">{unit.lessons.filter(l=>l.is_completed).length}/{unit.lessons.length} done</span>
                  )}
                </div>
              </div>

              {/* Lesson Snake Path */}
              {!locked && (
                <div className={`lesson-path ${allDone ? 'is-complete' : ''}`}>
                  {unit.lessons.map((lesson, lIndex) => {
                    const isCompleted = lesson.is_completed;
                    const isActive    = lesson.id === firstActiveId;
                    const isLocked    = !isCompleted && !isActive && lIndex > 0
                      && !unit.lessons[lIndex - 1]?.is_completed
                      && unit.lessons[lIndex - 1]?.id !== firstActiveId;

                    const meta = TYPE_META[lesson.content_type] ?? TYPE_META.theory;

                    return (
                      <div
                        key={lesson.id}
                        className="lesson-node-wrap"
                        onClick={() => {
                          if (!isLocked) {
                            setSelectedLesson({ lesson, unitTitle: unit.title });
                          }
                        }}
                      >
                        {isActive && (
                          <div style={{ position: 'relative', width: '88px', marginBottom: '8px' }}>
                            <div className="active-label-arrow">▶  Start</div>
                          </div>
                        )}

                        <div
                          className={`lesson-node ${isCompleted ? 'completed' : isActive ? 'active' : isLocked ? 'locked' : 'active'}`}
                        >
                          <span className="node-icon">
                            {isCompleted ? '✓' : isLocked ? '🔒' : meta.icon}
                          </span>
                        </div>

                        <div className={`lesson-label-bubble ${isLocked ? 'locked-label' : ''}`}>
                          {lesson.title}
                          <div className={`lesson-label-type ${isLocked ? 'locked' : meta.color}`}>
                            {isLocked ? '🔒 Locked' : meta.label}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {allDone && (
                    <motion.div
                      className="unit-complete-badge"
                      initial={{ scale: 0, y: 20 }}
                      animate={{ scale: 1, y: 0 }}
                      transition={{ type: 'spring', bounce: 0.5 }}
                    >
                      <div className="badge-icon">🏆</div>
                      <div>Unit Complete!</div>
                      <div className="badge-subtitle">You've mastered this unit. Keep it up!</div>
                    </motion.div>
                  )}
                </div>
              )}

              {locked && (
                <div style={{ textAlign: 'center', padding: '32px', color: '#94a3b8', fontSize: '14px', fontWeight: 600 }}>
                  Complete Unit {unit.order - 1} to unlock this unit
                </div>
              )}
            </motion.div>
          );
        })}

        {/* ── A2 Level Divider + Preview (shown only when A1 in progress) ───────── */}
        {!loading && !showA2 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            style={{
              margin: '32px 0 8px',
              borderRadius: '24px',
              background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #4f46e5 100%)',
              padding: '32px 28px',
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
            <div style={{ fontSize: '48px' }}>🔐</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '11px', fontWeight: 900, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 6px' }}>Next Level</p>
              <h2 style={{ fontSize: '24px', fontWeight: 900, color: 'white', margin: '0 0 8px' }}>A2 English</h2>
              <p style={{ fontSize: '13px', color: '#c7d2fe', margin: '0 0 14px', lineHeight: 1.5 }}>
                5 units · 48 lessons · Modal verbs, comparatives, present perfect & more
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['📜 Obligations', '⚖️ Comparatives', '🕰️ Present Perfect', '📅 Future Tenses', '💬 Real-life English'].map(tag => (
                  <span key={tag} style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '99px' }}>{tag}</span>
                ))}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#a5b4fc', marginBottom: '6px' }}>Complete A1</div>
              <div style={{ fontSize: '11px', color: '#6366f1' }}>to unlock</div>
            </div>
          </motion.div>
        )}

      </div>

      {/* ── Lesson Preview Modal ─────────────────────────────── */}
      <AnimatePresence>
        {selectedLesson && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
              zIndex: 1000, backdropFilter: 'blur(4px)',
            }}
            onClick={() => setSelectedLesson(null)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              style={{
                background: 'white',
                borderRadius: '28px 28px 0 0',
                padding: '32px 32px 48px',
                width: '100%',
                maxWidth: '680px',
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Handle */}
              <div style={{ width: '40px', height: '4px', background: '#e2e8f0', borderRadius: '99px', margin: '0 auto 28px' }} />

              {/* Type pill */}
              <div style={{ marginBottom: '16px' }}>
                <span style={{
                  background: '#eef2ff', color: '#4f46e5', fontSize: '11px', fontWeight: 800,
                  padding: '5px 14px', borderRadius: '99px', textTransform: 'uppercase', letterSpacing: '0.08em'
                }}>
                  {TYPE_META[selectedLesson.lesson.content_type]?.icon} {TYPE_META[selectedLesson.lesson.content_type]?.label}
                </span>
                <span style={{ marginLeft: '8px', background: '#f1f5f9', color: '#64748b', fontSize: '11px', fontWeight: 700, padding: '5px 12px', borderRadius: '99px' }}>
                  AI Personalized
                </span>
              </div>

              <h2 style={{ fontSize: '26px', fontWeight: 900, color: '#1e293b', margin: '0 0 8px 0' }}>
                {selectedLesson.lesson.title}
              </h2>
              <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 28px 0', fontWeight: 500 }}>
                {selectedLesson.unitTitle}
              </p>

              {/* Stats row */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
                {[
                  { icon: '⏱️', label: `${3 + selectedLesson.lesson.order * 2} min` },
                  { icon: '🌟', label: `+${20 + selectedLesson.lesson.order * 5} XP` },
                  { icon: '📋', label: selectedLesson.lesson.is_completed ? 'Completed ✓' : 'Not started' },
                ].map(s => (
                  <div key={s.label} style={{
                    flex: 1, background: '#f8fafc', border: '1px solid #f1f5f9',
                    borderRadius: '12px', padding: '14px', textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '20px', marginBottom: '4px' }}>{s.icon}</div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* CTA buttons */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  style={{
                    flex: 1, padding: '18px', background: '#f1f5f9', color: '#64748b',
                    border: 'none', borderRadius: '16px', fontSize: '16px', fontWeight: 700, cursor: 'pointer'
                  }}
                  onClick={() => setSelectedLesson(null)}
                >
                  Cancel
                </button>
                <button
                  style={{
                    flex: 2, padding: '18px',
                    background: selectedLesson.lesson.is_completed
                      ? 'linear-gradient(135deg, #16a34a, #15803d)'
                      : 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                    color: 'white', border: 'none', borderRadius: '16px',
                    fontSize: '16px', fontWeight: 800, cursor: 'pointer',
                    boxShadow: '0 8px 24px rgba(79,70,229,0.35)'
                  }}
                  onClick={() => {
                    setSelectedLesson(null);
                    router.push(`/lesson/${selectedLesson.lesson.id}`);
                  }}
                >
                  {selectedLesson.lesson.is_completed ? '🔁 Review Again' : '▶  Start Lesson'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}

/* ── Fallback data (offline / API down) ─────────────────────── */
const FALLBACK_DATA: DashData = {
  user_name: 'Student',
  current_level: 'A1',
  units: [
    {
      id: 1, title: 'Greetings & Introductions',
      description: 'Learn how to say hello, introduce yourself, and talk about your life.',
      icon: '👋', order: 1,
      // ⚠️ IDs must be the a1_unit1_lessonXX slugs — lesson page loads JSON from /public/a1_unit_1/
      lessons: [
        { id: 'a1_unit1_lesson01', title: 'Hello & Goodbye',                  content_type: 'theory',   order: 1, is_completed: false },
        { id: 'a1_unit1_lesson02', title: 'Who am I? — Introducing yourself', content_type: 'speaking', order: 2, is_completed: false },
        { id: 'a1_unit1_lesson03', title: 'Asking about others',              content_type: 'quiz',     order: 3, is_completed: false },
        { id: 'a1_unit1_lesson04', title: 'Family & Friends',                 content_type: 'theory',   order: 4, is_completed: false },
        { id: 'a1_unit1_lesson05', title: 'Where I live',                     content_type: 'theory',   order: 5, is_completed: false },
        { id: 'a1_unit1_lesson06', title: 'Daily Routines',                   content_type: 'quiz',     order: 6, is_completed: false },
        { id: 'a1_unit1_lesson07', title: 'Hobbies & Preferences',            content_type: 'speaking', order: 7, is_completed: false },
        { id: 'a1_unit1_lesson08', title: 'Unit 1 Review',                    content_type: 'quiz',     order: 8, is_completed: false },
      ]
    },
    {
      id: 2, title: 'Numbers, Colors & Descriptions', description: 'Count, name colors and describe objects.',
      icon: '🎨', order: 2,
      lessons: [
        { id: 6, title: 'Numbers 1–20', content_type: 'theory', order: 1, is_completed: false },
        { id: 7, title: 'Colors in English', content_type: 'theory', order: 2, is_completed: false },
        { id: 8, title: 'Describing Objects', content_type: 'quiz', order: 3, is_completed: false },
        { id: 9, title: 'Numbers Listening', content_type: 'listening', order: 4, is_completed: false },
        { id: 10, title: 'Describe Your Room', content_type: 'speaking', order: 5, is_completed: false },
      ]
    },
    {
      id: 3, title: 'Daily Routines & Time', description: 'Talk about your day and tell the time.',
      icon: '⏰', order: 3,
      lessons: [
        { id: 11, title: 'Telling the Time', content_type: 'theory', order: 1, is_completed: false },
        { id: 12, title: 'My Daily Routine', content_type: 'theory', order: 2, is_completed: false },
        { id: 13, title: 'Days of the Week', content_type: 'quiz', order: 3, is_completed: false },
        { id: 14, title: 'A Day in the Life', content_type: 'listening', order: 4, is_completed: false },
        { id: 15, title: 'Describe Your Routine', content_type: 'speaking', order: 5, is_completed: false },
      ]
    },
    {
      id: 4, title: 'Food & Shopping', description: 'Order food and shop at the market.',
      icon: '🛒', order: 4,
      lessons: [
        { id: 16, title: 'Food Vocabulary', content_type: 'theory', order: 1, is_completed: false },
        { id: 17, title: 'Ordering at a Restaurant', content_type: 'speaking', order: 2, is_completed: false },
        { id: 18, title: 'Shopping Expressions', content_type: 'quiz', order: 3, is_completed: false },
        { id: 19, title: 'At the Market', content_type: 'listening', order: 4, is_completed: false },
        { id: 20, title: 'Likes & Dislikes', content_type: 'speaking', order: 5, is_completed: false },
      ]
    },
    {
      id: 5, title: 'Family & Describing People', description: 'Talk about family and describe people.',
      icon: '👨‍👩‍👧‍👦', order: 5,
      lessons: [
        { id: 21, title: 'Family Members', content_type: 'theory', order: 1, is_completed: false },
        { id: 22, title: 'Describing Appearance', content_type: 'theory', order: 2, is_completed: false },
        { id: 23, title: 'Personality Adjectives', content_type: 'quiz', order: 3, is_completed: false },
        { id: 24, title: 'Meet the Family', content_type: 'listening', order: 4, is_completed: false },
        { id: 25, title: 'Describe Your Family', content_type: 'speaking', order: 5, is_completed: false },
      ]
    },
  ]
};
