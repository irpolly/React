import { GoogleGenAI, Type } from '@google/genai';
import { DEFAULT_LEVEL } from '../constants';
import { LevelData } from '../types';

export const generateLevel = async (theme: string): Promise<LevelData> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("No API Key found, returning default level.");
    return DEFAULT_LEVEL;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Create a 2D platformer level layout with the theme: "${theme}". 
      The level should have coordinate-based platforms, enemies, and collectibles.
      The world coordinates typically range from x: 0 to 2000, and y: 0 to 600 (where 600 is bottom).
      Ground level is roughly y=500.
      Platforms should be reachable by jumping.
      
      Return valid JSON matching the schema.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            themeName: { type: Type.STRING },
            backgroundColor: { type: Type.STRING, description: "Hex color code for sky" },
            groundColor: { type: Type.STRING, description: "Hex color code for ground" },
            platforms: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  x: { type: Type.NUMBER },
                  y: { type: Type.NUMBER },
                  width: { type: Type.NUMBER },
                  type: { type: Type.STRING, enum: ["grass", "stone", "cloud", "lava"] }
                },
                required: ["x", "y", "width", "type"]
              }
            },
            enemies: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  x: { type: Type.NUMBER },
                  y: { type: Type.NUMBER },
                  type: { type: Type.STRING, enum: ["cat", "bat"] }
                },
                required: ["x", "y", "type"]
              }
            },
            collectibles: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  x: { type: Type.NUMBER },
                  y: { type: Type.NUMBER }
                },
                required: ["x", "y"]
              }
            }
          },
          required: ["themeName", "backgroundColor", "groundColor", "platforms", "enemies", "collectibles"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from Gemini");
    
    return JSON.parse(text) as LevelData;

  } catch (error) {
    console.error("Failed to generate level:", error);
    return DEFAULT_LEVEL;
  }
};