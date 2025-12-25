'use client';

import { useState, useEffect, useCallback } from 'react';

interface HistoryImage {
  id: string;
  base64: string;
  createdAt: number;
}

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [uploadedImages, setUploadedImages] = useState<string[]>([]); // 最大3枚
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
        const newHistory = [newImage, ...prev].slice(0, 10);
        try {
          localStorage.setItem('uploadHistory', JSON.stringify(newHistory));
        } catch (e) {
          console.error('履歴の保存エラー:', e);
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

  // 画像アップロード（最大3枚）
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remainingSlots = 3 - uploadedImages.length;
    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    for (const file of filesToProcess) {
      try {
        const compressedBase64 = await compressImage(file, 400);
        const apiBase64 = await compressImage(file, 1200);

        setUploadedImages(prev => [...prev, apiBase64].slice(0, 3));
        saveToHistory(compressedBase64);
      } catch (err) {
        console.error('画像処理エラー:', err);
      }
    }

    // inputをリセット
    e.target.value = '';
  };

  // 履歴から選択（追加）
  const selectFromHistory = (base64: string) => {
    if (uploadedImages.length < 3 && !uploadedImages.includes(base64)) {
      setUploadedImages(prev => [...prev, base64].slice(0, 3));
    }
  };

  // 画像を1枚削除
  const removeImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  // 全画像クリア
  const clearAllImages = () => {
    setUploadedImages([]);
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
        body: JSON.stringify({
          prompt,
          inputImages: uploadedImages.length > 0 ? uploadedImages : null,
          aspectRatio
        })
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

  // iOSかどうかを判定
  const isIOS = () => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  };

  // 画像を保存
  const saveImage = async () => {
    if (!generatedImageBase64) return;

    try {
      // Base64をBlobに変換
      const byteCharacters = atob(generatedImageBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/png' });
      const file = new File([blob], `nanobanana_${Date.now()}.png`, { type: 'image/png' });

      // iOSの場合は共有シートを使う（写真に保存オプションが表示される）
      if (isIOS() && navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
        });
      } else {
        // PCの場合はダウンロード
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nanobanana_${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('保存エラー:', error);
      if ((error as Error).name !== 'AbortError') {
        alert('画像の保存に失敗しました');
      }
    }
  };

  // 画像を共有（iPhone用）
  const shareImage = async () => {
    if (!generatedImageBase64) return;

    try {
      // Base64をBlobに変換
      const byteCharacters = atob(generatedImageBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/png' });
      const file = new File([blob], `nanobanana_${Date.now()}.png`, { type: 'image/png' });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'NanoBanana生成画像',
        });
      } else {
        // Web Share APIが使えない場合はダウンロード
        saveImage();
      }
    } catch (error) {
      console.error('共有エラー:', error);
      // 共有がキャンセルされた場合はエラーを表示しない
      if ((error as Error).name !== 'AbortError') {
        alert('共有に失敗しました');
      }
    }
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
          <label className="block mb-2 font-medium">参考画像（最大3枚）</label>

          {/* アップロード済み画像のプレビュー */}
          {uploadedImages.length > 0 && (
            <div className="flex gap-2 mb-3 flex-wrap">
              {uploadedImages.map((img, index) => (
                <div key={index} className="relative">
                  <img
                    src={`data:image/jpeg;base64,${img}`}
                    alt={`Upload ${index + 1}`}
                    className="w-20 h-20 object-cover rounded-lg border-2 border-green-500"
                  />
                  <button
                    onClick={() => removeImage(index)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full text-white text-xs flex items-center justify-center"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {uploadedImages.length < 3 && (
            <div
              className="border-2 border-dashed rounded-xl p-5 text-center mb-4 cursor-pointer transition-all border-white/30 hover:border-yellow-400 hover:bg-yellow-400/10"
              onClick={() => document.getElementById('imageInput')?.click()}
            >
              <input
                type="file"
                id="imageInput"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImageUpload}
              />
              <p className="text-white/70">
                クリックして画像を追加（残り{3 - uploadedImages.length}枚）
              </p>
            </div>
          )}

          {uploadedImages.length > 0 && (
            <button
              onClick={clearAllImages}
              className="mb-4 bg-red-500/30 hover:bg-red-500/50 text-white px-3 py-1 rounded text-sm"
            >
              すべてクリア
            </button>
          )}

          {/* 履歴 */}
          <div className="mb-4">
            <h3 className="text-sm text-white/80 mb-2">アップロード履歴（タップで追加）</h3>
            {history.length === 0 ? (
              <p className="text-white/50 text-sm text-center py-4">履歴がありません</p>
            ) : (
              <div className="grid grid-cols-5 gap-2 max-h-[150px] overflow-y-auto">
                {history.map((img) => (
                  <div
                    key={img.id}
                    className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all hover:scale-105 ${
                      uploadedImages.includes(img.base64) ? 'border-green-500' : 'border-transparent hover:border-yellow-400'
                    }`}
                    onClick={() => selectFromHistory(img.base64)}
                  >
                    <img
                      src={`data:image/jpeg;base64,${img.base64}`}
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
          <div className="flex gap-2 mb-4 flex-wrap">
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
          {aspectRatio === 'auto' && uploadedImages.length === 0 && (
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
              className="max-w-full max-h-[400px] mx-auto rounded-xl mb-4"
            />

            {/* 保存・共有ボタン */}
            <div className="flex gap-3 justify-center">
              <button
                onClick={saveImage}
                className="bg-green-500 hover:bg-green-600 text-white font-semibold px-6 py-2 rounded-lg transition-all flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                保存
              </button>
              <button
                onClick={shareImage}
                className="bg-purple-500 hover:bg-purple-600 text-white font-semibold px-6 py-2 rounded-lg transition-all flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                </svg>
                共有
              </button>
            </div>
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
