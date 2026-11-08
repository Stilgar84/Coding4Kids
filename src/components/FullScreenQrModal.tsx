import React, { useState, useEffect, useRef, useMemo } from 'react';
import QRCode from 'qrcode';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  QrCode,
} from 'lucide-react';
import { splitIntoQrChunks, QrChunk } from '../engine/serialization/qrChunker';

interface FullScreenQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  binaryPayload: Uint8Array;
}

export const FullScreenQrModal: React.FC<FullScreenQrModalProps> = ({
  isOpen,
  onClose,
  binaryPayload,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoCycle, setIsAutoCycle] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  // Split payload into <= 500-byte chunks
  const chunks = useMemo<QrChunk[]>(() => {
    if (!binaryPayload || binaryPayload.length === 0) return [];
    try {
      return splitIntoQrChunks(binaryPayload);
    } catch {
      return [];
    }
  }, [binaryPayload]);

  const totalParts = chunks.length;
  const currentChunk = chunks[currentIndex];

  // Reset index when opening or payload changes
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
      setIsAutoCycle(false);
      setRenderError(null);
    }
  }, [isOpen, binaryPayload]);

  // Render QR Code onto canvas
  useEffect(() => {
    if (!isOpen || !currentChunk || !canvasRef.current) return;

    setRenderError(null);
    const canvas = canvasRef.current;

    // Use direct binary segment mode with Level M error correction
    QRCode.toCanvas(
      canvas,
      [
        {
          data: currentChunk.data,
          mode: 'byte',
        },
      ],
      {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: Math.min(window.innerWidth - 64, window.innerHeight - 260, 420),
        color: {
          dark: '#020617', // slate-950
          light: '#ffffff',
        },
      },
      (err) => {
        if (err) {
          console.error('Failed to generate QR code:', err);
          setRenderError(err.message || 'Failed to generate QR code');
        }
      }
    );
  }, [isOpen, currentChunk, currentIndex]);

  // Auto-cycle through parts
  useEffect(() => {
    if (!isOpen || !isAutoCycle || totalParts <= 1) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % totalParts);
    }, 2800);

    return () => clearInterval(timer);
  }, [isOpen, isAutoCycle, totalParts]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' || e.key === ' ') {
        if (totalParts > 1) {
          setCurrentIndex((prev) => (prev + 1) % totalParts);
        }
      } else if (e.key === 'ArrowLeft') {
        if (totalParts > 1) {
          setCurrentIndex((prev) => (prev - 1 + totalParts) % totalParts);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, totalParts, onClose]);

  if (!isOpen || chunks.length === 0) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="fullscreen-qr-modal"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-between p-4 sm:p-6 bg-slate-950/95 backdrop-blur-md text-white select-none animate-fade-in"
      onClick={onClose}
    >
      {/* Top Header Bar */}
      <div
        className="w-full max-w-2xl flex items-center justify-between gap-4 py-2 border-b border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-indigo-600/30 border border-indigo-500/50 text-indigo-400">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black tracking-wide text-white">
                {totalParts > 1 ? `QR Code ${currentIndex + 1} of ${totalParts}` : 'QR Code (1 of 1)'}
              </h2>
              <span className="px-2 py-0.5 text-[11px] font-bold tracking-wider uppercase rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                ECC Level M
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {totalParts > 1
                ? `Part ${currentIndex + 1}/${totalParts} (${currentChunk.data.length} bytes / ${binaryPayload.length} total bytes)`
                : `Compact Binary (${currentChunk.data.length} bytes)`}
            </p>
          </div>
        </div>

        <button
          data-testid="close-qr-fullscreen-btn"
          onClick={onClose}
          className="flex items-center justify-center w-10 h-10 rounded-2xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          title="Close (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Center Area: QR Code canvas */}
      <div
        className="flex flex-col items-center justify-center my-auto p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative p-4 sm:p-6 bg-white rounded-3xl shadow-2xl border-4 border-slate-700/50 flex flex-col items-center">
          <canvas
            ref={canvasRef}
            data-testid="qr-canvas"
            className="rounded-xl block max-w-full h-auto aspect-square"
          />

          {renderError && (
            <div className="absolute inset-0 bg-red-900/90 text-white flex items-center justify-center p-4 rounded-3xl text-sm font-bold text-center">
              {renderError}
            </div>
          )}

          {/* Progress Indicator for auto-cycle */}
          {isAutoCycle && totalParts > 1 && (
            <div className="w-full mt-3 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                key={currentIndex}
                className="h-full bg-indigo-600 rounded-full animate-progress"
                style={{ animationDuration: '2800ms' }}
              />
            </div>
          )}
        </div>

        {totalParts > 1 && (
          <p className="mt-4 text-xs font-medium text-slate-400 text-center max-w-sm">
            Scan parts sequentially. Use the navigation buttons below or enable Auto Play to loop through all QR codes.
          </p>
        )}
      </div>

      {/* Bottom Controls */}
      <div
        className="w-full max-w-2xl flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {totalParts > 1 ? (
          <>
            {/* Part selection badges */}
            <div className="flex items-center gap-1.5 flex-wrap justify-center">
              {chunks.map((_, idx) => (
                <button
                  key={idx}
                  data-testid={`btn-goto-part-${idx + 1}`}
                  onClick={() => setCurrentIndex(idx)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                    idx === currentIndex
                      ? 'bg-indigo-600 text-white shadow-lg ring-2 ring-indigo-400'
                      : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  Part {idx + 1}
                </button>
              ))}
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center gap-2">
              <button
                data-testid="btn-prev-part"
                onClick={() => setCurrentIndex((prev) => (prev - 1 + totalParts) % totalParts)}
                className="flex items-center gap-1 px-3 py-2 bg-slate-900 border border-slate-700 hover:bg-slate-800 rounded-xl text-xs font-bold text-slate-200 transition-colors"
                title="Previous Part (Left Arrow)"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Prev</span>
              </button>

              <button
                data-testid="btn-auto-cycle"
                onClick={() => setIsAutoCycle(!isAutoCycle)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  isAutoCycle
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-slate-900 border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
                title="Auto loop through all parts"
              >
                {isAutoCycle ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isAutoCycle ? 'Auto: ON' : 'Auto Play'}</span>
              </button>

              <button
                data-testid="btn-next-part"
                onClick={() => setCurrentIndex((prev) => (prev + 1) % totalParts)}
                className="flex items-center gap-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold text-white shadow-md transition-colors"
                title="Next Part (Right Arrow)"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          <div className="w-full flex items-center justify-between text-xs text-slate-400">
            <span>Direct 8-Bit Binary QR Code • Max 500 bytes • Level M</span>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-colors shadow-md"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
