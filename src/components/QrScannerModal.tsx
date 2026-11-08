import React, { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';
import {
  X,
  Camera,
  Upload,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Layers,
} from 'lucide-react';
import { QrChunkCollector, ChunkProgress } from '../engine/serialization/qrChunker';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (payload: Uint8Array) => void;
}

// Simple offline Web Audio beep synthesizer
function playSuccessBeep() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.12); // A6

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // Ignore audio error if audio context is blocked
  }
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const collectorRef = useRef<QrChunkCollector>(new QrChunkCollector());

  const [hasCamera, setHasCamera] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [progress, setProgress] = useState<ChunkProgress | null>(null);
  const [recentFlash, setRecentFlash] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('Point camera at QR Code');

  // Stop camera helper
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  // Start camera
  const startCamera = async () => {
    setCameraError(null);
    setHasCamera(true);
    stopCamera();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported by your browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setIsScanning(true);
      }
    } catch (err: any) {
      console.warn('Camera start error:', err);
      setHasCamera(false);
      setCameraError(
        err?.message || 'Unable to access camera. You can upload an image file instead.'
      );
    }
  };

  // Ingest byte array helper
  const handleDecodedBytes = (bytes: Uint8Array) => {
    const res = collectorRef.current.addScannedBytes(bytes);
    setProgress(res.progress);

    if (res.isNewChunk) {
      playSuccessBeep();
      setRecentFlash(true);
      setTimeout(() => setRecentFlash(false), 300);
    }

    if (res.complete && res.payload) {
      setStatusMessage('Program decoded successfully!');
      stopCamera();
      setTimeout(() => {
        onSuccess(res.payload!);
      }, 400);
    } else if (res.progress.totalParts > 1) {
      setStatusMessage(
        `Scanned part ${res.progress.receivedCount}/${res.progress.totalParts}. Scan remaining parts...`
      );
    }
  };

  // Lifecycle: open/close camera & collector reset
  useEffect(() => {
    if (isOpen) {
      collectorRef.current.reset();
      setProgress(null);
      setStatusMessage('Point camera at QR Code');
      startCamera();
    } else {
      stopCamera();
      setIsScanning(false);
    }

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  // Frame scanning loop
  useEffect(() => {
    if (!isOpen || !isScanning) return;

    let animId: number;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const scanFrame = () => {
      if (!videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
        animId = requestAnimationFrame(scanFrame);
        return;
      }

      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      if (ctx && canvas.width > 0 && canvas.height > 0) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        });

        if (code && code.binaryData && code.binaryData.length > 0) {
          const rawBytes = new Uint8Array(code.binaryData);
          handleDecodedBytes(rawBytes);
        }
      }

      animId = requestAnimationFrame(scanFrame);
    };

    animId = requestAnimationFrame(scanFrame);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isOpen, isScanning]);

  // Handle image file upload (offline fallback)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth',
          });
          if (code && code.binaryData && code.binaryData.length > 0) {
            handleDecodedBytes(new Uint8Array(code.binaryData));
          } else {
            setStatusMessage('No QR code detected in the selected image.');
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    // Reset file input value so same file can be re-uploaded if needed
    e.target.value = '';
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="qr-scanner-modal"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-between p-4 sm:p-6 bg-slate-950/95 backdrop-blur-md text-white select-none animate-fade-in"
      onClick={onClose}
    >
      {/* Header */}
      <div
        className="w-full max-w-lg flex items-center justify-between gap-4 py-2 border-b border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-emerald-600/30 border border-emerald-500/50 text-emerald-400">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-wide text-white">Scan QR Code</h2>
            <p className="text-xs text-slate-400">Direct binary import • Works 100% offline</p>
          </div>
        </div>

        <button
          data-testid="close-scanner-btn"
          onClick={onClose}
          className="flex items-center justify-center w-10 h-10 rounded-2xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Viewfinder / Video Container */}
      <div
        className="relative my-auto w-full max-w-sm aspect-square bg-slate-900 rounded-3xl overflow-hidden border-2 border-slate-800 shadow-2xl flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {hasCamera ? (
          <>
            <video
              ref={videoRef}
              data-testid="scanner-video"
              className="w-full h-full object-cover"
              muted
            />

            {/* Viewfinder Target Overlay */}
            <div
              className={`absolute inset-8 rounded-2xl border-2 transition-all duration-300 pointer-events-none ${
                recentFlash
                  ? 'border-emerald-400 bg-emerald-500/20 scale-105'
                  : 'border-indigo-400/80 shadow-[0_0_20px_rgba(99,102,241,0.25)]'
              }`}
            >
              {/* Corner brackets */}
              <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-indigo-400 rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-indigo-400 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-indigo-400 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-indigo-400 rounded-br-lg" />

              {/* Animated scan line */}
              <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent animate-pulse" />
            </div>
          </>
        ) : (
          <div className="p-6 flex flex-col items-center justify-center text-center gap-3">
            <AlertCircle className="w-10 h-10 text-amber-400" />
            <p className="text-xs text-slate-300">{cameraError}</p>
            <button
              onClick={startCamera}
              className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-200 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Camera</span>
            </button>
          </div>
        )}
      </div>

      {/* Progress & Status Bar */}
      <div
        className="w-full max-w-lg flex flex-col gap-3 py-3 border-t border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Status Message */}
        <div className="flex items-center justify-center gap-2 text-xs font-semibold text-center text-slate-300">
          <span>{statusMessage}</span>
        </div>

        {/* Multi-part progress display */}
        {progress && progress.totalParts > 1 && (
          <div className="flex flex-col gap-2 p-3 bg-slate-900 border border-slate-800 rounded-2xl">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300">
              <span className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-400" />
                <span>Multi-Part QR Code Progress:</span>
              </span>
              <span className="text-indigo-400">
                {progress.receivedCount} / {progress.totalParts} Parts
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {Array.from({ length: progress.totalParts }).map((_, i) => {
                const partNum = i + 1;
                const isCollected = progress.receivedParts.includes(partNum);
                return (
                  <span
                    key={partNum}
                    data-testid={`chunk-badge-${partNum}`}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                      isCollected
                        ? 'bg-emerald-600/30 border border-emerald-500/50 text-emerald-300'
                        : 'bg-slate-950 border border-slate-800 text-slate-500'
                    }`}
                  >
                    {isCollected ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <span className="w-3 h-3 rounded-full border border-slate-600 inline-block" />
                    )}
                    <span>Part {partNum}</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Buttons: Upload Image Fallback */}
        <div className="flex items-center justify-between gap-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            className="hidden"
            data-testid="qr-file-input"
          />

          <button
            data-testid="btn-upload-qr-image"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-colors"
          >
            <Upload className="w-4 h-4 text-slate-400" />
            <span>Upload Image File</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
