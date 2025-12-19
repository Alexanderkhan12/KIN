
import { GoogleGenAI, Type } from "@google/genai";
import { FolderType, AIAnalysisResult } from "../types.ts";

export const analyzeDocument = async (fileName: string): Promise<AIAnalysisResult> => {
  if (!fileName || fileName.trim() === "") {
    return { suggestedFolder: 'misc', reasoning: 'Имя файла не определено.' };
  }

  // Ensure API Key exists
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API_KEY missing, using local rules.");
    return fallbackAnalysis(fileName);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Файл: "${fileName}". 
    Определи папку:
    - invoices (Счета, Спецификации)
    - waybills (Накладные, УПД)
    - contracts (Договоры)
    - taxes (Налоги, Отчеты)
    - misc (Прочее)`;

    // Fix: Using string directly for contents as it is a text-only prompt
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestedFolder: { type: Type.STRING },
            reasoning: { type: Type.STRING },
          },
          required: ["suggestedFolder", "reasoning"],
        },
      },
    });

    // Fix: Access response.text property directly
    return JSON.parse(response.text || "{}") as AIAnalysisResult;
  } catch (error) {
    console.error("AI Error:", error);
    return fallbackAnalysis(fileName);
  }
};

const fallbackAnalysis = (fileName: string): AIAnalysisResult => {
  const name = fileName.toLowerCase();
  if (name.includes('счет') || name.includes('inv')) return { suggestedFolder: 'invoices', reasoning: 'Найдено ключевое слово "Счет"' };
  if (name.includes('накл') || name.includes('упд')) return { suggestedFolder: 'waybills', reasoning: 'Найдено ключевое слово "Накладная"' };
  if (name.includes('договор')) return { suggestedFolder: 'contracts', reasoning: 'Найдено ключевое слово "Договор"' };
  return { suggestedFolder: 'misc', reasoning: 'Папка по умолчанию' };
};
