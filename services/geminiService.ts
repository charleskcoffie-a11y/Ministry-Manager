import { Type } from "@google/genai";
import type { ServiceHymnAiGuidance, ServiceHymnSlot } from '../types';
import { DEFAULT_SUPABASE_ANON_KEY, DEFAULT_SUPABASE_URL } from '../config/supabaseDefaults.js';

const configuredSupabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const configuredSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const hasConfiguredSupabaseEdge = Boolean(configuredSupabaseUrl && configuredSupabaseAnonKey);
const isLocalBrowserHost = typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/u.test(window.location.hostname);
const resolvedSupabaseUrl = hasConfiguredSupabaseEdge ? configuredSupabaseUrl : DEFAULT_SUPABASE_URL;
const resolvedSupabaseAnonKey = hasConfiguredSupabaseEdge ? configuredSupabaseAnonKey : DEFAULT_SUPABASE_ANON_KEY;
const useSupabaseEdgeFunction = Boolean(resolvedSupabaseUrl && resolvedSupabaseAnonKey) && (!isLocalBrowserHost || hasConfiguredSupabaseEdge);

const AI_PROXY_MISSING_MESSAGE = useSupabaseEdgeFunction
  ? 'AI features are unavailable because the Supabase Edge Function gemini-proxy is not deployed or reachable. Deploy it to your Supabase project and rebuild the app.'
  : 'AI features are unavailable because the secure AI proxy is not running. Start the app with npm run dev:secure or npm run preview:secure.';
const MISSING_AI_KEY_MESSAGE = useSupabaseEdgeFunction
  ? 'AI features are unavailable because GEMINI_API_KEY is not configured in Supabase Edge Function secrets. Set it in Supabase and redeploy the function.'
  : 'AI features are unavailable because GEMINI_API_KEY is not configured on the server. Add it to .env and restart the secure app server.';
const BLOCKED_AI_KEY_MESSAGE = useSupabaseEdgeFunction
  ? 'AI features are unavailable because the Gemini key configured in Supabase was rejected. Replace GEMINI_API_KEY in your Supabase secrets and redeploy the function.'
  : 'AI features are unavailable because the server-side Gemini key was rejected. Replace GEMINI_API_KEY with a new key and restart the secure app server.';
const GENERIC_AI_ERROR_MESSAGE = useSupabaseEdgeFunction
  ? 'Could not reach the Supabase AI function right now. Please try again later.'
  : 'Could not reach the secure AI proxy right now. Please try again later.';

let aiFailureReason: AiFeatureStatus['reason'] = 'ready';
let aiUnavailableMessage = '';

export interface AiFeatureStatus {
  available: boolean;
  reason: 'ready' | 'proxy-missing' | 'missing-key' | 'blocked-key';
  message: string;
}

interface GeminiProxyRequest {
  model: string;
  contents: unknown;
  config?: Record<string, unknown>;
}

const extractGeminiErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  try {
    const serialized = JSON.stringify(error);
    if (serialized && serialized !== '{}') {
      return serialized;
    }
  } catch {
    // Ignore serialization failures and fall back to String below.
  }

  return String(error ?? 'Unknown Gemini error');
};

const isBlockedGeminiError = (message: string) =>
  /reported as leaked|permission_denied|api key.+(?:invalid|rejected|disabled|revoked)|status":"PERMISSION_DENIED"|code":403/iu.test(message);

const getSupabaseEdgeUrl = () => `${resolvedSupabaseUrl.replace(/\/+$/u, '')}/functions/v1/gemini-proxy`;

const getAiProxyUrl = () => {
  const baseUrl = import.meta.env.BASE_URL || '/';
  return new URL('api/gemini', `${window.location.origin}${baseUrl}`).toString();
};

