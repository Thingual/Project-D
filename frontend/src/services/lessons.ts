import api from './api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Map lesson slug → JSON filename in /public/A1-unit 1/
const A1_UNIT1_MAP: Record<string, string> = {
  'a1_unit1_lesson01': 'lesson_01_hello_goodbye.json',
  'a1_unit1_lesson02': 'lesson_02_introducing_yourself.json',
  'a1_unit1_lesson03': 'lesson_03_asking_about_others.json',
  'a1_unit1_lesson04': 'lesson_04_family_friends.json',
  'a1_unit1_lesson05': 'lesson_05_where_i_live.json',
  'a1_unit1_lesson06': 'lesson_06_daily_routines.json',
  'a1_unit1_lesson07': 'lesson_07_hobbies_preferences.json',
  'a1_unit1_lesson08': 'lesson_08_unit1_review.json',
};

// A2 Unit 7 — /public/A2/Unit-7/
const A2_UNIT7_MAP: Record<string, string> = {
  'a2_unit7_lesson01': 'a2_unit7_lesson01.json',
  'a2_unit7_lesson02': 'a2_unit7_lesson02.json',
  'a2_unit7_lesson03': 'a2_unit7_lesson03.json',
  'a2_unit7_lesson04': 'a2_unit7_lesson04.json',
  'a2_unit7_lesson05': 'a2_unit7_lesson05.json',
  'a2_unit7_lesson06': 'a2_unit7_lesson06.json',
  'a2_unit7_lesson07': 'a2_unit7_lesson07.json',
};

// A2 Unit 8 — /public/A2/unit-8/
const A2_UNIT8_MAP: Record<string, string> = {
  'a2_unit8_lesson01': 'a2_unit8_lesson01.json',
  'a2_unit8_lesson02': 'a2_unit8_lesson02.json',
  'a2_unit8_lesson03': 'a2_unit8_lesson03.json',
  'a2_unit8_lesson04': 'a2_unit8_lesson04.json',
  'a2_unit8_lesson05': 'a2_unit8_lesson05.json',
  'a2_unit8_lesson06': 'a2_unit8_lesson06.json',
  'a2_unit8_lesson07': 'a2_unit8_lesson07.json',
  'a2_unit8_lesson08': 'a2_unit8_lesson08.json',
};

// A2 Unit 9 — /public/A2/unit-9/  (Present Perfect & Past Simple)
const A2_UNIT9_MAP: Record<string, string> = {
  'a2_unit9_lesson01': 'a2_unit9_lesson01.json',
  'a2_unit9_lesson02': 'a2_unit9_lesson02.json',
  'a2_unit9_lesson03': 'a2_unit9_lesson03.json',
  'a2_unit9_lesson04': 'a2_unit9_lesson04.json',
  'a2_unit9_lesson05': 'a2_unit9_lesson05.json',
  'a2_unit9_lesson06': 'a2_unit9_lesson06.json',
  'a2_unit9_lesson07': 'a2_unit9_lesson07.json',
  'a2_unit9_lesson08': 'a2_unit9_lesson08.json',
};

// A2 Unit 10 — /public/A2/Unit-10/  (Future, Plans & Communication)
const A2_UNIT10_MAP: Record<string, string> = {
  'a2_unit10_lesson01': 'a2_unit10_lesson01.json',
  'a2_unit10_lesson02': 'a2_unit10_lesson02.json',
  'a2_unit10_lesson03': 'a2_unit10_lesson03.json',
  'a2_unit10_lesson04': 'a2_unit10_lesson04.json',
  'a2_unit10_lesson05': 'a2_unit10_lesson05.json',
  'a2_unit10_lesson06': 'a2_unit10_lesson06.json',
  'a2_unit10_lesson07': 'a2_unit10_lesson07.json',
  'a2_unit10_lesson08': 'a2_unit10_lesson08.json',
  'a2_unit10_lesson09': 'a2_unit10_lesson09.json',
  'a2_unit10_lesson10': 'a2_unit10_lesson10.json',
  'a2_unit10_lesson11': 'a2_unit10_lesson11.json',
  'a2_unit10_lesson12': 'a2_unit10_lesson12.json',
  'a2_unit10_lesson13': 'a2_unit10_lesson13.json',
};

