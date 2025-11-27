
import { GoogleGenAI, Type } from '@google/genai';
import { DEFAULT_LEVEL } from '../constants';
import { LevelData } from '../types';

export interface GenerationParams {
  theme: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  length: 'Short' | 'Medium' | 'Long';
  enemyDensity: 'Low' | 'Medium' | 'High';
}

export const generateLevel = async (params: GenerationParams): Promise<LevelData> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("No API Key found, returning default level.");
    return DEFAULT_LEVEL;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    // Derive constraints from params
    let worldWidth = 3000;
    if (params.length === 'Medium') worldWidth = 6000;
    if (params.length === 'Long') worldWidth = 12000;

    const enemyPrompt = params.enemyDensity === 'High' ? "Lots of enemies." : 
                       params.enemyDensity === 'Medium' ? "Moderate amount of enemies." : "Very few enemies.";
    
    const difficultyPrompt = params.difficulty === 'Hard' ? "Challenging jumps, smaller platforms, more gaps." : 
                            params.difficulty === 'Medium' ? "Balanced platforming." : "Large platforms, easy jumps, safe falls.";

    const systemPrompt = `
      Create a 2D platformer level layout.
      Theme: "${params.theme}".
      Total World Width: 0 to ${worldWidth} pixels.
      Difficulty: ${params.difficulty} (${difficultyPrompt}).
      Enemies: ${enemyPrompt}
      
      Important Rules:
      1. Ground Generation: DO NOT create a single flat floor. Create "Uneven Ground" by placing wide platforms at varying heights (y=500 to y=580) to form the floor terrain. Ensure there is a safe path.
      2. Player Start: The player starts at x=100, y=400. Ensure there is ground below them.
      3. Goal: Place a 'goal' near x=${worldWidth - 200}. It MUST be on a ground platform (approx y=550).
      4. Platforms: Max jump height is ~150px.
      5. Tennis Ball: Place exactly ONE 'tennisBall' (extra life) in a hard-to-reach spot (high platform or hidden area).
      6. Enemies: You can place 'cat' (walking), 'rat' (walking fast), 'bat' (flying), or 'squirrel' (stationary catapult).
      7. Return valid JSON.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: systemPrompt,
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
                  type: { type: Type.STRING, enum: ["cat", "bat", "squirrel", "rat"] }
                },
                required: ["x", "y", "type"]
              }
            },
            obstacles: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                    x: { type: Type.NUMBER },
                    y: { type: Type.NUMBER },
                    type: { type: Type.STRING, enum: ["spike"] }
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
            },
            tennisBalls: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  x: { type: Type.NUMBER },
                  y: { type: Type.NUMBER }
                },
                required: ["x", "y"]
              }
            },
            goal: {
                type: Type.OBJECT,
                properties: {
                    x: { type: Type.NUMBER },
                    y: { type: Type.NUMBER }
                },
                required: ["x", "y"]
            }
          },
          required: ["themeName", "backgroundColor", "groundColor", "platforms", "enemies", "obstacles", "collectibles", "tennisBalls", "goal"]
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
