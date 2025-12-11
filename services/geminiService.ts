
import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.API_KEY || ''; 

// Initialize Gemini
let ai: GoogleGenAI | null = null;
if (apiKey) {
    ai = new GoogleGenAI({ apiKey: apiKey });
}

export const expandIdea = async (ideaNote: string): Promise<string> => {
  if (!ai) return "API Key not configured.";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are a helpful ministry assistant. Take the following ministry idea or thought and expand it into a brief outline for a sermon or detailed action plan. Keep it concise (under 200 words).
      
      Idea: "${ideaNote}"`,
    });
    
    return response.text || "Could not generate content.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error generating AI response.";
  }
};

export const explainStandingOrder = async (code: string, content: string): Promise<string> => {
    if (!ai) return "API Key not configured.";
  
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Explain the following church standing order in simple terms for a layperson.
        
        Code: ${code}
        Content: "${content}"`,
      });
      
      return response.text || "Could not generate explanation.";
    } catch (error) {
      console.error("Gemini API Error:", error);
      return "Error generating AI response.";
    }
  };

export const getAiDailyVerse = async (): Promise<{reference: string, text: string, keyword: string} | null> => {
  if (!ai) return null;
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Generate a short, encouraging bible verse for a Methodist Minister for today (${today}). 
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
    
    const text = response.text;
    if (!text) return null;
    return JSON.parse(text);
  } catch (e) {
    console.error("AI Verse Error:", e);
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
    if (!ai) {
        console.error("API Key not configured");
        return null;
    }
  
    // Prepare structured context
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
        // Map 'topic' to 'theme' if theme is missing (for custom input compatibility)
        if (!context.theme && context.topic) {
            context.theme = context.topic;
        }
        // Defaults
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
Main devotional content length: 120–200 words.
Include a short prayer (1–3 sentences).
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
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: JSON.stringify(context),
        config: {
            systemInstruction: systemPrompt,
            responseMimeType: 'application/json'
        }
      });
      
      const text = response.text;
      if (!text) return null;

      try {
          return JSON.parse(text) as DevotionalResponse;
      } catch (parseError) {
          console.error("Failed to parse JSON response:", text);
          return null;
      }
    } catch (error) {
      console.error("Gemini API Error:", error);
      return null;
    }
  };

// --- Sermon Builder Service ---

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

export const generateSermonOutline = async (title: string, theme: string, scripture: string): Promise<SermonAIResponse | null> => {
  if (!ai) {
      console.error("API Key missing");
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
    const response = await ai.models.generateContent({
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

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text) as SermonAIResponse;
  } catch (error) {
    console.error("Sermon Gen Error", error);
    return null;
  }
};

/**
 * Generates or Polishes a single section of the sermon.
 */
export const generateSermonSection = async (
    title: string, 
    theme: string, 
    scripture: string, 
    sectionLabel: string, 
    currentContent: string
): Promise<string | null> => {
    if (!ai) return null;

    let systemInstruction = '';
    
    if (currentContent && currentContent.length > 5) {
        // Mode: Polish and Expand
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
        // Mode: Generate from Scratch
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
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: systemInstruction, // Using the instruction as the prompt content for simplicity in single-turn
        });
        return response.text || currentContent;
    } catch (error) {
        console.error("Section Gen Error", error);
        return null;
    }
}

// --- NEW: Pastoral Reminder Suggestions ---

export interface ReminderSuggestion {
  title: string;
  category: 'Sermon Preparation' | 'Visitation' | 'Counseling' | 'Prayer & Fasting' | 'Meeting' | 'Personal Devotion' | 'Other';
  frequency: 'One-time' | 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';
  start_date: string;
  notes: string;
}

export const suggestPastoralReminders = async (contextData: string): Promise<ReminderSuggestion[]> => {
  if (!ai) return [];

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
    const response = await ai.models.generateContent({
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

    const text = response.text;
    if (!text) return [];
    return JSON.parse(text) as ReminderSuggestion[];
  } catch (error) {
    console.error("Reminder Suggestion Error", error);
    return [];
  }
};