// A2 Unit 11 — /public/A2/Unit-11/  (Everyday English in Real Life)
const A2_UNIT11_MAP: Record<string, string> = {
  'a2_unit11_lesson01': 'a2_unit11_lesson01.json',
  'a2_unit11_lesson02': 'a2_unit11_lesson02.json',
  'a2_unit11_lesson03': 'a2_unit11_lesson03.json',
  'a2_unit11_lesson04': 'a2_unit11_lesson04.json',
  'a2_unit11_lesson05': 'a2_unit11_lesson05.json',
  'a2_unit11_lesson06': 'a2_unit11_lesson06.json',
  'a2_unit11_lesson07': 'a2_unit11_lesson07.json',
  'a2_unit11_lesson08': 'a2_unit11_lesson08.json',
  'a2_unit11_lesson09': 'a2_unit11_lesson09.json',
  'a2_unit11_lesson10': 'a2_unit11_lesson10.json',
  'a2_unit11_lesson11': 'a2_unit11_lesson11.json',
  'a2_unit11_lesson12': 'a2_unit11_lesson12.json',
  'a2_unit11_lesson13': 'a2_unit11_lesson13.json',
};

// A2 Unit 12 — /public/A2/Unit-12/  (Present Perfect / Life Experiences)
const A2_UNIT12_MAP: Record<string, string> = {
  'a2_unit12_lesson01': 'a2_unit12_lesson01.json',
  'a2_unit12_lesson02': 'a2_unit12_lesson02.json',
  'a2_unit12_lesson03': 'a2_unit12_lessons03_04_05.json',
  'a2_unit12_lesson04': 'a2_unit12_lessons03_04_05.json',
  'a2_unit12_lesson05': 'a2_unit12_lessons03_04_05.json',
  'a2_unit12_lesson06': 'a2_unit12_lesson06.json',
  'a2_unit12_lesson07': 'a2_unit12_lesson07.json',
  'a2_unit12_lesson08': 'a2_unit12_lesson08.json',
  'a2_unit12_lesson09': 'a2_unit12_lessons09_10_11.json',
  'a2_unit12_lesson10': 'a2_unit12_lessons09_10_11.json',
  'a2_unit12_lesson11': 'a2_unit12_lessons09_10_11.json',
  'a2_unit12_lesson12': 'a2_unit12_lesson12.json',
  'a2_unit12_lesson13': 'a2_unit12_lesson13.json',
  'a2_unit12_lesson14': 'a2_unit12_lesson14.json',
};

// A1 Unit 6 — /public/a1_unit_6/
const A1_UNIT6_MAP: Record<string, string> = {
  'a1_unit6_lesson01': 'unit-6-lesson-1.json',
  'a1_unit6_lesson02': 'unit-6-lesson-2.json',
  'a1_unit6_lesson03': 'unit-6-lesson-3.json',
  'a1_unit6_lesson04': 'unit-6-lesson-4.json',
  'a1_unit6_lesson05': 'unit-6-lesson05.json',
  'a1_unit6_lesson06': 'unit-6-lesson-6.json',
  'a1_unit6_lesson07': 'unit-6-lesson-7.json',
  'a1_unit6_lesson08': 'unit-6-lesson-8.json',
};

async function fetchA1Unit6Lesson(slug: string): Promise<any> {
  const file = A1_UNIT6_MAP[slug];
  if (!file) {
    console.warn(`[fetchA1Unit6Lesson] No mapping for slug: "${slug}"`);
    return null;
  }
  const url = `/a1_unit_6/${file}`;
  console.log(`[fetchA1Unit6Lesson] Fetching: ${url}`);
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`[fetchA1Unit6Lesson] HTTP ${res.status} for ${url}`);
      return null;
    }
    const data = await res.json();
    console.log(`[fetchA1Unit6Lesson] OK — tasks: ${data.tasks?.length}`);
    return data;
  } catch (e) {
    console.error(`[fetchA1Unit6Lesson] Fetch failed:`, e);
    return null;
  }
}

async function fetchLocalLesson(slug: string): Promise<any> {
  const filename = A1_UNIT1_MAP[slug];
  if (!filename) {
    console.warn(`[fetchLocalLesson] No filename mapping for slug: "${slug}"`);
    return null;
  }

  const url = `/a1_unit_1/${filename}`;
  console.log(`[fetchLocalLesson] Fetching: ${url}`);
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`[fetchLocalLesson] HTTP ${res.status} for ${url}`);
      return null;
    }
    const data = await res.json();
    console.log(`[fetchLocalLesson] OK — tasks: ${data.tasks?.length}`);
    return data;
  } catch (e) {
    console.error(`[fetchLocalLesson] Fetch failed:`, e);
    return null;
  }
}