const rememberAiFailure = (statusCode: number, message: string) => {
  let nextReason: AiFeatureStatus['reason'] | null = null;
  let nextMessage = '';

  if (statusCode === 404 || /failed to fetch|networkerror|load failed|not found/iu.test(message)) {
    nextReason = 'proxy-missing';
    nextMessage = AI_PROXY_MISSING_MESSAGE;
  } else if (statusCode === 503 || /GEMINI_API_KEY|not configured on the server/iu.test(message)) {
    nextReason = 'missing-key';
    nextMessage = MISSING_AI_KEY_MESSAGE;
  } else if (statusCode === 403 || isBlockedGeminiError(message)) {
    nextReason = 'blocked-key';
    nextMessage = BLOCKED_AI_KEY_MESSAGE;
  }

  if (!nextReason) {
    return;
  }

  aiFailureReason = nextReason;
  if (aiUnavailableMessage !== nextMessage) {
    aiUnavailableMessage = nextMessage;
    console.warn(nextMessage);
  }
};

const clearAiFailure = () => {
  aiFailureReason = 'ready';
  aiUnavailableMessage = '';
};

const handleGeminiError = (label: string, error: unknown, statusCode = 0) => {
  rememberAiFailure(statusCode, extractGeminiErrorMessage(error));
  console.error(label, error);
};

const invokeGeminiText = async ({ model, contents, config }: GeminiProxyRequest) => {
  const targetUrl = useSupabaseEdgeFunction ? getSupabaseEdgeUrl() : getAiProxyUrl();

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(useSupabaseEdgeFunction
          ? {
              apikey: resolvedSupabaseAnonKey,
              Authorization: `Bearer ${resolvedSupabaseAnonKey}`,
            }
          : {}),
      },
      body: JSON.stringify({ model, contents, config }),
    });

    const payload = await response.json().catch(() => null) as { error?: string; text?: string } | null;
    if (!response.ok) {
      const message = typeof payload?.error === 'string'
        ? payload.error
        : `Gemini request failed with status ${response.status}.`;
      handleGeminiError(useSupabaseEdgeFunction ? 'Supabase Gemini Function Error:' : 'Gemini Proxy Error:', message, response.status);
      return null;
    }

    clearAiFailure();
    return typeof payload?.text === 'string' ? payload.text : null;
  } catch (error) {
    handleGeminiError(useSupabaseEdgeFunction ? 'Supabase Gemini Function Error:' : 'Gemini Proxy Error:', error);
    return null;
  }
};

export const getAiFeatureStatus = (): AiFeatureStatus => {
  if (aiFailureReason !== 'ready') {
    return {
      available: false,
      reason: aiFailureReason,
      message: aiUnavailableMessage,
    };
  }

  return {
    available: true,
    reason: 'ready',
    message: useSupabaseEdgeFunction ? 'AI features are available via Supabase.' : 'AI features are available.',
  };
};

export const getAiErrorMessage = (fallback = GENERIC_AI_ERROR_MESSAGE) => {
  const status = getAiFeatureStatus();
  return status.available ? fallback : status.message;
};

const canUseAi = () => getAiFeatureStatus().reason !== 'blocked-key';

export const expandIdea = async (ideaNote: string, title?: string): Promise<string> => {
  if (!canUseAi()) return getAiErrorMessage();

  try {
    const context = title ? `Title: ${title}\nNote: ${ideaNote}` : `Note: ${ideaNote}`;

    const text = await invokeGeminiText({
      model: 'gemini-2.5-flash',
      contents: `You are a helpful ministry assistant. Take the following ministry idea or thought and expand it into a brief outline for a sermon or detailed action plan. Keep it concise (under 200 words).
      
      ${context}`,
    });

    return text || "Could not generate content.";
  } catch (error) {
    handleGeminiError("Gemini API Error:", error);
    return getAiErrorMessage('Could not generate AI response right now.');
  }
};

export const explainStandingOrder = async (code: string, content: string): Promise<string> => {
  if (!canUseAi()) return getAiErrorMessage();

  try {
    const text = await invokeGeminiText({
      model: 'gemini-2.5-flash',
      contents: `Explain the following church standing order in simple terms for a layperson.
      
      Code: ${code}
      Content: "${content}"`,
    });

    return text || getAiErrorMessage('Could not generate explanation right now.');
  } catch (error) {
    handleGeminiError("Gemini API Error:", error);
    return getAiErrorMessage('Could not generate explanation right now.');
  }
};

