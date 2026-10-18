import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAppSelector } from '../../store/hooks';
import { selectCurrentHomeId, selectCurrentUser } from '../../store/selectors';
import { processVoiceCommand, checkVoiceServiceHealth } from '../../services/voiceApi';
import type { VoiceCommandResponse } from '../../services/voiceApi';

/* ── Trạng thái voice ── */
type VoiceState = 'idle' | 'listening' | 'processing' | 'success' | 'error';

/* ── Kiểm tra trình duyệt hỗ trợ Web Speech API ── */
const SpeechRecognition =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

/* ── Kết quả hiển thị ── */
interface VoiceResult {
  success: boolean;
  message: string;
  transcript: string;
  durationMs: number;
}

/* ── MicIcon ── */
const MicIcon: React.FC<{ active?: boolean; className?: string }> = ({ active, className = 'h-5 w-5' }) => (
  <svg
    aria-hidden="true"
    className={`${className} transition-colors ${active ? 'text-white' : ''}`}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z"
    />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" strokeLinecap="round" />
    <line x1="8" y1="23" x2="16" y2="23" strokeLinecap="round" />
  </svg>
);

/* ── WaveformBars khi đang nghe ── */
const WaveformBars: React.FC = () => (
  <div className="voice-waveform flex items-center gap-[4px] h-7">
    {[...Array(5)].map((_, i) => (
      <span
        key={i}
        className="voice-bar inline-block w-[3.5px] rounded-full bg-white shadow-sm"
        style={{
          animationDelay: `${i * 0.12}s`,
          height: '10px',
        }}
      />
    ))}
  </div>
);

