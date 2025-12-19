
import { GoogleGenAI, Type } from "@google/genai";
// Fix: Updated import path to correctly reference types and include AIAnalysisResult
import { FolderType, AIAnalysisResult } from "../types";

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
    // Fix: Initializing GoogleGenAI with named parameter as required
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Файл: "${fileName}". 
    Определи папку:
    - invoices (Счета, Спецификации)
    - waybills (Накладные, УПД)
    - contracts (Договоры)
    - taxes (Налоги, Отчеты)
    - misc (Прочее)`;

    // Fix: Using generateContent with correct model name and responseSchema
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestedFolder: { 
              type: Type.STRING,
              description: 'The slug of the suggested folder (invoices, waybills, contracts, taxes, or misc).'
            },
            reasoning: { 
              type: Type.STRING,
              description: 'Brief explanation for why this folder was chosen.'
            },
          },
          propertyOrdering: ["suggestedFolder", "reasoning"],
        },
      },
    });

    // Fix: Access response.text property directly (not as a method)
    const resultText = response.text;
    if (!resultText) {
      return fallbackAnalysis(fileName);
    }
    
    return JSON.parse(resultText) as AIAnalysisResult;
  } catch (error) {
    console.error("AI Error:", error);
    return fallbackAnalysis(fileName);
  }
};

const fallbackAnalysis = (fileName: string): AIAnalysisResult => {
  const name = fileName.toLowerCase();
  // Fix: Improved local rules to cover more folder types
  if (name.includes('счет') || name.includes('inv')) return { suggestedFolder: 'invoices', reasoning: 'Найдено ключевое слово "Счет"' };
  if (name.includes('накл') || name.includes('упд')) return { suggestedFolder: 'waybills', reasoning: 'Найдено ключевое слово "Накладная"' };
  if (name.includes('договор')) return { suggestedFolder: 'contracts', reasoning: 'Найдено ключевое слово "Договор"' };
  if (name.includes('налог') || name.includes('фнс') || name.includes('отчет')) return { suggestedFolder: 'taxes', reasoning: 'Найдено ключевое слово "Налог/Отчет"' };
  return { suggestedFolder: 'misc', reasoning: 'Папка по умолчанию' };
};