export const getAiDailyVerse = async (): Promise<{ reference: string, text: string, keyword: string } | null> => {
  if (!canUseAi()) return null;

  const CACHE_KEY = 'ministry_daily_verse_cache';
  const todayKey = new Date().toISOString().split('T')[0];

  try {
    const cachedRaw = localStorage.getItem(CACHE_KEY);
    if (cachedRaw) {
      const cached = JSON.parse(cachedRaw);
      if (cached.date === todayKey && cached.verse) {
        return cached.verse;
      }
    }
  } catch (e) {
    console.warn("Error reading verse cache", e);
  }

  const todayDisplay = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  try {
    const text = await invokeGeminiText({
      model: 'gemini-2.5-flash',
      contents: `Generate a short, encouraging bible verse for a Methodist Minister for today (${todayDisplay}). 
      Return valid JSON with:
      1. "reference" (e.g. John 3:16)
      2. "text" (The verse text in NIV or NKJV)
      3. "keyword" (A single visual noun that represents the verse theme, e.g. "light", "mountain", "water", "sheep", "cross", "bread", "sky", "path")`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reference: { type: Type.STRING },
            text: { type: Type.STRING },
            keyword: { type: Type.STRING }
          },
          required: ['reference', 'text', 'keyword']
        }
      }
    });

    if (!text) return null;
    const verseData = JSON.parse(text);

    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        date: todayKey,
        verse: verseData
      }));
    } catch (storageErr) {
      console.warn("Failed to cache verse:", storageErr);
    }

    return verseData;
  } catch (e) {
    handleGeminiError("AI Verse Error:", e);
    return null;
  }
};

export interface DevotionalParams {
  topic?: string;
  date?: string;
  scripture?: string;
  theme?: string;
  season?: string;
  seasonId?: string;
  calendarTag?: string;
}

export interface DevotionalResponse {
  date: string;
  title: string;
  scripture: string;
  content: string;
  prayer: string;
  reflectionQuestion: string;
  seasonId?: string;
  calendarTag?: string;
}

export const generateDevotional = async (params: DevotionalParams | string): Promise<DevotionalResponse | null> => {
  if (!canUseAi()) {
    console.error(getAiErrorMessage());
    return null;
  }

  let context: any = {};
  if (typeof params === 'string') {
    context = {
      theme: params,
      date: new Date().toISOString().split('T')[0],
      seasonId: 'ORDINARY_TIME',
      calendarTag: 'Ordinary Day'
    };
  } else {
    context = { ...params };
    if (!context.theme && context.topic) {
      context.theme = context.topic;
    }
    if (!context.date) context.date = new Date().toISOString().split('T')[0];
    if (!context.seasonId) context.seasonId = 'ORDINARY_TIME';
  }

  const systemPrompt = `You are a Christian devotional writer for a ministry mobile app.
You will receive a JSON object with:

date (YYYY-MM-DD)
scripture (Bible verse reference, e.g. "Matthew 28:5-6")
theme (short phrase)
seasonId (e.g. LENT, HOLY_WEEK, EASTER, ADVENT, CHRISTMAS, ORDINARY_TIME)
calendarTag (e.g. "Ash Wednesday", "Good Friday", "Resurrection Sunday", "Ordinary Day").

Write a daily devotional suitable for display on a mobile phone.

Requirements:

Use the given scripture as the main text.
If calendarTag is a special day (Good Friday, Easter, Christmas, etc.), mention it in the content.
Main devotional content length: 120-200 words.
Include a short prayer (1-3 sentences).
Include one reflection question.
Tone: biblical, pastoral, encouraging, Jesus-centered.

Respond only in valid JSON with the following fields:

date
title
scripture
content
prayer
reflectionQuestion
seasonId
calendarTag`;

  try {
    const text = await invokeGeminiText({
      model: 'gemini-2.5-flash',
      contents: JSON.stringify(context),
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json'
      }
    });

    if (!text) return null;

    try {
      return JSON.parse(text) as DevotionalResponse;
    } catch {
      console.error("Failed to parse JSON response:", text);
      return null;
    }
  } catch (error) {
    handleGeminiError("Gemini API Error:", error);
    return null;
  }
};

