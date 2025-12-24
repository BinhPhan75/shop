
import { GoogleGenAI, Type } from "@google/genai";
import { Product, ScanResult } from "./types";

export const searchProductByImage = async (
  base64Image: string,
  existingProducts: Product[]
): Promise<ScanResult> => {
  // Khởi tạo AI với API Key từ môi trường
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const context = existingProducts.map(p => ({
    id: p.id,
    name: p.name,
    price: p.sellingPrice
  }));

  const prompt = `
    Nhiệm vụ: Nhận diện sản phẩm từ hình ảnh.
    Dữ liệu kho: ${JSON.stringify(context)}
    
    Yêu cầu:
    1. Tìm tên sản phẩm, nhãn hiệu trong ảnh.
    2. So khớp với dữ liệu kho. Nếu khớp > 80%, trả về productId.
    3. Nếu không có trong kho, hãy gợi ý tên sản phẩm dựa trên hình ảnh.
    
    Trả về JSON: { "productId": string|null, "confidence": number, "suggestedName": string, "description": string }
  `;

  try {
    const imageData = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

    // Sử dụng gemini-flash-latest để có hạn mức RPD cao nhất (thường là 1500+ RPD ở bản free/paid)
    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { mimeType: 'image/jpeg', data: imageData } }
        ]
      }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            productId: { type: Type.STRING, description: "ID sản phẩm từ kho hoặc null" },
            confidence: { type: Type.NUMBER, description: "Độ tin cậy" },
            suggestedName: { type: Type.STRING, description: "Tên gợi ý" },
            description: { type: Type.STRING, description: "Giải thích" }
          },
          required: ["productId", "confidence"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) throw new Error("Không có phản hồi từ AI");

    return JSON.parse(resultText);
  } catch (error: any) {
    console.error("Gemini AI Error:", error);
    if (error.message?.includes("429")) {
      throw new Error("Hạn mức API đã hết. Vui lòng thử lại sau.");
    }
    throw error;
  }
};