async function fetchA2Lesson(slug: string): Promise<any> {
  let url: string | null = null;

  if (slug.startsWith('a2_unit7_')) {
    const file = A2_UNIT7_MAP[slug];
    if (file) url = `/A2/Unit-7/${file}`;
  } else if (slug.startsWith('a2_unit8_')) {
    const file = A2_UNIT8_MAP[slug];
    if (file) url = `/A2/unit-8/${file}`;
  } else if (slug.startsWith('a2_unit9_')) {
    const file = A2_UNIT9_MAP[slug];
    if (file) url = `/A2/unit-9/${file}`;
  } else if (slug.startsWith('a2_unit10_')) {
    const file = A2_UNIT10_MAP[slug];
    if (file) url = `/A2/Unit-10/${file}`;
  } else if (slug.startsWith('a2_unit11_')) {
    const file = A2_UNIT11_MAP[slug];
    if (file) url = `/A2/Unit-11/${file}`;
  } else if (slug.startsWith('a2_unit12_')) {
    const file = A2_UNIT12_MAP[slug];
    if (file) url = `/A2/Unit-12/${file}`;
  }

  if (!url) {
    console.warn(`[fetchA2Lesson] No mapping for slug: "${slug}"`);
    return null;
  }

  console.log(`[fetchA2Lesson] Fetching: ${url}`);
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`[fetchA2Lesson] HTTP ${res.status} for ${url}`);
      return null;
    }
    const data = await res.json();
    console.log(`[fetchA2Lesson] OK — tasks: ${data.tasks?.length}`);
    return data;
  } catch (e) {
    console.error(`[fetchA2Lesson] Fetch failed:`, e);
    return null;
  }
}

export const lessonService = {
  // ── Core Lessons ──────────────────────────────────────────────────────────
  getDashboard: async () => {
    const res = await api.get('/lessons/dashboard');
    return res.data;
  },

  getProgress: async (year?: number) => {
    const url = year ? `/lessons/progress?year=${year}` : '/lessons/progress';
    const res = await api.get(url);
    return res.data;
  },

  getLesson: async (id: string | number) => {
    const slug = String(id);

    if (slug.startsWith('a1_unit1_')) {
      const localData = await fetchLocalLesson(slug);
      if (localData) return localData;
      console.warn(`[getLesson] Local data not found for ${slug}, falling back...`);
      throw new Error(`Local lesson not found: ${slug}`);
    }

    if (slug.startsWith('a1_unit6_')) {
      const localData = await fetchA1Unit6Lesson(slug);
      if (localData) return localData;
      console.warn(`[getLesson] Unit6 local data not found for ${slug}, falling back to API...`);
    }

    if (slug.startsWith('a2_unit')) {
      const localData = await fetchA2Lesson(slug);
      if (localData) return localData;
      console.warn(`[getLesson] A2 local data not found for ${slug}, falling back to API...`);
    }

    const response = await api.get(`/lessons/${id}`);
    
    // Check if the API returned an error payload
    if (response.data && response.data.error) {
       throw new Error(response.data.error);
    }
    
    return response.data;
  },


  completeLesson: async (lessonId: any, payload: { accuracy?: number } = {}) => {
    const res = await api.post(`/lessons/${lessonId}/complete`, payload);
    return res.data;
  },

  // ── SM-2 Flashcards ───────────────────────────────────────────────────────
  getDueCards: async (limit = 20) => {
    const res = await api.get(`/lessons/sm2/due?limit=${limit}`);
    return res.data;
  },

  getWeakCards: async () => {
    const res = await api.get('/lessons/sm2/weak');
    return res.data;
  },

  getAllCards: async () => {
    const res = await api.get('/lessons/sm2/all');
    return res.data;
  },

  submitSM2: async (payload: {
    card_id: number;
    is_correct: boolean;
    response_time_ms: number;
    hesitation_count?: number;
    answer_duration_ms?: number;
    transcript?: string;
  }) => {
    const res = await api.post('/lessons/sm2/submit', payload);
    return res.data;
  },

  seedCards: async (lessonId: number) => {
    const res = await api.post(`/lessons/sm2/seed/${lessonId}`, {});
    return res.data;
  },

  // ── Velocity Tracker ──────────────────────────────────────────────────────
  logVelocity: async (payload: {
    lesson_id?: number;
    card_id?: number;
    response_time_ms: number;
    answer_duration_ms?: number;
    hesitation_count?: number;
    transcript?: string;
  }) => {
    const res = await api.post('/lessons/velocity/log', payload);
    return res.data;
  },

  getVelocityStats: async () => {
    const res = await api.get('/lessons/velocity/stats');
    return res.data;
  },
};
