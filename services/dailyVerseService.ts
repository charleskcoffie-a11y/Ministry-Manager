
import { supabase } from '../supabaseClient';
import { DailyVerse } from '../types';
import { DailyVersePlan } from '../utils/dailyVersePlan';

export const getTodayVerse = async (): Promise<DailyVerse> => {
  const ref = DailyVersePlan.verseForToday();
  return getVerseByReference(ref);
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
