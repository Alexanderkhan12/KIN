
import { GoogleGenAI, Type } from "@google/genai";
import { FolderType, AIAnalysisResult } from "../types";

export const analyzeDocument = async (fileName: string): Promise<AIAnalysisResult> => {
  // Guard against empty input
  if (!fileName || fileName.trim() === "") {
    return { suggestedFolder: 'misc', reasoning: 'Имя файла не определено.' };
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const prompt = `У тебя есть файл с названием: "${fileName}". 
    Определи, в какую папку бухгалтерии его лучше положить.
    Доступные папки:
    - invoices (Счета, Спецификации, Инвойсы)
    - waybills (Накладные, ТОРГ-12, ТТН, УПД)
    - contracts (Договоры, Соглашения, Контракты)
    - taxes (Налоги, Декларации, Сверки, Отчеты в налоговую)
    - misc (Все остальное)
    
    Верни строго JSON.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      // Using the most explicit part structure to avoid any SDK auto-detection issues
      contents: [{ 
        parts: [{ text: prompt }] 
      }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestedFolder: {
              type: Type.STRING,
              description: "Must be one of: invoices, waybills, contracts, taxes, misc",
            },
            reasoning: {
              type: Type.STRING,
              description: "Краткая причина выбора на русском языке.",
            },
          },
          required: ["suggestedFolder", "reasoning"],
        },
      },
    });

    if (!response.text) {
      throw new Error("Empty response from AI");
    }

    const result = JSON.parse(response.text) as AIAnalysisResult;
    return result;
  } catch (error: any) {
    console.error("AI Analysis failed:", error);
    
    // Check if it's the specific mime type error to provide a clearer log
    if (error.message?.includes('mime_type') || error.message?.includes('mime type')) {
      console.warn("Mime type error detected. Falling back to basic categorization.");
    }

    // Default fallback logic based on simple keyword matching if AI fails
    const lowerName = fileName.toLowerCase();
    if (lowerName.includes('счет') || lowerName.includes('invoice')) return { suggestedFolder: 'invoices', reasoning: 'Авто-определение по названию (Счет).' };
    if (lowerName.includes('упд') || lowerName.includes('накл')) return { suggestedFolder: 'waybills', reasoning: 'Авто-определение по названию (Накладная).' };
    if (lowerName.includes('договор') || lowerName.includes('contract')) return { suggestedFolder: 'contracts', reasoning: 'Авто-определение по названию (Договор).' };
    
    return {
      suggestedFolder: 'misc',
      reasoning: 'Ошибка анализа (MIME/API), выбрана папка по умолчанию.'
    };
  }
};
