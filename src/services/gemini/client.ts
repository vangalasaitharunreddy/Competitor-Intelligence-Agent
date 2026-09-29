import { GoogleGenAI, Type } from '@google/genai';

export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

let geminiClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

export async function testGeminiConnection(): Promise<{
  connected: boolean;
  model: string;
  latencyMs?: number;
  error?: string;
}> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      connected: false,
      model: GEMINI_MODEL,
      error: 'GEMINI_API_KEY is not configured in server environment secrets.',
    };
  }

  const ai = getGeminiClient();
  if (!ai) {
    return {
      connected: false,
      model: GEMINI_MODEL,
      error: 'Failed to instantiate Gemini client.',
    };
  }

  const start = Date.now();
  let lastErr = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: 'Respond with exactly: {"status":"healthy"}',
        config: {
          responseMimeType: 'application/json',
          abortSignal: AbortSignal.timeout(10000),
        },
      });

      const latencyMs = Date.now() - start;
      if (response && response.text) {
        return {
          connected: true,
          model: GEMINI_MODEL,
          latencyMs,
        };
      } else {
        return {
          connected: false,
          model: GEMINI_MODEL,
          error: 'Gemini responded with empty output.',
        };
      }
    } catch (err: any) {
      lastErr = err.message;
      if (attempt === 0 && (err.message.includes('503') || err.message.includes('demand'))) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      break;
    }
  }

  return {
    connected: false,
    model: GEMINI_MODEL,
    error: `Gemini API test failed: ${lastErr}`,
  };
}
