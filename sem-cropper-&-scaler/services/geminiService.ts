import { GoogleGenAI, Type } from "@google/genai";
import { SemAnalysisResult } from '../types';

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const analyzeSemImage = async (base64Image: string): Promise<SemAnalysisResult> => {
  // Remove header if present
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png', // Assuming PNG or JPEG, API handles detection usually
              data: base64Data
            }
          },
          {
            text: `Analyze this SEM (Scanning Electron Microscope) image. 
            1. Identify the Y-coordinate (in pixels from the top) where the main image content ends and the information bar/footer (containing metadata and old scale bars) begins. This is the crop line.
            2. Attempt to read the text of the scale bar in the footer (e.g., "10 µm", "200 nm").
            
            Return the data in JSON format.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestedCropY: { type: Type.INTEGER, description: "The Y coordinate where the footer starts" },
            detectedScaleText: { type: Type.STRING, description: "The text read from the existing scale bar" }
          },
          required: ["suggestedCropY"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text) as SemAnalysisResult;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    // Fallback default
    return { suggestedCropY: 0 };
  }
};