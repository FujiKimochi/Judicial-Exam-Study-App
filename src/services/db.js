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
  const DB_VERSION_KEY = 'judicial_db_version';
  const CURRENT_DB_VERSION = '3'; // Version 3 introduces and forces the 318 Japanese parsed points
  const storedVersion = localStorage.getItem(DB_VERSION_KEY);

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

      // Check if we need to force-upgrade points to Version 3
      if (storedVersion !== CURRENT_DB_VERSION) {
        console.log('Upgrading Supabase points list to version', CURRENT_DB_VERSION);
        const dbPoints = INITIAL_POINTS.map(p => ({
          id: p.id,
          subject_id: p.subjectId,
          name: p.name
        }));
        
        // Use upsert to overwrite existing points and add new ones
        const { error: upsertError } = await supabase.from('points').upsert(dbPoints);
        if (upsertError) {
          console.error('Failed to upsert points in Supabase during upgrade:', upsertError);
        } else {
          localStorage.setItem(DB_VERSION_KEY, CURRENT_DB_VERSION);
        }
      } else {
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
    
    // Check if points list is empty or if we need to upgrade to Version 3
    if (!localStorage.getItem(DB_KEYS.POINTS) || storedVersion !== CURRENT_DB_VERSION) {
      localStorage.setItem(DB_KEYS.POINTS, JSON.stringify(INITIAL_POINTS));
      localStorage.setItem(DB_VERSION_KEY, CURRENT_DB_VERSION);
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

// Helper to convert DataURL (Base64) to Blob
const dataURLtoBlob = (dataurl) => {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
};

// Upload Base64 image to Supabase Storage and get public URL
const uploadImageToSupabase = async (supabase, bucketName, filePath, base64Data) => {
  try {
    const blob = dataURLtoBlob(base64Data);
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, blob, {
        contentType: blob.type,
        upsert: true
      });
    
    if (error) throw error;
    
    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);
      
    return publicUrlData.publicUrl;
  } catch (e) {
    console.error('Failed to upload image to Supabase Storage', e);
    throw e;
  }
};

export const saveQuestion = async (questionData) => {
  await initDb();

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    
    if (!supabase) {
      console.error('Supabase client is null despite being configured. Falling back to localStorage.');
      // Fall through to localStorage path below
    } else {
      const bucketName = 'judicial-exam-assets';
      const qFolderId = questionData.id || `q-${Date.now()}`;

      // 1. Upload screenshots if they are Base64
      const uploadedScreenshots = [];
      for (let i = 0; i < (questionData.screenshots || []).length; i++) {
        const src = questionData.screenshots[i];
        if (src && src.startsWith('data:image/')) {
          const filePath = `questions/${qFolderId}/screenshot-${i}-${Date.now()}.png`;
          try {
            const publicUrl = await uploadImageToSupabase(supabase, bucketName, filePath, src);
            uploadedScreenshots.push(publicUrl);
          } catch (err) {
            console.error(err);
            uploadedScreenshots.push(src); // Fallback to base64 if upload fails
          }
        } else {
          uploadedScreenshots.push(src);
        }
      }

      // 2. Upload chat attachments if they are Base64
      const updatedChatHistory = [];
      if (questionData.chatHistory) {
        for (let i = 0; i < questionData.chatHistory.length; i++) {
          const chat = questionData.chatHistory[i];
          if (chat.attachments && chat.attachments.length > 0) {
            const uploadedAttachments = [];
            for (let j = 0; j < chat.attachments.length; j++) {
              const att = chat.attachments[j];
              if (att && att.startsWith('data:image/')) {
                const filePath = `chats/${qFolderId}/chat-${i}-${j}-${Date.now()}.png`;
                try {
                  const publicUrl = await uploadImageToSupabase(supabase, bucketName, filePath, att);
                  uploadedAttachments.push(publicUrl);
                } catch (err) {
                  console.error(err);
                  uploadedAttachments.push(att);
                }
              } else {
                uploadedAttachments.push(att);
              }
            }
            updatedChatHistory.push({
              ...chat,
              attachments: uploadedAttachments
            });
          } else {
            updatedChatHistory.push(chat);
          }
        }
      }

      const finalQuestionData = {
        ...questionData,
        screenshots: uploadedScreenshots,
        chatHistory: updatedChatHistory
      };

      const dbObj = mapJsToDbQuestion(finalQuestionData);

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
  }

  // === localStorage fallback ===
  let questions = [];
  try {
    const raw = localStorage.getItem(DB_KEYS.QUESTIONS);
    questions = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(questions)) {
      questions = [];
    }
  } catch (parseErr) {
    console.error('Failed to parse localStorage questions, resetting', parseErr);
    questions = [];
  }

  // Strip large Base64 screenshots to avoid exceeding localStorage quota (5MB limit)
  const sanitizedData = { ...questionData };
  if (sanitizedData.screenshots) {
    sanitizedData.screenshots = sanitizedData.screenshots.map(src => {
      // Keep base64 images but warn if they're very large
      if (src && src.length > 500000) {
        console.warn('Large Base64 screenshot detected (' + Math.round(src.length / 1024) + 'KB). May approach localStorage quota.');
      }
      return src;
    });
  }

  if (sanitizedData.id) {
    const idx = questions.findIndex(q => q.id === sanitizedData.id);
    if (idx !== -1) {
      questions[idx] = {
        ...questions[idx],
        ...sanitizedData,
        updatedAt: new Date().toISOString()
      };
    }
  } else {
    const newQuestion = {
      ...sanitizedData,
      id: `q-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    questions.push(newQuestion);
  }
  
  try {
    localStorage.setItem(DB_KEYS.QUESTIONS, JSON.stringify(questions));
  } catch (quotaErr) {
    console.error('localStorage quota exceeded. Trying without screenshots...', quotaErr);
    // Try saving without Base64 screenshots
    const stripped = questions.map(q => ({
      ...q,
      screenshots: (q.screenshots || []).map(s => 
        (s && s.startsWith('data:image/') && s.length > 100000) ? '[screenshot-too-large]' : s
      )
    }));
    localStorage.setItem(DB_KEYS.QUESTIONS, JSON.stringify(stripped));
  }
  
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
