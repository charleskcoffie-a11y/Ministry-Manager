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