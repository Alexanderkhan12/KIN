
import { GoogleGenAI, Type } from "@google/genai";
import { FolderType, AIAnalysisResult } from "../types";

export const analyzeDocument = async (fileName: string): Promise<AIAnalysisResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Suggest the correct accounting folder for this file: "${fileName}".
      Folders available:
      - invoices (Счета, Спецификации)
      - waybills (Накладные, ТТН, УПД)
      - contracts (Договоры, Соглашения)
      - taxes (Налоги, Декларации)
      - misc (Прочее)
      
      Output JSON only.`,
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
              description: "A short reason in Russian why this folder was chosen.",
            },
          },
          required: ["suggestedFolder", "reasoning"],
        },
      },
    });

    const result = JSON.parse(response.text) as AIAnalysisResult;
    return result;
  } catch (error) {
    console.error("AI Analysis failed", error);
    return {
      suggestedFolder: 'misc',
      reasoning: 'Ошибка анализа, выбрана папка по умолчанию.'
    };
  }
};
