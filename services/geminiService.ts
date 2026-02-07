
import { GoogleGenAI } from "@google/genai";

/**
 * Analyzes the content of an image using Gemini AI.
 * Follows the latest @google/genai SDK guidelines.
 */
export const analyzeImageContent = async (base64Image: string, mimeType: string): Promise<string> => {
  try {
    // Always use process.env.API_KEY directly for initialization
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const imagePart = {
      inlineData: {
        mimeType: mimeType,
        data: base64Image.split(',')[1], // Remove the data:image/... prefix
      },
    };
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { 
        parts: [
          imagePart, 
          { text: "Hãy mô tả nội dung của trang PDF này bằng tiếng Việt một cách súc tích. Tập trung vào các tiêu đề chính, biểu đồ hoặc nội dung quan trọng nhất." }
        ] 
      },
    });

    // Directly access the .text property of GenerateContentResponse
    return response.text || "Không thể phân tích nội dung.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Lỗi khi kết nối với AI. Vui lòng thử lại sau.";
  }
};