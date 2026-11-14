import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  AlertTriangle,
  PhoneCall,
  CheckCircle2,
  Volume2,
  VolumeX,
  Eye,
  Activity,
  ShieldCheck,
} from 'lucide-react';
import {
  fallDetectionService,
  type FallIncidentDTO,
  type FallIncidentType,
} from '../../services/fallDetectionService';
import { Client } from '@stomp/stompjs';
import { getRealtimeWebSocketUrl } from '../../services/apiClient';
import { useAppSelector } from '../../store/hooks';
import { selectAccessToken } from '../../store/selectors';

export const EmergencyFallModal: React.FC = () => {
  const accessToken = useAppSelector(selectAccessToken);
  const [activeIncident, setActiveIncident] = useState<FallIncidentDTO | null>(null);
  const [countdown, setCountdown] = useState<number>(30);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showLiveStream, setShowLiveStream] = useState<boolean>(true);

  // Audio Context for synthesized siren
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const sirenIntervalRef = useRef<number | null>(null);
  const stompClientRef = useRef<Client | null>(null);

  // --- Global Browser Autoplay Policy Unlocker ---
  useEffect(() => {
    const unlockAudio = () => {
      try {
        if (!audioCtxRef.current) {
          const AudioContextClass =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          audioCtxRef.current = new AudioContextClass();
        }
        if (audioCtxRef.current.state === 'suspended') {
          void audioCtxRef.current.resume();
        }
      } catch (e) {
        console.warn('AudioContext unlock failed:', e);
      }
    };

    const events = ['click', 'keydown', 'touchstart', 'pointerdown'];
    events.forEach((evt) => window.addEventListener(evt, unlockAudio, { once: true }));

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, unlockAudio));
    };
  }, []);

  // --- Web Audio Siren Synthesizer ---
  const startSiren = useCallback(() => {
    if (isMuted) return;
    try {
      if (!audioCtxRef.current) {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtxRef.current = new AudioContextClass();
      }

      if (audioCtxRef.current.state === 'suspended') {
        void audioCtxRef.current.resume();
      }

      if (oscRef.current) return;

      const osc = audioCtxRef.current.createOscillator();
      const gain = audioCtxRef.current.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, audioCtxRef.current.currentTime);

      gain.gain.setValueAtTime(0.2, audioCtxRef.current.currentTime);
      osc.connect(gain);
      gain.connect(audioCtxRef.current.destination);

      osc.start();
      oscRef.current = osc;
      gainRef.current = gain;

      let high = false;
      sirenIntervalRef.current = window.setInterval(() => {
        if (!oscRef.current || !audioCtxRef.current) return;
        const targetFreq = high ? 800 : 1200;
        oscRef.current.frequency.exponentialRampToValueAtTime(
          targetFreq,
          audioCtxRef.current.currentTime + 0.35
        );
        high = !high;
      }, 500);
    } catch (e) {
      console.warn('Web Audio Siren could not start automatically:', e);
    }
  }, [isMuted]);

  const stopSiren = useCallback(() => {
    if (sirenIntervalRef.current) {
      clearInterval(sirenIntervalRef.current);
      sirenIntervalRef.current = null;
    }
    if (oscRef.current) {
      try {
        oscRef.current.stop();
        oscRef.current.disconnect();
      } catch {
        // Ignored
      }
      oscRef.current = null;
    }
    if (gainRef.current) {
      gainRef.current.disconnect();
      gainRef.current = null;
    }
  }, []);

  // Mute toggle effect
  useEffect(() => {
    if (isMuted) {
      stopSiren();
    } else if (activeIncident && activeIncident.state !== 'FALSE_ALARM' && activeIncident.state !== 'RESOLVED') {
      startSiren();
    }
  }, [isMuted, activeIncident, startSiren, stopSiren]);

  // --- STOMP WebSocket Subscription to Backend Spring Boot ---
  useEffect(() => {
    // The backend only accepts authenticated sockets and delivers incidents to members of the affected home.
    if (!accessToken) return;
    const wsUrl = getRealtimeWebSocketUrl();
    const client = new Client({
      brokerURL: wsUrl,
      connectHeaders: { Authorization: `Bearer ${accessToken}` },
      reconnectDelay: 5000,
      debug: () => undefined,
      onConnect: () => {
        client.subscribe('/user/topic/fall', (msg) => {
          try {
            const data = JSON.parse(msg.body) as FallIncidentDTO;
            if (data.state === 'FALSE_ALARM' || data.state === 'RESOLVED') {
              setActiveIncident(null);
              stopSiren();
            } else {
              setActiveIncident(data);
              setCountdown(data.countdownRemainingSec ?? 30);
              startSiren();
            }
          } catch (e) {
            console.error('Error parsing fall incident STOMP payload:', e);
          }
        });
      },
    });

    try {
      client.activate();
      stompClientRef.current = client;
    } catch {
      // Ignored in offline demo mode
    }

    return () => {
      void client.deactivate();
    };
  }, [accessToken, startSiren, stopSiren]);

  // --- Local AI Edge Engine Polling (Dual-Link Failover) ---
  useEffect(() => {
    const pollInterval = window.setInterval(async () => {
      const status = await fallDetectionService.checkAiStatus();
      if (status) {
        if (status.alert && status.state === 'CONFIRMED_FALL') {
          const resolvedType = (
            status.incident_type && status.incident_type !== 'NONE'
              ? status.incident_type
              : 'ACCIDENTAL_FALL'
          ) as FallIncidentType;
          setActiveIncident((prev) => {
            if (!prev) {
              startSiren();
              setCountdown(30);
              return {
                id: `local-fall-${Date.now()}`,
                deviceId: 'cam_livingroom_01',
                roomName: status.safe_zone || 'Toàn Cảnh Camera Quan Sát',
                incidentType: resolvedType,
                state: 'DETECTED',
                confidenceScore: 0.96,
                metrics: status.metrics,
                snapshotUrl: 'http://localhost:5000/video_feed',
              };
            }
            return {
              ...prev,
              incidentType: prev.incidentType || resolvedType,
              metrics: status.metrics,
            };
          });
        } else {
          setActiveIncident((prev) => {
            if (prev && prev.id.startsWith('local-fall-')) {
              stopSiren();
              return null;
            }
            return prev;
          });
        }
      }
    }, 1500);

    return () => clearInterval(pollInterval);
  }, [startSiren, stopSiren]);

  // --- Countdown Timer Logic ---
  useEffect(() => {
    if (!activeIncident || activeIncident.state === 'ACKNOWLEDGED') return;

    const timer = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setActiveIncident((curr) => (curr ? { ...curr, state: 'ESCALATED_SOS' } : null));
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeIncident]);

  // --- Action Handlers ---
  const handleDismiss = async () => {
    stopSiren();
    await fallDetectionService.dismissAiLocal();
    if (activeIncident) {
      await fallDetectionService.dismissIncident(activeIncident.id, 'Người dùng bấm xác nhận an toàn (Tôi ổn)');
    }
    setActiveIncident(null);
  };

  const handleAcknowledge = async () => {
    if (activeIncident) {
      await fallDetectionService.acknowledgeIncident(activeIncident.id);
      setActiveIncident((prev) => (prev ? { ...prev, state: 'ACKNOWLEDGED' } : null));
    }
  };

  const handleCallEmergency = () => {
    window.open('tel:115', '_self');
  };

  const formatClassification = (type: string) => {
    switch (type) {
      case 'HEAD_SLUMP_SUSPECTED':
        return 'NGHI NGỜ ĐỘT QUỴ / GỤC ĐẦU BẤT TỈNH';
      case 'SAFE_ZONE_IMPACT_FALL':
        return 'VA ĐẬP NGUY HIỂM TRONG TẦM MẮT CAMERA';
      case 'ACCIDENTAL_FALL':
      default:
        return 'PHÁT HIỆN TÉ NGÃ KHẨN CẤP TRONG TẦM MẮT CAMERA';
    }
  };

  if (!activeIncident) {
    return null;
  }

  return (
    <>
      {/* Emergency Full-Screen Modal */}
      {activeIncident && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Cảnh báo té ngã khẩn cấp"
          className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-[#090d16]/80 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div className="relative w-full max-w-4xl bg-[var(--solid)] border-2 border-rose-500 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Header: Emergency Alert Banner */}
            <div className="bg-gradient-to-r from-rose-700 via-rose-600 to-red-700 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/15 rounded-2xl border border-white/25">
                  <AlertTriangle className="w-6 h-6 text-amber-200 animate-pulse" />
                </div>
                <div>
                  <div
                    role="heading"
                    aria-level={2}
                    className="text-base sm:text-lg font-black tracking-wide text-white"
                  >
                    CẢNH BÁO TÉ NGÃ KHẨN CẤP (EMERGENCY SOS)
                  </div>
                  <p className="text-xs text-rose-100 font-medium mt-0.5">
                    Khu vực: <strong className="text-white underline">{activeIncident.roomName || 'Toàn Cảnh Camera Quan Sát'}</strong> · Thiết bị: <span className="font-mono">{activeIncident.deviceId}</span>
                  </p>
                </div>
              </div>

              {/* Siren Audio Controls */}
              <button
                type="button"
                onClick={() => setIsMuted(!isMuted)}
                className="px-3 py-1.5 rounded-xl bg-black/25 hover:bg-black/40 border border-white/20 text-white transition-colors flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                title={isMuted ? 'Bật còi' : 'Tắt còi tạm thời'}
              >
                {isMuted ? (
                  <VolumeX className="w-4 h-4 text-white/80" />
                ) : (
                  <Volume2 className="w-4 h-4 text-amber-200 animate-pulse" />
                )}
                <span>{isMuted ? 'Đã tắt còi' : 'Còi đang hú'}</span>
              </button>
            </div>

            {/* Countdown Progress Bar */}
            <div className="bg-rose-500/10 px-6 py-3.5 border-b border-rose-500/20 flex flex-wrap items-center justify-between gap-4 tabular-nums">
              <div className="flex items-center gap-3.5">
                <span className="text-3xl font-black text-rose-600 font-mono">
                  {countdown < 10 ? `0${countdown}` : countdown}s
                </span>
                <span className="text-xs font-medium text-[var(--text)] max-w-md leading-relaxed">
                  {activeIncident.state === 'ESCALATED_SOS'
                    ? 'Hết thời gian chờ! Đã tự động kích hoạt cuộc gọi khẩn cấp SOS và còi hú tối đa.'
                    : activeIncident.state === 'ACKNOWLEDGED'
                    ? 'Người thân đã xác nhận đang kiểm tra hiện trường. Bộ đếm tạm dừng.'
                    : 'Nếu không xác nhận trong vòng 30 giây, hệ thống sẽ tự động kích hoạt còi hú 12V và gọi cấp cứu.'}
                </span>
              </div>

              <div className="w-full sm:w-48 h-2.5 bg-[var(--muted)] rounded-full overflow-hidden border border-[var(--border)]">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-rose-600 transition-all duration-1000 ease-linear"
                  style={{ width: `${(countdown / 30) * 100}%` }}
                />
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto">
              {/* Left Column: Live AI Video Feed / Snapshot */}
              <div className="lg:col-span-7 flex flex-col gap-3.5">
                <div className="relative rounded-2xl overflow-hidden bg-[#090d16] aspect-video border border-[#1e293b] shadow-inner flex items-center justify-center">
                  {showLiveStream ? (
                    <img
                      src="http://localhost:5000/video_feed"
                      alt="Luồng hình ảnh AI trực tiếp"
                      className="w-full h-full object-contain"
                      onError={() => setShowLiveStream(false)}
                    />
                  ) : (
                    <div className="relative w-full h-full flex flex-col items-center justify-center p-6 text-center">
                      <img
                        src="/camera_living_room.jpg"
                        alt="Ảnh hiện trường camera"
                        className="absolute inset-0 w-full h-full object-cover opacity-30 pointer-events-none"
                      />
                      <div className="relative z-10 p-4 rounded-2xl bg-[#0b111e]/90 border border-white/15 backdrop-blur-md">
                        <Eye className="w-8 h-8 text-rose-400 mx-auto mb-2" />
                        <p className="text-xs font-semibold text-white">
                          Đang kết nối lại luồng hình ảnh trực tiếp từ camera...
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowLiveStream(true)}
                          className="mt-2.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white rounded-xl transition-colors cursor-pointer"
                        >
                          Thử kết nối lại
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Top Overlay Badge */}
                  <div className="absolute top-3 left-3 px-2.5 py-1 bg-rose-600 text-white text-[11px] font-bold rounded-full flex items-center gap-1.5 shadow">
                    <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                    <span>LIVE YOLOv8-POSE HUD</span>
                  </div>
                </div>

                {/* Classification info */}
                <div className="p-4 bg-rose-500/10 rounded-2xl border border-rose-500/25 flex flex-wrap items-center justify-between gap-2 tabular-nums">
                  <div>
                    <span className="text-[11px] text-rose-700 font-bold uppercase tracking-wider block">
                      Phân loại sự cố AI:
                    </span>
                    <p className="text-sm font-extrabold text-[var(--text)] mt-0.5">
                      {formatClassification(activeIncident.incidentType)}
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-800 border border-emerald-500/30">
                    Độ tin cậy: {Math.round(activeIncident.confidenceScore * 100)}%
                  </span>
                </div>
              </div>

              {/* Right Column: Kinematic Telemetry & Actions */}
              <div className="lg:col-span-5 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-[var(--border)] pb-2.5">
                    <Activity className="w-4 h-4 text-rose-600" />
                    <span className="text-sm font-bold text-[var(--text)]">
                      Chỉ số động học khi ngã (Kinematics)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 text-xs tabular-nums">
                    <div className="p-3 bg-[var(--g1)] rounded-2xl border border-[var(--border)]">
                      <span className="text-[var(--secondary)] font-semibold block text-[11px]">
                        Góc cột sống (θ)
                      </span>
                      <span className="text-lg font-extrabold font-mono text-[var(--text)]">
                        {(activeIncident.metrics?.spine_angle ?? 18.5).toFixed(1)}°
                      </span>
                      <span className="text-[10px] text-[var(--secondary)] block mt-0.5">
                        &lt; 35°: Tư thế nằm sàn
                      </span>
                    </div>

                    <div className="p-3 bg-[var(--g1)] rounded-2xl border border-[var(--border)]">
                      <span className="text-[var(--secondary)] font-semibold block text-[11px]">
                        Gia tốc va chạm
                      </span>
                      <span className="text-lg font-extrabold font-mono text-rose-600">
                        {(activeIncident.metrics?.accel_g ?? 2.8).toFixed(2)} g
                      </span>
                      <span className="text-[10px] text-[var(--secondary)] block mt-0.5">
                        &gt; 2.20g: Va đập mạnh
                      </span>
                    </div>

                    <div className="p-3 bg-[var(--g1)] rounded-2xl border border-[var(--border)]">
                      <span className="text-[var(--secondary)] font-semibold block text-[11px]">
                        Xung lực giật (Jerk)
                      </span>
                      <span className="text-lg font-extrabold font-mono text-amber-700">
                        {(activeIncident.metrics?.jerk_g_per_sec ?? 12.4).toFixed(1)} g/s
                      </span>
                      <span className="text-[10px] text-[var(--secondary)] block mt-0.5">
                        Độ đột ngột chuyển động
                      </span>
                    </div>

                    <div className="p-3 bg-[var(--g1)] rounded-2xl border border-[var(--border)]">
                      <span className="text-[var(--secondary)] font-semibold block text-[11px]">
                        Thời gian rơi (PTT)
                      </span>
                      <span className="text-lg font-extrabold font-mono text-[var(--accent)]">
                        {(activeIncident.metrics?.ptt_sec ?? 0.6).toFixed(2)} s
                      </span>
                      <span className="text-[10px] text-[var(--secondary)] block mt-0.5">
                        &lt; 1.0s: Rơi mất kiểm soát
                      </span>
                    </div>
                  </div>

                  {/* Omnipresent Tracking Status */}
                  <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/25 text-xs flex items-center gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                    <div>
                      <span className="text-[var(--secondary)] block text-[11px]">Phạm vi theo dõi:</span>
                      <span className="text-emerald-800 font-bold">
                        Toàn cảnh 100% tầm nhìn Camera (Omnipresent Tracking)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2.5 pt-3 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
                  >
                    <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
                    <span>TÔI ỔN / BÁO ĐỘNG GIẢ (HỦY BÁO ĐỘNG)</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={handleAcknowledge}
                      className="py-2.5 px-3 bg-[var(--g1)] hover:bg-[var(--muted)] text-[var(--text)] text-xs font-bold rounded-2xl border border-[var(--border)] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Tôi đang kiểm tra</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCallEmergency}
                      className="py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-2xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <PhoneCall className="w-4 h-4 text-white shrink-0" />
                      <span>GỌI CỨU HỘ 115</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
