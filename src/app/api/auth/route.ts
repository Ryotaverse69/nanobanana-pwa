import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();
    const correctPassword = process.env.APP_PASSWORD;

    if (!correctPassword) {
      return NextResponse.json({
        success: false,
        error: 'サーバー設定エラー: パスワードが設定されていません'
      }, { status: 500 });
    }

    if (password === correctPassword) {
      // シンプルなトークンを生成（セッション識別用）
      const token = crypto.randomBytes(32).toString('hex');

      return NextResponse.json({
        success: true,
        token
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'パスワードが間違っています'
      }, { status: 401 });
    }
  } catch (error: unknown) {
    console.error('認証エラー:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '不明なエラー'
    }, { status: 500 });
  }
}
