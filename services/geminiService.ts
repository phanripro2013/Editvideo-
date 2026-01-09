
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeVideoContent = async (imageNames: string[], audioName: string) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `I have these images: ${imageNames.join(', ')} and this audio: ${audioName}. Suggest a catchy title, a short description for TikTok/YouTube, and a recommended transition style (fade, slide, zoom).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            recommendedTransition: { type: Type.STRING },
            vibe: { type: Type.STRING }
          },
          required: ["title", "description", "recommendedTransition", "vibe"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return null;
  }
};
