
import { supabase } from '../supabaseClient';
import { DailyVerse } from '../types';
import { DailyVersePlan } from '../utils/dailyVersePlan';

export const getTodayVerse = async (): Promise<DailyVerse> => {
  // Default to manual: pick the latest saved verse from Supabase, if any.
  const { data, error } = await supabase
    .from('daily_verses')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!error && data) {
    return data as DailyVerse;
  }

  // If none exists, fall back to a plan suggestion but do NOT fetch text automatically.
  const ref = DailyVersePlan.verseForToday();
  return {
    id: `local-fallback-${Date.now()}`,
    reference: ref,
    translation: 'NLT',
    text: null,
    image_url: null
  };
};

export const getVerseByReference = async (reference: string): Promise<DailyVerse> => {
  const { data, error } = await supabase
    .from('daily_verses')
    .select('*')
    .eq('reference', reference)
    .maybeSingle();

  if (error) {
    console.error("Error fetching verse:", error);
  }

  if (!data) {
    // Fallback if not found in Supabase
    return {
      id: `local-fallback-${Date.now()}`,
      reference: reference,
      translation: 'NLT',
      text: null,
      image_url: null
    };
  }

  return data as DailyVerse;
};
