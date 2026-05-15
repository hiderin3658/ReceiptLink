"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// アプリ内ブラウザ（埋め込み WebView）からの Google OAuth は
// Google のセキュリティポリシーで一律ブロックされる（disallowed_useragent / 403）。
// ユーザーに外部ブラウザで開き直してもらう必要があるため、UA で検出する。
type EmbeddedBrowser = {
  app: "line" | "facebook" | "instagram" | "twitter" | "other";
  label: string;
  // 外部ブラウザで開き直す方法の案内文
  hint: string;
};

function detectEmbeddedBrowser(ua: string): EmbeddedBrowser | null {
  if (/Line\//i.test(ua)) {
    return {
      app: "line",
      label: "LINE",
      hint: "右下のメニュー（…アイコン）から「他のブラウザで開く」を選択してください。",
    };
  }
  if (/FBAN|FBAV|FB_IAB|FB4A/i.test(ua)) {
    return {
      app: "facebook",
      label: "Facebook / Messenger",
      hint: "右上の「…」メニューから「ブラウザで開く」を選択してください。",
    };
  }
  if (/Instagram/i.test(ua)) {
    return {
      app: "instagram",
      label: "Instagram",
      hint: "右上の「…」メニューから「ブラウザで開く」を選択してください。",
    };
  }
  if (/Twitter|TwitterAndroid/i.test(ua)) {
    return {
      app: "twitter",
      label: "X (Twitter)",
      hint: "メニューから「ブラウザで開く」を選択してください。",
    };
  }
  // Android の汎用 WebView マーカー（"; wv)" を含む）
  if (/Android.*; wv\)/i.test(ua)) {
    return {
      app: "other",
      label: "アプリ内ブラウザ",
      hint: "メニューから「ブラウザで開く」を選択し、Chrome や Safari で開き直してください。",
    };
  }
  return null;
}

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const [embedded, setEmbedded] = useState<EmbeddedBrowser | null>(null);

  useEffect(() => {
    setEmbedded(detectEmbeddedBrowser(navigator.userAgent));
  }, []);

  const handleGoogleSignIn = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
  };

  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight">ReceiptLink</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            レシート写真を撮るだけで家計簿が完成するアプリ
          </p>
        </div>

        {error === "not_allowed" && (
          <div className="rounded-md border border-[var(--color-destructive)] bg-[color-mix(in_oklch,var(--color-destructive)_10%,white)] p-3 text-sm text-[var(--color-destructive)]">
            このメールアドレスは利用許可されていません。管理者にお問い合わせください。
          </div>
        )}

        {embedded && (
          <div
            role="alert"
            className="space-y-2 rounded-md border border-[var(--color-destructive)] bg-[color-mix(in_oklch,var(--color-destructive)_10%,white)] p-3 text-sm text-[var(--color-destructive)]"
          >
            <p className="font-medium">
              {embedded.label}内のブラウザでは Google ログインができません
            </p>
            <p className="text-xs leading-relaxed">
              Google のセキュリティポリシーにより、アプリ内ブラウザからの認証はブロックされます。
              {embedded.hint}
            </p>
          </div>
        )}

        <button
          onClick={handleGoogleSignIn}
          disabled={!!embedded}
          className="flex w-full items-center justify-center gap-3 rounded-md border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-medium transition-colors hover:bg-[var(--color-muted)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white"
        >
          <GoogleIcon />
          Google でログイン
        </button>

        <p className="text-center text-xs text-[var(--color-muted-foreground)]">
          許可されたアカウントのみ利用できます
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
