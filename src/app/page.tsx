'use client';

import { useState, useEffect, useCallback } from 'react';

interface HistoryImage {
  id: string;
  base64: string;
  createdAt: number;
}

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [uploadedImageBase64, setUploadedImageBase64] = useState<string | null>(null);
  const [generatedImageBase64, setGeneratedImageBase64] = useState<string | null>(null);
  const [tweetText, setTweetText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [generateStatus, setGenerateStatus] = useState<{ type: string; message: string } | null>(null);
  const [postStatus, setPostStatus] = useState<{ type: string; message: string } | null>(null);
  const [history, setHistory] = useState<HistoryImage[]>([]);
  const [aspectRatio, setAspectRatio] = useState<string>('16:9');

  // 認証関連
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // 認証状態をチェック
  useEffect(() => {
    try {
      const savedAuth = localStorage.getItem('nanobanana_auth');
      if (savedAuth) {
        setIsAuthenticated(true);
      }
    } catch (e) {
      console.error('認証チェックエラー:', e);
    }
    setIsCheckingAuth(false);
  }, []);

  // ログイン処理
  const handleLogin = async () => {
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const result = await res.json();

      if (result.success) {
        setIsAuthenticated(true);
        setAuthError('');
        try {
          localStorage.setItem('nanobanana_auth', result.token);
        } catch (e) {
          console.error('認証保存エラー:', e);
        }
      } else {
        setAuthError('パスワードが間違っています');
      }
    } catch (error) {
      setAuthError('認証エラーが発生しました');
      console.error('認証エラー:', error);
    }
  };

  // ログアウト処理
  const handleLogout = () => {
    setIsAuthenticated(false);
    try {
      localStorage.removeItem('nanobanana_auth');
    } catch (e) {
      console.error('ログアウトエラー:', e);
    }
  };

  // 履歴をlocalStorageから読み込み
  useEffect(() => {
    try {
      const saved = localStorage.getItem('uploadHistory');
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch (e) {
      console.error('履歴の読み込みエラー:', e);
    }
  }, []);

  // 履歴を保存
  const saveToHistory = useCallback((base64: string) => {
    try {
      const newImage: HistoryImage = {
        id: Date.now().toString(),
        base64,
        createdAt: Date.now()
      };
      setHistory(prev => {
        const newHistory = [newImage, ...prev].slice(0, 10); // iPhoneのストレージ制限のため10件に制限
        try {
          localStorage.setItem('uploadHistory', JSON.stringify(newHistory));
        } catch (e) {
          console.error('履歴の保存エラー:', e);
          // ストレージがいっぱいの場合、古い履歴を削除して再試行
          const reducedHistory = newHistory.slice(0, 5);
          try {
            localStorage.setItem('uploadHistory', JSON.stringify(reducedHistory));
          } catch {
            localStorage.removeItem('uploadHistory');
          }
        }
        return newHistory;
      });
    } catch (e) {
      console.error('履歴保存エラー:', e);
    }
  }, []);

  // 履歴から削除
  const deleteFromHistory = (id: string) => {
    setHistory(prev => {
      const newHistory = prev.filter(img => img.id !== id);
      try {
        localStorage.setItem('uploadHistory', JSON.stringify(newHistory));
      } catch (e) {
        console.error('履歴削除エラー:', e);
      }
      return newHistory;
    });
  };

  // 画像を圧縮する関数
  const compressImage = (file: File, maxSize: number = 800): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            // 最大サイズを超える場合はリサイズ
            if (width > maxSize || height > maxSize) {
              if (width > height) {
                height = (height / width) * maxSize;
                width = maxSize;
              } else {
                width = (width / height) * maxSize;
                height = maxSize;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);

            // JPEG形式で圧縮（品質0.7）
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
            resolve(compressedBase64);
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // 画像アップロード
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        // 履歴用に圧縮した画像
        const compressedBase64 = await compressImage(file, 400);

        // API用にオリジナルサイズ（ただし最大1200px）の画像
        const apiBase64 = await compressImage(file, 1200);

        setUploadedImageBase64(apiBase64);
        saveToHistory(compressedBase64);
      } catch (err) {
        console.error('画像処理エラー:', err);
        // フォールバック: 圧縮なしで読み込み
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = (event.target?.result as string).split(',')[1];
          setUploadedImageBase64(base64);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  // 履歴から選択
  const selectFromHistory = (base64: string) => {
    setUploadedImageBase64(base64);
  };

  // 画像クリア
  const clearImage = () => {
    setUploadedImageBase64(null);
  };

  // 画像生成
  const generateImage = async () => {
    if (!prompt.trim()) {
      setGenerateStatus({ type: 'error', message: 'プロンプトを入力してください' });
      return;
    }

    setIsGenerating(true);
    setGenerateStatus({ type: 'loading', message: '画像を生成中... (30秒〜1分かかる場合があります)' });
    setGeneratedImageBase64(null);

    try {
      const token = localStorage.getItem('nanobanana_auth') || '';
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ prompt, inputImageBase64: uploadedImageBase64, aspectRatio })
      });
      const result = await res.json();

      if (result.success) {
        setGeneratedImageBase64(result.imageBase64);
        setGenerateStatus({ type: 'success', message: '画像を生成しました！' });
      } else {
        setGenerateStatus({ type: 'error', message: `エラー: ${result.error}` });
      }
    } catch (error) {
      setGenerateStatus({ type: 'error', message: `エラー: ${error}` });
    }

    setIsGenerating(false);
  };

  // X投稿
  const postToX = async () => {
    if (!tweetText.trim()) {
      setPostStatus({ type: 'error', message: '投稿テキストを入力してください' });
      return;
    }

    if (!generatedImageBase64) {
      setPostStatus({ type: 'error', message: '先に画像を生成してください' });
      return;
    }

    setIsPosting(true);
    setPostStatus({ type: 'loading', message: '投稿中...' });

    try {
      const token = localStorage.getItem('nanobanana_auth') || '';
      const res = await fetch('/api/post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ imageBase64: generatedImageBase64, text: tweetText })
      });
      const result = await res.json();

      if (result.success) {
        setPostStatus({ type: 'success', message: `投稿しました！ Tweet ID: ${result.tweetId}` });
      } else {
        setPostStatus({ type: 'error', message: `エラー: ${result.error}` });
      }
    } catch (error) {
      setPostStatus({ type: 'error', message: `エラー: ${error}` });
    }

    setIsPosting(false);
  };

  // ローディング中
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#16213e] text-white flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  // 未認証の場合はログイン画面
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#16213e] text-white flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/10 w-full max-w-md">
          <h1 className="text-3xl font-bold text-center mb-8 bg-gradient-to-r from-yellow-400 to-red-500 bg-clip-text text-transparent">
            NanoBanana
          </h1>
          <div className="mb-4">
            <label className="block mb-2 font-medium">パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              placeholder="パスワードを入力"
              className="w-full p-3 rounded-lg bg-white/15 text-white placeholder-white/50 border-none outline-none focus:ring-2 focus:ring-yellow-400"
            />
          </div>
          {authError && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500 text-red-300">
              {authError}
            </div>
          )}
          <button
            onClick={handleLogin}
            className="w-full bg-gradient-to-r from-yellow-400 to-red-500 text-gray-900 font-semibold px-6 py-3 rounded-lg hover:shadow-lg hover:shadow-yellow-400/40 transition-all"
          >
            ログイン
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#16213e] text-white p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-400 to-red-500 bg-clip-text text-transparent">
            NanoBanana
          </h1>
          <button
            onClick={handleLogout}
            className="text-white/60 hover:text-white text-sm"
          >
            ログアウト
          </button>
        </div>

        {/* 画像生成セクション */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 mb-5 border border-white/10">
          <h2 className="text-xl font-semibold mb-4 text-yellow-400">1. 画像を生成</h2>

          {/* アップロードエリア */}
          <label className="block mb-2 font-medium">参考画像（オプション）</label>
          <div
            className={`border-2 border-dashed rounded-xl p-5 text-center mb-4 cursor-pointer transition-all ${
              uploadedImageBase64 ? 'border-green-500 bg-green-500/10' : 'border-white/30 hover:border-yellow-400 hover:bg-yellow-400/10'
            }`}
            onClick={() => document.getElementById('imageInput')?.click()}
          >
            <input
              type="file"
              id="imageInput"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
            {uploadedImageBase64 ? (
              <div>
                <img
                  src={`data:image/png;base64,${uploadedImageBase64}`}
                  alt="Upload Preview"
                  className="max-w-[200px] max-h-[200px] mx-auto rounded-lg mb-2"
                />
                <button
                  onClick={(e) => { e.stopPropagation(); clearImage(); }}
                  className="bg-red-500/30 hover:bg-red-500/50 text-white px-3 py-1 rounded text-sm"
                >
                  画像をクリア
                </button>
              </div>
            ) : (
              <p className="text-white/70">クリックして画像をアップロード</p>
            )}
          </div>

          {/* 履歴 */}
          <div className="mb-4">
            <h3 className="text-sm text-white/80 mb-2">アップロード履歴</h3>
            {history.length === 0 ? (
              <p className="text-white/50 text-sm text-center py-4">履歴がありません</p>
            ) : (
              <div className="grid grid-cols-5 gap-2 max-h-[150px] overflow-y-auto">
                {history.map((img) => (
                  <div
                    key={img.id}
                    className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all hover:scale-105 ${
                      uploadedImageBase64 === img.base64 ? 'border-green-500' : 'border-transparent hover:border-yellow-400'
                    }`}
                    onClick={() => selectFromHistory(img.base64)}
                  >
                    <img
                      src={`data:image/png;base64,${img.base64}`}
                      alt="History"
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteFromHistory(img.id); }}
                      className="absolute top-1 right-1 w-5 h-5 bg-red-500/80 rounded-full text-xs flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* アスペクト比 */}
          <label className="block mb-2 font-medium">アスペクト比</label>
          <div className="flex gap-2 mb-4">
            {['16:9', '1:1', '4:5', 'auto'].map((ratio) => (
              <button
                key={ratio}
                onClick={() => setAspectRatio(ratio)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  aspectRatio === ratio
                    ? 'bg-yellow-400 text-gray-900'
                    : 'bg-white/15 text-white hover:bg-white/25'
                }`}
              >
                {ratio === 'auto' ? '自動' : ratio}
              </button>
            ))}
          </div>
          {aspectRatio === 'auto' && !uploadedImageBase64 && (
            <p className="text-yellow-400/80 text-sm mb-4">※「自動」は参考画像をアップロードすると、その画像のアスペクト比を使用します</p>
          )}

          {/* プロンプト */}
          <label className="block mb-2 font-medium">プロンプト（英語推奨）</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="A cute banana character wearing sunglasses, digital art style"
            className="w-full p-3 rounded-lg bg-white/15 text-white placeholder-white/50 border-none outline-none focus:ring-2 focus:ring-yellow-400 mb-4"
          />

          <button
            onClick={generateImage}
            disabled={isGenerating}
            className="bg-gradient-to-r from-yellow-400 to-red-500 text-gray-900 font-semibold px-6 py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-yellow-400/40 transition-all"
          >
            {isGenerating ? '生成中...' : '画像を生成'}
          </button>

          {generateStatus && (
            <div className={`mt-4 p-3 rounded-lg ${
              generateStatus.type === 'success' ? 'bg-green-500/20 border border-green-500' :
              generateStatus.type === 'error' ? 'bg-red-500/20 border border-red-500' :
              'bg-yellow-400/20 border border-yellow-400'
            }`}>
              {generateStatus.message}
            </div>
          )}
        </div>

        {/* プレビューセクション */}
        {generatedImageBase64 && (
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 mb-5 border border-white/10">
            <h2 className="text-xl font-semibold mb-4 text-yellow-400">2. プレビュー</h2>
            <img
              src={`data:image/png;base64,${generatedImageBase64}`}
              alt="Generated Image"
              className="max-w-full max-h-[400px] mx-auto rounded-xl"
            />
          </div>
        )}

        {/* X投稿セクション */}
        {generatedImageBase64 && (
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 mb-5 border border-white/10">
            <h2 className="text-xl font-semibold mb-4 text-yellow-400">3. Xに投稿</h2>

            <label className="block mb-2 font-medium">投稿テキスト</label>
            <textarea
              value={tweetText}
              onChange={(e) => setTweetText(e.target.value)}
              rows={3}
              placeholder="AIで生成した画像です！ #AI #ImageGeneration"
              className="w-full p-3 rounded-lg bg-white/15 text-white placeholder-white/50 border-none outline-none focus:ring-2 focus:ring-blue-400 mb-4"
            />

            <button
              onClick={postToX}
              disabled={isPosting}
              className="bg-[#1da1f2] hover:bg-[#0d8ecf] text-white font-semibold px-6 py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isPosting ? '投稿中...' : 'Xに投稿'}
            </button>

            {postStatus && (
              <div className={`mt-4 p-3 rounded-lg ${
                postStatus.type === 'success' ? 'bg-green-500/20 border border-green-500' :
                postStatus.type === 'error' ? 'bg-red-500/20 border border-red-500' :
                'bg-yellow-400/20 border border-yellow-400'
              }`}>
                {postStatus.message}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