export interface SermonAIResponse {
  title: string;
  main_scripture: string;
  theme: string;
  introduction: string;
  background_context: string;
  main_point_1: string;
  main_point_2: string;
  main_point_3: string;
  application_points: string[];
  gospel_connection: string;
  conclusion: string;
  prayer_points: string[];
  altar_call: string;
}

export type ServiceHymnAiPlan = Record<ServiceHymnSlot, ServiceHymnAiGuidance>;

export const generateServiceHymnGuidance = async (
  title: string,
  theme: string,
  scripture: string
): Promise<ServiceHymnAiPlan | null> => {
  if (!canUseAi()) {
    console.error(getAiErrorMessage());
    return null;
  }

  const prompt = `
    You are a Methodist worship planner for the Methodist Church Ghana.
    Suggest four hymn-selection guidance slots for a typical service built around a sermon.

    Context:
    Sermon Title: ${title}
    Theme: ${theme}
    Scripture Reading: ${scripture}

    Return JSON for exactly these four slots:
    1. opening: hymn of adoration and praise
    2. scripture: hymn before scripture reading
    3. sermon: hymn that reinforces the sermon theme
    4. closing: hymn of commitment, dedication, or sending forth

    For each slot return:
    - focus: one short sentence describing the worship purpose
    - keywords: 5 to 8 short search keywords or phrases that should help match hymns
    - rationale: one short sentence explaining why that slot fits the sermon context

    Keep keywords practical for hymn searching. Use Wesleyan/Methodist worship language where appropriate.
  `;

  try {
    const text = await invokeGeminiText({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            opening: {
              type: Type.OBJECT,
              properties: {
                focus: { type: Type.STRING },
                keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                rationale: { type: Type.STRING },
              },
              required: ['focus', 'keywords', 'rationale'],
            },
            scripture: {
              type: Type.OBJECT,
              properties: {
                focus: { type: Type.STRING },
                keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                rationale: { type: Type.STRING },
              },
              required: ['focus', 'keywords', 'rationale'],
            },
            sermon: {
              type: Type.OBJECT,
              properties: {
                focus: { type: Type.STRING },
                keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                rationale: { type: Type.STRING },
              },
              required: ['focus', 'keywords', 'rationale'],
            },
            closing: {
              type: Type.OBJECT,
              properties: {
                focus: { type: Type.STRING },
                keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                rationale: { type: Type.STRING },
              },
              required: ['focus', 'keywords', 'rationale'],
            },
          },
          required: ['opening', 'scripture', 'sermon', 'closing'],
        },
      },
    });

    if (!text) return null;
    return JSON.parse(text) as ServiceHymnAiPlan;
  } catch (error) {
    handleGeminiError('Service hymn guidance error:', error);
    return null;
  }
};

export const generateSermonOutline = async (title: string, theme: string, scripture: string): Promise<SermonAIResponse | null> => {
  if (!canUseAi()) {
    console.error(getAiErrorMessage());
    return null;
  }

  const prompt = `
    You are a Methodist Clergy Assistant for the Methodist Church Ghana, North America Diocese.
    Create a sermon following this specific 12-point structure.
    
    Inputs:
    Title Idea: ${title}
    Theme: ${theme}
    Scripture: ${scripture}

    Format Requirements:
    1. Title: Short, memorable phrase.
    2. Scripture Text: Confirm the primary passage.
    3. Introduction: Warm greeting, state the problem/question, introduce big idea.
    4. Background / Context: Who wrote it? To whom? Historical context.
    5. Main Point 1 (Explain): Break down verses, definitions.
    6. Main Point 2 (Apply): Connect to real-life struggles, stories.
    7. Main Point 3 (Transformation): Challenge/inspire action, God's power not ours.
    8. Practical Applications: 3-4 specific action steps.
    9. Gospel Connection: How Jesus fulfills this text.
    10. Conclusion: Summarize, reinforce big takeaway.
    11. Closing Prayer: Inviting transformation.
    12. Altar Call: Invitation to salvation or recommitment.

    Tone: Pastoral, Wesleyan, Biblical, Warm.
  `;

  try {
    const text = await invokeGeminiText({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            main_scripture: { type: Type.STRING },
            theme: { type: Type.STRING },
            introduction: { type: Type.STRING },
            background_context: { type: Type.STRING },
            main_point_1: { type: Type.STRING },
            main_point_2: { type: Type.STRING },
            main_point_3: { type: Type.STRING },
            application_points: { type: Type.ARRAY, items: { type: Type.STRING } },
            gospel_connection: { type: Type.STRING },
            conclusion: { type: Type.STRING },
            prayer_points: { type: Type.ARRAY, items: { type: Type.STRING } },
            altar_call: { type: Type.STRING },
          },
          required: [
            'title', 'main_scripture', 'theme', 'introduction', 'background_context',
            'main_point_1', 'main_point_2', 'main_point_3',
            'application_points', 'gospel_connection', 'conclusion', 'prayer_points', 'altar_call'
          ]
        }
      }
    });

    if (!text) return null;
    return JSON.parse(text) as SermonAIResponse;
  } catch (error) {
    handleGeminiError("Sermon Gen Error", error);
    return null;
  }
};

