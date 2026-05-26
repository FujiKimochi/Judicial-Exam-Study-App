import { INITIAL_SUBJECTS, INITIAL_POINTS, INITIAL_QUESTIONS } from '../data/initialData';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';

const DB_KEYS = {
  QUESTIONS: 'jud_exam_questions',
  POINTS: 'jud_exam_points',
  SUBJECTS: 'jud_exam_subjects'
};

// Map database snake_case to React camelCase
const mapDbToJsQuestion = (q) => {
  if (!q) return null;
  return {
    id: q.id,
    pointId: q.point_id,
    screenshots: q.screenshots || [],
    prompt: q.prompt || '',
    aiResponse: q.ai_response || '',
    chatHistory: q.chat_history || [],
    referenceLinks: q.reference_links || [],
    isPriority: q.is_priority || false,
    createdAt: q.created_at
  };
};

const mapJsToDbQuestion = (q) => {
  if (!q) return null;
  const dbObj = {
    point_id: q.pointId,
    screenshots: q.screenshots,
    prompt: q.prompt,
    ai_response: q.aiResponse,
    chat_history: q.chatHistory,
    reference_links: q.referenceLinks,
    is_priority: q.isPriority
  };
  if (q.id) {
    dbObj.id = q.id;
  }
  return dbObj;
};

// Initialize local storage database
export const initDb = async () => {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      // Auto Seed Database in Supabase if tables are empty!
      const { data: subs, error: subError } = await supabase.from('subjects').select('id').limit(1);
      if (!subError && subs.length === 0) {
        console.log('Seeding Supabase subjects...');
        await supabase.from('subjects').insert(INITIAL_SUBJECTS);
      }

      const { data: pts, error: ptError } = await supabase.from('points').select('id').limit(1);
      if (!ptError && pts.length === 0) {
        console.log('Seeding Supabase points...');
        const dbPoints = INITIAL_POINTS.map(p => ({
          id: p.id,
          subject_id: p.subjectId,
          name: p.name
        }));
        await supabase.from('points').insert(dbPoints);
      }

      const { data: qsts, error: qError } = await supabase.from('questions').select('id').limit(1);
      if (!qError && qsts.length === 0) {
        console.log('Seeding Supabase questions...');
        const dbQuestions = INITIAL_QUESTIONS.map(q => {
          const dbQ = mapJsToDbQuestion(q);
          if (q.createdAt) dbQ.created_at = q.createdAt;
          return dbQ;
        });
        await supabase.from('questions').insert(dbQuestions);
      }
    } catch (e) {
      console.error('Failed to initialize or seed Supabase', e);
    }
  } else {
    // LocalStorage Fallback
    if (!localStorage.getItem(DB_KEYS.SUBJECTS)) {
      localStorage.setItem(DB_KEYS.SUBJECTS, JSON.stringify(INITIAL_SUBJECTS));
    }
    if (!localStorage.getItem(DB_KEYS.POINTS)) {
      localStorage.setItem(DB_KEYS.POINTS, JSON.stringify(INITIAL_POINTS));
    }
    if (!localStorage.getItem(DB_KEYS.QUESTIONS)) {
      localStorage.setItem(DB_KEYS.QUESTIONS, JSON.stringify(INITIAL_QUESTIONS));
    }
  }
};

export const getSubjects = async () => {
  await initDb();
  
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('subjects').select('*').order('name');
    if (error) {
      console.error('Error fetching subjects from Supabase', error);
      return INITIAL_SUBJECTS;
    }
    return data;
  }

  return JSON.parse(localStorage.getItem(DB_KEYS.SUBJECTS));
};

export const getPoints = async () => {
  await initDb();

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('points').select('*');
    if (error) {
      console.error('Error fetching points from Supabase', error);
      return INITIAL_POINTS;
    }
    return data.map(p => ({
      id: p.id,
      subjectId: p.subject_id,
      name: p.name
    }));
  }

  return JSON.parse(localStorage.getItem(DB_KEYS.POINTS));
};

export const getQuestions = async () => {
  await initDb();

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('questions').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching questions from Supabase', error);
      return [];
    }
    return data.map(mapDbToJsQuestion);
  }

  return JSON.parse(localStorage.getItem(DB_KEYS.QUESTIONS));
};

export const saveQuestion = async (questionData) => {
  await initDb();

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const dbObj = mapJsToDbQuestion(questionData);

    if (questionData.id) {
      // Update
      const { data, error } = await supabase
        .from('questions')
        .update(dbObj)
        .eq('id', questionData.id)
        .select();
      if (error) throw error;
      return await getQuestions();
    } else {
      // Insert
      const { data, error } = await supabase
        .from('questions')
        .insert([dbObj])
        .select();
      if (error) throw error;
      return await getQuestions();
    }
  }

  const questions = JSON.parse(localStorage.getItem(DB_KEYS.QUESTIONS));
  
  if (questionData.id) {
    const idx = questions.findIndex(q => q.id === questionData.id);
    if (idx !== -1) {
      questions[idx] = {
        ...questions[idx],
        ...questionData,
        updatedAt: new Date().toISOString()
      };
    }
  } else {
    const newQuestion = {
      ...questionData,
      id: `q-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    questions.push(newQuestion);
  }
  
  localStorage.setItem(DB_KEYS.QUESTIONS, JSON.stringify(questions));
  return questions;
};

export const deleteQuestion = async (id) => {
  await initDb();

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('questions').delete().eq('id', id);
    if (error) throw error;
    return await getQuestions();
  }

  let questions = JSON.parse(localStorage.getItem(DB_KEYS.QUESTIONS));
  questions = questions.filter(q => q.id !== id);
  localStorage.setItem(DB_KEYS.QUESTIONS, JSON.stringify(questions));
  return questions;
};

export const togglePriority = async (id) => {
  await initDb();
  
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    // Fetch first to toggle
    const { data: current } = await supabase.from('questions').select('is_priority').eq('id', id).single();
    if (current) {
      const { error } = await supabase
        .from('questions')
        .update({ is_priority: !current.is_priority })
        .eq('id', id);
      if (error) throw error;
    }
    return await getQuestions();
  }

  const questions = JSON.parse(localStorage.getItem(DB_KEYS.QUESTIONS));
  const idx = questions.findIndex(q => q.id === id);
  if (idx !== -1) {
    questions[idx].isPriority = !questions[idx].isPriority;
    localStorage.setItem(DB_KEYS.QUESTIONS, JSON.stringify(questions));
  }
  return questions;
};

export const getPointStats = async () => {
  const questions = await getQuestions();
  const stats = {};
  questions.forEach(q => {
    stats[q.pointId] = (stats[q.pointId] || 0) + 1;
  });
  return stats;
};

export const searchPoints = async (query) => {
  const points = await getPoints();
  const subjects = await getSubjects();
  if (!query) return points;
  
  const q = query.toLowerCase();
  return points.filter(p => {
    const sub = subjects.find(s => s.id === p.subjectId);
    const subName = sub ? sub.name : '';
    return p.name.toLowerCase().includes(q) || subName.toLowerCase().includes(q);
  });
};
