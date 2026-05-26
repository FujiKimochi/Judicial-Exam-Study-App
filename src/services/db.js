import { INITIAL_SUBJECTS, INITIAL_POINTS, INITIAL_QUESTIONS } from '../data/initialData';

const DB_KEYS = {
  QUESTIONS: 'jud_exam_questions',
  POINTS: 'jud_exam_points',
  SUBJECTS: 'jud_exam_subjects'
};

// Initialize DB with seed data if empty
export const initDb = () => {
  if (!localStorage.getItem(DB_KEYS.SUBJECTS)) {
    localStorage.setItem(DB_KEYS.SUBJECTS, JSON.stringify(INITIAL_SUBJECTS));
  }
  if (!localStorage.getItem(DB_KEYS.POINTS)) {
    localStorage.setItem(DB_KEYS.POINTS, JSON.stringify(INITIAL_POINTS));
  }
  if (!localStorage.getItem(DB_KEYS.QUESTIONS)) {
    localStorage.setItem(DB_KEYS.QUESTIONS, JSON.stringify(INITIAL_QUESTIONS));
  }
};

export const getSubjects = () => {
  initDb();
  return JSON.parse(localStorage.getItem(DB_KEYS.SUBJECTS));
};

export const getPoints = () => {
  initDb();
  return JSON.parse(localStorage.getItem(DB_KEYS.POINTS));
};

export const getQuestions = () => {
  initDb();
  return JSON.parse(localStorage.getItem(DB_KEYS.QUESTIONS));
};

export const saveQuestion = (questionData) => {
  initDb();
  const questions = getQuestions();
  
  if (questionData.id) {
    // Update existing
    const idx = questions.findIndex(q => q.id === questionData.id);
    if (idx !== -1) {
      questions[idx] = {
        ...questions[idx],
        ...questionData,
        updatedAt: new Date().toISOString()
      };
    }
  } else {
    // Add new
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

export const deleteQuestion = (id) => {
  initDb();
  let questions = getQuestions();
  questions = questions.filter(q => q.id !== id);
  localStorage.setItem(DB_KEYS.QUESTIONS, JSON.stringify(questions));
  return questions;
};

// Toggle priority reviews
export const togglePriority = (id) => {
  initDb();
  const questions = getQuestions();
  const idx = questions.findIndex(q => q.id === id);
  if (idx !== -1) {
    questions[idx].isPriority = !questions[idx].isPriority;
    localStorage.setItem(DB_KEYS.QUESTIONS, JSON.stringify(questions));
  }
  return questions;
};

// Helper to get point count statistics
export const getPointStats = () => {
  const questions = getQuestions();
  const stats = {};
  questions.forEach(q => {
    stats[q.pointId] = (stats[q.pointId] || 0) + 1;
  });
  return stats;
};

// Search points helper
export const searchPoints = (query) => {
  const points = getPoints();
  const subjects = getSubjects();
  if (!query) return points;
  
  const q = query.toLowerCase();
  return points.filter(p => {
    const sub = subjects.find(s => s.id === p.subjectId);
    const subName = sub ? sub.name : '';
    return p.name.toLowerCase().includes(q) || subName.toLowerCase().includes(q);
  });
};
