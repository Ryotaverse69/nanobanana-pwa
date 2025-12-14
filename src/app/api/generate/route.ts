import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const googleAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

export async function POST(request: NextRequest) {
  try {
    const { prompt, inputImageBase64 } = await request.json();

    const model = googleAI.getGenerativeModel({
      model: 'models/gemini-3-pro-image-preview',
      generationConfig: {
        responseModalities: ['Text', 'Image']
      }
    });

    let contents;
    if (inputImageBase64) {
      contents = [
        {
          inlineData: {
            mimeType: 'image/png',
            data: inputImageBase64
          }
        },
        { text: `${prompt}. Aspect ratio: 16:9. Do NOT add any watermarks, logos, or branding to the image. No visible watermarks in any corner.` }
      ];
    } else {
      contents = `Generate an image: ${prompt}. Aspect ratio: 16:9. Do NOT add any watermarks, logos, or branding to the image. No visible watermarks in any corner.`;
    }

    const response = await model.generateContent({
      contents: [{ role: 'user', parts: typeof contents === 'string' ? [{ text: contents }] : contents }],
      generationConfig: {
        responseModalities: ['Text', 'Image']
      }
    });
    const result = response.response;

    let imageData = null;
    for (const part of result.candidates![0].content.parts) {
      if (part.inlineData && part.inlineData.mimeType?.startsWith('image/')) {
        imageData = part.inlineData.data;
        break;
      }
    }

    if (imageData) {
      return NextResponse.json({
        success: true,
        imageBase64: imageData
      });
    } else {
      throw new Error('画像が生成されませんでした');
    }
  } catch (error: unknown) {
    console.error('画像生成エラー:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '不明なエラー'
    }, { status: 500 });
  }
}
