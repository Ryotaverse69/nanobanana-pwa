import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const googleAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

export async function POST(request: NextRequest) {
  try {
    // 認証チェック
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });
    }

    const { prompt, inputImages, aspectRatio } = await request.json();

    // アスペクト比の指示を作成
    let aspectInstruction = '';
    if (aspectRatio === 'auto' && inputImages && inputImages.length > 0) {
      aspectInstruction = 'Match the aspect ratio of the first input image.';
    } else if (aspectRatio === 'auto') {
      aspectInstruction = 'Aspect ratio: 16:9.';
    } else {
      aspectInstruction = `Aspect ratio: ${aspectRatio}.`;
    }

    const model = googleAI.getGenerativeModel({
      model: 'models/gemini-3-pro-image-preview',
      generationConfig: {
        // @ts-ignore - responseModalities is valid for image generation models
        responseModalities: ['Text', 'Image']
      }
    });

    // コンテンツを構築
    const parts: Array<{ inlineData: { mimeType: string; data: string } } | { text: string }> = [];

    // 複数画像がある場合、すべて追加
    if (inputImages && inputImages.length > 0) {
      for (const imageBase64 of inputImages) {
        parts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: imageBase64
          }
        });
      }
      parts.push({
        text: `${prompt}. ${aspectInstruction} Do NOT add any watermarks, logos, or branding to the image. No visible watermarks in any corner.`
      });
    } else {
      parts.push({
        text: `Generate an image: ${prompt}. ${aspectInstruction} Do NOT add any watermarks, logos, or branding to the image. No visible watermarks in any corner.`
      });
    }

    const response = await model.generateContent({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        // @ts-ignore - responseModalities is valid for image generation models
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