export const generateSermonSection = async (
  title: string,
  theme: string,
  scripture: string,
  sectionLabel: string,
  currentContent: string
): Promise<string | null> => {
  if (!canUseAi()) return getAiErrorMessage();

  let systemInstruction = '';

  if (currentContent && currentContent.length > 5) {
    systemInstruction = `
            You are a Methodist Minister's editor.
            The user has drafted a section for a sermon.
            
            Task:
            1. Polish the language to be more pastoral, theological, and warm.
            2. Expand on the thought to make it a complete paragraph or section.
            3. Ensure it aligns with Methodist doctrine (Grace, Holiness).
            
            Context:
            Sermon Title: ${title}
            Scripture: ${scripture}
            Section: ${sectionLabel}
            
            Original Draft: "${currentContent}"
            
            Return ONLY the improved text. Do not add meta-commentary.
        `;
  } else {
    systemInstruction = `
            You are a Methodist Minister assistant.
            Write the specific section '${sectionLabel}' for a sermon.
            
            Context:
            Title: ${title}
            Theme: ${theme}
            Scripture: ${scripture}
            
            Requirements:
            - Tone: Warm, Biblical, Encouraging.
            - Length: 100-150 words.
            - Focus directly on the scripture and title provided.
            
            Return ONLY the text for this section.
        `;
  }

  try {
    const text = await invokeGeminiText({
      model: 'gemini-2.5-flash',
      contents: systemInstruction,
    });
    return text || currentContent;
  } catch (error) {
    handleGeminiError("Section Gen Error", error);
    return null;
  }
};

export interface ReminderSuggestion {
  title: string;
  category: 'Sermon Preparation' | 'Visitation' | 'Counseling' | 'Prayer & Fasting' | 'Meeting' | 'Personal Devotion' | 'Other';
  frequency: 'One-time' | 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';
  start_date: string;
  notes: string;
}

export const suggestPastoralReminders = async (contextData: string): Promise<ReminderSuggestion[]> => {
  if (!canUseAi()) return [];

  const prompt = `
    You are a specialized pastoral assistant for a Methodist Minister.
    Analyze the following schedule and tasks summary.
    Suggest 3-5 specific, high-value pastoral reminders that might be missing or helpful.
    
    Focus on:
    1. Sermon Preparation (needs lead time before Sunday).
    2. Follow-ups for counseling or visitations mentioned in tasks.
    3. Spiritual discipline (Prayer & Fasting days).
    4. Personal devotion time.

    Current Context:
    ${contextData}

    Return a JSON array of objects with the following schema:
    {
       title: string,
       category: "Sermon Preparation" | "Visitation" | "Counseling" | "Prayer & Fasting" | "Meeting" | "Personal Devotion" | "Other",
       frequency: "One-time" | "Daily" | "Weekly" | "Monthly" | "Yearly",
       start_date: string (ISO date format YYYY-MM-DDTHH:MM),
       notes: string (brief explanation of why this is suggested)
    }
  `;

  try {
    const text = await invokeGeminiText({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              category: { type: Type.STRING },
              frequency: { type: Type.STRING },
              start_date: { type: Type.STRING },
              notes: { type: Type.STRING }
            },
            required: ['title', 'category', 'frequency', 'start_date', 'notes']
          }
        }
      }
    });

    if (!text) return [];
    return JSON.parse(text) as ReminderSuggestion[];
  } catch (error) {
    handleGeminiError("Reminder Suggestion Error", error);
    return [];
  }
};

