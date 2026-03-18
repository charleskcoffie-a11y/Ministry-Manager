
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
  // First, check if verse exists in Supabase
  const { data, error } = await supabase
    .from('daily_verses')
    .select('*')
    .eq('reference', reference)
    .maybeSingle();

  if (error) {
    console.error("Error fetching verse:", error);
  }

  if (data && data.text) {
    // Return verse from database if it has text
    return data as DailyVerse;
  }

  // If not in database or no text, try to fetch from Bible API
  try {
    // Using Bible API (labs.bible.org/api)
    // Normalize em-dashes and en-dashes to hyphens for API compatibility
    const cleanRef = reference.trim().replace(/[\u2013\u2014]/g, '-');
    const response = await fetch(`https://labs.bible.org/api/?passage=${encodeURIComponent(cleanRef)}&type=json`);
    
    if (response.ok) {
      const apiData = await response.json();
      
      if (apiData && apiData.length > 0) {
        // Combine all verses if multiple verses returned
        const verseText = apiData.map((v: any) => v.text).join(' ');
        
        // Save to Supabase for future use
        const verseData: DailyVerse = {
          id: data?.id || `api-${Date.now()}`,
          reference: reference,
          translation: 'ASV',
          text: verseText,
          image_url: data?.image_url || null
        };
        
        // Try to save to database (don't wait for it)
        if (!data) {
          supabase.from('daily_verses').insert({
            reference: reference,
            translation: 'ASV',
            text: verseText
          }).then(() => console.log('Verse saved to database'));
        }
        
        return verseData;
      }
    }
  } catch (apiError) {
    console.error("Error fetching from Bible API:", apiError);
  }

  // Fallback if API fails or verse not found
  return {
    id: data?.id || `local-fallback-${Date.now()}`,
    reference: reference,
    translation: 'NLT',
    text: `[${reference}] - Text not available. Please check the reference or add manually.`,
    image_url: data?.image_url || null
  };
};
