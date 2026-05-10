"use client";

// ブラウザ内カメラ撮影モーダル (getUserMedia 経由)。
//
// Android の標準カメラアプリ経由 (capture="environment") は端末側の
// 撮影後処理 (HDR/AI 補正) でメモリ不足になりやすいため、Chrome タブ内で
// 直接カメラを起動して撮影 → Canvas キャプチャ → File 化する。
//
// メリット:
//  - カメラアプリの後処理を完全回避 → メモリ不足エラーから解放
//  - 解像度を JS から制御 (1600px target) → 不必要に重いファイルを生成しない
//  - 撮影 → 既存の receipt-uploader.handleSelectFile への流入で圧縮も維持

import { useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, X, AlertCircle } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

// 取得目標の解像度。端末側に対応がなければ近い解像度にネゴシエートされる。
// 1920x1080 でレシート全文の文字判別に十分 (Gemini OCR でも読める)。
const VIDEO_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    facingMode: { ideal: "environment" },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  },
  audio: false,
};

export function CameraCapture({ open, onClose, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // open が true の間だけストリームを保持し、閉じたら必ず停止する。
  // close 時に解放しないとカメラ LED が点灯したままになるブラウザがある。
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setErrorMessage(null);
    setStarting(true);

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(VIDEO_CONSTRAINTS);
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // iOS Safari 等で必須: muted + playsInline + 明示的 play
          await videoRef.current.play().catch(() => {
            // play は許可ジェスチャ前だと NotAllowedError を投げることがある
            // → モーダルがユーザー操作で開かれている前提なので通常は通る
          });
        }
      } catch (err) {
        const e = err as DOMException;
        if (e?.name === "NotAllowedError" || e?.name === "PermissionDeniedError") {
          setErrorMessage(
            "カメラの利用が許可されていません。ブラウザの設定で許可してください。",
          );
        } else if (e?.name === "NotFoundError" || e?.name === "DevicesNotFoundError") {
          setErrorMessage("利用可能なカメラが見つかりませんでした。");
        } else if (e?.name === "NotReadableError" || e?.name === "TrackStartError") {
          setErrorMessage(
            "カメラを起動できませんでした。他のアプリがカメラを使用していないか確認してください。",
          );
        } else {
          setErrorMessage(`カメラの起動に失敗しました: ${e?.message ?? String(err)}`);
        }
      } finally {
        if (!cancelled) setStarting(false);
      }
    })();

    return () => {
      cancelled = true;
      const stream = streamRef.current;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [open]);

  function handleShutter() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setErrorMessage("画像の取得に失敗しました。もう一度お試しください。");
          return;
        }
        const file = new File([blob], `camera-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        onCapture(file);
      },
      "image/jpeg",
      0.92,
    );
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="カメラで撮影"
      className="fixed inset-0 z-50 flex flex-col bg-black"
    >
      {/* ヘッダー: 閉じる */}
      <div className="flex items-center justify-between p-3 text-white">
        <span className="text-sm font-medium">レシートを撮影</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="閉じる"
          className="inline-flex items-center justify-center rounded-md p-2 hover:bg-white/10"
        >
          <X size={20} aria-hidden />
        </button>
      </div>

      {/* ライブビュー */}
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="h-full w-full object-contain"
        />
        {starting && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white">
            <RefreshCw size={20} className="mr-2 animate-spin" aria-hidden />
            カメラを起動中...
          </div>
        )}
        {errorMessage && (
          <div className="absolute inset-x-4 top-4 flex items-start gap-2 rounded-md bg-[var(--color-destructive)] p-3 text-sm text-white">
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* シャッター */}
      <div className="flex items-center justify-center p-6">
        <button
          type="button"
          onClick={handleShutter}
          disabled={!!errorMessage || starting}
          aria-label="撮影"
          className="inline-flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-white/20 text-white transition-colors hover:bg-white/30 disabled:opacity-50"
        >
          <Camera size={28} aria-hidden />
        </button>
      </div>
    </div>
  );
}
