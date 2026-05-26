import { createClient } from '@supabase/supabase-js';

// Helper to get configuration either from environment variables or localStorage
export const getSupabaseConfig = () => {
  // 1. Check environment variables (Vite)
  let url = import.meta.env.VITE_SUPABASE_URL;
  let anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  // 2. Check localStorage (allows users to paste keys directly in the UI settings)
  if (!url || !anonKey) {
    try {
      const storedConfig = localStorage.getItem('supabase_settings');
      if (storedConfig) {
        const parsed = JSON.parse(storedConfig);
        url = parsed.url || url;
        anonKey = parsed.anonKey || anonKey;
      }
    } catch (e) {
      console.error('Error reading Supabase settings from localStorage', e);
    }
  }

  return { url, anonKey };
};

let supabaseInstance = null;

export const getSupabaseClient = () => {
  if (supabaseInstance) return supabaseInstance;

  const { url, anonKey } = getSupabaseConfig();

  if (url && anonKey) {
    try {
      // Connect to the custom "judicial_exam" schema to keep data isolated from other apps!
      supabaseInstance = createClient(url, anonKey, {
        db: {
          schema: 'judicial_exam'
        }
      });
      return supabaseInstance;
    } catch (error) {
      console.error('Failed to create Supabase client', error);
      return null;
    }
  }

  return null;
};

// Check if Supabase connection is configured and ready
export const isSupabaseConfigured = () => {
  const { url, anonKey } = getSupabaseConfig();
  return !!(url && anonKey);
};