export const assistMeetingMinutes = async (
  meetingTitle: string,
  meetingType: string,
  sectionName: string,
  currentText: string
): Promise<string> => {
  if (!canUseAi()) return "";

  const systemPrompt = `
    You are a secretary assistant for a Methodist Church meeting (e.g., Diocesan, Circuit, or Society level).
    
    Context:
    Meeting: ${meetingTitle}
    Type: ${meetingType}
    Section: ${sectionName}
    
    Current Draft Text: "${currentText}"
    
    Task:
    The user is writing minutes. Based on the context and any text they've already started, suggest 2-3 sentences or bullet points to complete or expand the thought.
    
    Tone: Professional, Clear, Respectful, Church-appropriate (Methodist terminology where applicable).
    
    Return ONLY the suggested addition text. Do not repeat the input.
  `;

  try {
    const text = await invokeGeminiText({
      model: 'gemini-2.5-flash',
      contents: systemPrompt,
    });
    return text || "";
  } catch (error) {
    handleGeminiError("Meeting Minute Assist Error", error);
    return "";
  }
};

export interface WesleySermonContent {
  title: string;
  sermonNumber: number;
  summary: string;
  keyPoints: string[];
  mainScripture: string;
  modernApplication: string;
}

export const getWesleySermonContent = async (
  sermonTitle: string,
  sermonNumber: number
): Promise<WesleySermonContent | null> => {
  if (!canUseAi()) return null;

  const CACHE_KEY = `wesley_sermon_${sermonNumber}`;
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch (_) {}

  try {
    const text = await invokeGeminiText({
      model: 'gemini-2.5-flash',
      contents: `You are a scholarly Methodist theologian. Provide detailed content for John Wesley's Sermon #${sermonNumber}: "${sermonTitle}".

Return valid JSON with:
- "title": the exact sermon title
- "sermonNumber": ${sermonNumber}
- "summary": A 3-4 sentence summary of the sermon's main argument and theological message
- "keyPoints": An array of 4-6 key theological points Wesley made in this sermon (each as a string)
- "mainScripture": The primary scripture text Wesley used
- "modernApplication": 2-3 sentences on how this sermon applies to the life of a minister today`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            sermonNumber: { type: Type.NUMBER },
            summary: { type: Type.STRING },
            keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            mainScripture: { type: Type.STRING },
            modernApplication: { type: Type.STRING },
          },
          required: ['title', 'sermonNumber', 'summary', 'keyPoints', 'mainScripture', 'modernApplication'],
        },
      },
    });

    const data: WesleySermonContent = JSON.parse(text || '{}');
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (_) {}
    return data;
  } catch (error) {
    handleGeminiError('Wesley sermon error:', error);
    return null;
  }
};

export interface WesleyQuote {
  quote: string;
  source: string;
  theme: string;
}

export const getWesleyQuotes = async (count = 5): Promise<WesleyQuote[]> => {
  if (!canUseAi()) return [];

  try {
    const text = await invokeGeminiText({
      model: 'gemini-2.5-flash',
      contents: `You are a Methodist scholar. Provide ${count} authentic, well-known quotes from John Wesley (1703-1791).

Return valid JSON - an array of objects, each with:
- "quote": the exact quotation
- "source": where it comes from (sermon name, letter, journal entry, etc.)
- "theme": one-word theme (e.g. "Holiness", "Grace", "Prayer", "Love", "Zeal", "Works", "Faith")`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              quote: { type: Type.STRING },
              source: { type: Type.STRING },
              theme: { type: Type.STRING },
            },
            required: ['quote', 'source', 'theme'],
          },
        },
      },
    });

    return JSON.parse(text || '[]');
  } catch (error) {
    handleGeminiError('Wesley quotes error:', error);
    return [];
  }
};