/* ── StatusIcon ── */
const StatusIcon: React.FC<{ state: VoiceState }> = ({ state }) => {
  if (state === 'success') {
    return (
      <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  if (state === 'error') {
    return (
      <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  }
  return null;
};

const QUICK_COMMANDS = [
  'Bật đèn phòng ngủ',
  'Bật quạt phòng khách',
  'Mở cổng',
  'Bật máy bơm',
  'Đặt nhiệt độ 26 độ',
  'Tăng độ sáng 80',
];

/* ══════════════════════════════════════════════════
   VoiceAssistantButton — nút microphone trên navbar
   ══════════════════════════════════════════════════ */
export const VoiceAssistantButton: React.FC = () => {
  const currentHomeId = useAppSelector(selectCurrentHomeId);
  const user = useAppSelector(selectCurrentUser);

  const [isOpen, setIsOpen] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [result, setResult] = useState<VoiceResult | null>(null);
  const [serviceOnline, setServiceOnline] = useState<boolean | null>(null);
  const [history, setHistory] = useState<VoiceResult[]>([]);

  const recognitionRef = useRef<any>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const autoCloseTimerRef = useRef<any>(null);

  /* ── Kiểm tra voice service khi mở modal ── */
  useEffect(() => {
    if (isOpen) {
      checkVoiceServiceHealth().then(setServiceOnline);
    }
  }, [isOpen]);

  /* ── Đóng modal khi nhấn Escape ── */
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  /* ── Cleanup recognition khi unmount ── */
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
        recognitionRef.current = null;
      }
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
      }
    };
  }, []);

  /* ── Dọn dẹp khi đóng ── */
  const handleClose = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
    setIsOpen(false);
    setVoiceState('idle');
    setTranscript('');
    setResult(null);
  }, []);

  /* ── Gửi text command → voice service ── */
  const sendCommand = useCallback(
    async (text: string) => {
      const cleanText = text.trim();
      if (!cleanText) return;

      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
      }

      setVoiceState('processing');
      setTranscript(cleanText);

      try {
        const resp: VoiceCommandResponse = await processVoiceCommand({
          text: cleanText,
          homeId: currentHomeId || '',
        });

        const voiceResult: VoiceResult = {
          success: resp.success,
          message: resp.message,
          transcript: resp.transcript || cleanText,
          durationMs: resp.totalDurationMs,
        };

        setResult(voiceResult);
        setVoiceState(resp.success ? 'success' : 'error');
        setHistory((prev) => [voiceResult, ...prev.filter((h) => h.transcript !== cleanText)].slice(0, 8));

        // Tự động chuyển về idle sau 4s
        autoCloseTimerRef.current = setTimeout(() => {
          setVoiceState('idle');
        }, 4000);
      } catch (err: any) {
        const voiceResult: VoiceResult = {
          success: false,
          message: err.message || 'Lỗi kết nối voice service',
          transcript: cleanText,
          durationMs: 0,
        };
        setResult(voiceResult);
        setVoiceState('error');
        setHistory((prev) => [voiceResult, ...prev.filter((h) => h.transcript !== cleanText)].slice(0, 8));
      }
    },
    [currentHomeId],
  );

  /* ── Bắt đầu nghe giọng nói ── */
  const startListening = useCallback(() => {
    if (!SpeechRecognition) {
      setResult({
        success: false,
        message: 'Trình duyệt không hỗ trợ Web Speech API. Vui lòng dùng Chrome hoặc Edge.',
        transcript: '',
        durationMs: 0,
      });
      setVoiceState('error');
      return;
    }

    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
    }
    setResult(null);

    const recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setVoiceState('listening');
      setTranscript('');
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      setTranscript(finalTranscript || interimTranscript);

      if (finalTranscript) {
        sendCommand(finalTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'no-speech') {
        setResult({
          success: false,
          message: 'Không nhận ra giọng nói. Vui lòng bấm mic và thử lại.',
          transcript: '',
          durationMs: 0,
        });
      } else if (event.error === 'not-allowed') {
        setResult({
          success: false,
          message: 'Microphone bị chặn. Vui lòng cấp quyền truy cập microphone trên thanh địa chỉ trình duyệt.',
          transcript: '',
          durationMs: 0,
        });
      } else {
        setResult({
          success: false,
          message: `Lỗi nhận dạng: ${event.error}`,
          transcript: '',
          durationMs: 0,
        });
      }
      setVoiceState('error');
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setVoiceState((s) => (s === 'listening' ? 'idle' : s));
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      console.warn('Recognition start warning:', e);
    }
  }, [sendCommand]);

  /* ── Dừng nghe ── */
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
  }, []);

  /* ── Mở modal & tự động kích hoạt mic ── */
  const handleOpen = () => {
    setIsOpen(true);
    setVoiceState('idle');
    setTranscript('');
    setResult(null);
    checkVoiceServiceHealth().then(setServiceOnline);
    // Bắt đầu nhận diện ngay khi người dùng nhấn nút mic trên navbar
    setTimeout(() => {
      startListening();
    }, 200);
  };

  /* ── Không hiện nút nếu không có home ── */
  if (!currentHomeId || !user) return null;

  return (
    <>
      {/* ── Nút Microphone trên Navbar ── */}
      <button
        type="button"
        id="voice-assistant-btn"
        aria-label="Điều khiển giọng nói"
        onClick={handleOpen}
        className={`relative flex h-11 w-11 items-center justify-center rounded-2xl border border-line bg-surface text-icon shadow-soft transition-all hover:bg-sidebar-hover hover:text-primary-hover hover:scale-105 active:scale-95 ${
          isOpen ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface' : ''
        }`}
        title="Điều khiển bằng giọng nói"
      >
        <MicIcon />
      </button>

      {/* ── Voice Modal Overlay mount ngoài body qua createPortal ── */}
      {isOpen &&
        createPortal(
          <div
            className="voice-overlay fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
            onClick={handleClose}
          >
            <div
              ref={modalRef}
              className="voice-modal relative w-full max-w-lg my-auto rounded-3xl bg-surface border border-line shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-sidebar/50">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
                    <MicIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-text">Trợ lý giọng nói HESTA</h2>
                    <p className="text-xs text-muted">Điều khiển thiết bị thông minh bằng giọng nói</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {serviceOnline !== null && (
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${
                        serviceOnline
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-600 border-rose-200'
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          serviceOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                        }`}
                      />
                      {serviceOnline ? 'Online' : 'Offline'}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-muted hover:bg-line hover:text-text transition-colors"
                    aria-label="Đóng"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="px-6 py-6 overflow-y-auto custom-scrollbar flex-1 space-y-5">
                {/* Central Mic Button */}
                <div className="flex flex-col items-center justify-center pt-2">
                  <div className="relative flex items-center justify-center">
                    {/* Pulsing ripples when listening */}
                    {voiceState === 'listening' && (
                      <>
                        <span className="absolute h-28 w-28 rounded-full bg-rose-500/20 animate-ping pointer-events-none" />
                        <span className="absolute h-32 w-32 rounded-full border-2 border-rose-400/40 animate-pulse pointer-events-none" />
                      </>
                    )}

                    <button
                      type="button"
                      onClick={voiceState === 'listening' ? stopListening : startListening}
                      disabled={voiceState === 'processing'}
                      aria-label="Nhấn để thu âm"
                      className={`relative flex h-24 w-24 items-center justify-center rounded-full shadow-lg transition-all duration-300 focus:outline-none ${
                        voiceState === 'listening'
                          ? 'bg-rose-500 text-white shadow-rose-500/40 scale-105'
                          : voiceState === 'processing'
                            ? 'bg-amber-500 text-white shadow-amber-500/30 cursor-wait'
                            : voiceState === 'success'
                              ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                              : voiceState === 'error'
                                ? 'bg-rose-500 text-white shadow-rose-500/30'
                                : 'bg-primary text-white shadow-primary/30 hover:bg-primary-hover hover:scale-105 active:scale-95'
                      }`}
                    >
                      {voiceState === 'listening' ? (
                        <WaveformBars />
                      ) : voiceState === 'processing' ? (
                        <svg className="h-8 w-8 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                      ) : voiceState === 'success' || voiceState === 'error' ? (
                        <StatusIcon state={voiceState} />
                      ) : (
                        <MicIcon active className="h-9 w-9" />
                      )}
                    </button>
                  </div>

                  {/* Status label */}
                  <p className="mt-4 text-sm font-semibold text-text text-center">
                    {voiceState === 'idle' && 'Nhấn vào micro để nói'}
                    {voiceState === 'listening' && (
                      <span className="text-rose-600 animate-pulse font-bold">Đang lắng nghe... hãy nói lệnh</span>
                    )}
                    {voiceState === 'processing' && (
                      <span className="text-amber-600">Đang nhận diện & gửi lệnh...</span>
                    )}
                    {voiceState === 'success' && <span className="text-emerald-600 font-bold">Thực thi thành công!</span>}
                    {voiceState === 'error' && <span className="text-rose-600">Có lỗi, nhấn micro để thử lại</span>}
                  </p>
                </div>

                {/* Transcript */}
                {transcript && (
                  <div className="rounded-2xl bg-sidebar-active/60 border border-primary/20 px-4 py-3 text-center">
                    <p className="text-xs font-semibold text-primary-hover mb-0.5">Bạn vừa nói:</p>
                    <p className="text-sm font-bold text-text leading-relaxed">"{transcript}"</p>
                  </div>
                )}

                {/* Result Notification Box */}
                {result && (
                  <div
                    className={`rounded-2xl px-4 py-3 border transition-all ${
                      result.success
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-rose-50 border-rose-200 text-rose-700'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 text-base">{result.success ? '✅' : '⚠️'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-relaxed">{result.message}</p>
                        {result.durationMs > 0 && (
                          <p className="mt-1 text-xs opacity-75 font-mono">
                            ⚡ Phản hồi: {Math.round(result.durationMs)}ms
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Quick suggestions */}
                <div>
                  <p className="text-xs font-semibold text-muted mb-2">Lệnh mẫu (click để chạy thử):</p>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_COMMANDS.map((cmd) => (
                      <button
                        key={cmd}
                        type="button"
                        onClick={() => sendCommand(cmd)}
                        className="rounded-xl px-3 py-1.5 text-xs font-medium border border-line bg-surface text-text hover:bg-sidebar-hover hover:border-primary/40 hover:text-primary-hover transition-all active:scale-95"
                      >
                        "{cmd}"
                      </button>
                    ))}
                  </div>
                </div>

                {/* History */}
                {history.length > 0 && (
                  <div className="border-t border-line pt-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-muted">Lịch sử gần đây:</p>
                      <button
                        type="button"
                        onClick={() => setHistory([])}
                        className="text-[11px] text-muted hover:text-rose-500 font-medium transition-colors"
                      >
                        Xóa lịch sử
                      </button>
                    </div>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {history.map((item, idx) => (
                        <div
                          key={idx}
                          onClick={() => sendCommand(item.transcript)}
                          title="Click để chạy lại lệnh này"
                          className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs bg-sidebar/50 hover:bg-sidebar-hover cursor-pointer border border-transparent hover:border-primary/20 transition-all"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`h-2 w-2 rounded-full shrink-0 ${
                                item.success ? 'bg-emerald-500' : 'bg-rose-500'
                              }`}
                            />
                            <span className="font-medium text-text truncate">"{item.transcript}"</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {item.durationMs > 0 && (
                              <span className="text-[11px] font-mono text-muted">
                                {Math.round(item.durationMs)}ms
                              </span>
                            )}
                            <span
                              className={`font-bold ${item.success ? 'text-emerald-600' : 'text-rose-500'}`}
                            >
                              {item.success ? '✓' : '✗'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-3 border-t border-line bg-sidebar/30 flex items-center justify-between text-xs text-muted">
                <span>Nhấn ESC hoặc click ra ngoài để đóng</span>
                <span className="font-semibold text-primary">HESTA AI</span>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};
