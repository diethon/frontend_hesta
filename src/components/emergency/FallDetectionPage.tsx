import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Camera, Minimize2, RefreshCw } from 'lucide-react';
import { AI_VIDEO_FEED_URL } from '../../services/fallDetectionService';

export const FallDetectionPage: React.FC = () => {
  const navigate = useNavigate();
  const [streamError, setStreamError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const enteredFullscreenRef = useRef(
    typeof document !== 'undefined' && Boolean(document.fullscreenElement)
  );
  const isLeavingRef = useRef(false);

  const exitToHome = useCallback(() => {
    if (isLeavingRef.current) return;
    isLeavingRef.current = true;
    if (typeof document !== 'undefined' && document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {
        // Ignore exitFullscreen errors in restricted browser contexts
      });
    }
    navigate('/home');
  }, [navigate]);

  useEffect(() => {
    if (typeof document !== 'undefined' && document.fullscreenElement) {
      enteredFullscreenRef.current = true;
    }

    const onFullscreenChange = () => {
      if (document.fullscreenElement) {
        enteredFullscreenRef.current = true;
      } else if (enteredFullscreenRef.current) {
        exitToHome();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.fullscreenElement) {
        exitToHome();
      }
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [exitToHome]);

  useEffect(() => {
    if (!streamError) return;
    const retryTimer = window.setTimeout(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      setReloadKey((prev) => prev + 1);
      setStreamError(false);
    }, 3500);
    return () => window.clearTimeout(retryTimer);
  }, [streamError]);

  const streamUrl =
    reloadKey === 0
      ? AI_VIDEO_FEED_URL
      : `${AI_VIDEO_FEED_URL}?t=${reloadKey}`;

  return (
    <div
      id="main-content"
      role="main"
      className="fixed inset-0 z-40 w-screen h-screen bg-black overflow-hidden flex items-center justify-center group"
    >
      {!streamError ? (
        <img
          src={streamUrl}
          alt="Camera trực tiếp toàn màn hình"
          className="w-full h-full object-contain select-none"
          onError={() => setStreamError(true)}
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 text-center px-6">
          <div className="w-12 h-12 rounded-2xl bg-white/10 text-white/80 flex items-center justify-center">
            <Camera className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium text-white/85">
            Không kết nối được camera
          </p>
          <button
            type="button"
            onClick={() => {
              setReloadKey((prev) => prev + 1);
              setStreamError(false);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-semibold border border-white/20 backdrop-blur-md transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Kết nối lại</span>
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={exitToHome}
        aria-label="Thoát toàn màn hình"
        title="Thoát toàn màn hình (Esc)"
        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/50 hover:bg-black/75 text-white border border-white/20 backdrop-blur-md flex items-center justify-center opacity-70 group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer"
      >
        <Minimize2 className="w-5 h-5" />
      </button>
    </div>
  );
};
