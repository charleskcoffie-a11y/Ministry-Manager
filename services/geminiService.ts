import { GoogleGenAI } from "@google/genai";

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