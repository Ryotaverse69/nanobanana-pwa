import { NextRequest, NextResponse } from 'next/server';
import { TwitterApi } from 'twitter-api-v2';

const twitterClient = new TwitterApi({
  appKey: process.env.X_API_KEY!,
  appSecret: process.env.X_API_KEY_SECRET!,
  accessToken: process.env.X_ACCESS_TOKEN!,
  accessSecret: process.env.X_ACCESS_TOKEN_SECRET!,
});

export async function POST(request: NextRequest) {
  try {
    const { imageBase64, text } = await request.json();

    // Base64をBufferに変換
    const imageBuffer = Buffer.from(imageBase64, 'base64');

    // 画像をアップロード
    const mediaId = await twitterClient.v1.uploadMedia(imageBuffer, { mimeType: 'image/png' });

    // ツイートを投稿
    const tweet = await twitterClient.v2.tweet({
      text: text,
      media: {
        media_ids: [mediaId]
      }
    });

    return NextResponse.json({
      success: true,
      tweetId: tweet.data.id
    });
  } catch (error: unknown) {
    console.error('X投稿エラー:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '不明なエラー'
    }, { status: 500 });
  }
}
