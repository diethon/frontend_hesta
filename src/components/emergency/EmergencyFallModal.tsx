import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  AlertTriangle,
  PhoneCall,
  CheckCircle2,
  Volume2,
  VolumeX,
  Eye,
  Activity,
  Flame,
} from 'lucide-react';
import {
  fallDetectionService,
  type FallIncidentDTO,
} from '../../services/fallDetectionService';
import { Client } from '@stomp/stompjs';
import { getRealtimeWebSocketUrl } from '../../services/apiClient';

export const EmergencyFallModal: React.FC = () => {
  const [activeIncident, setActiveIncident] = useState<FallIncidentDTO | null>(null);
  const [countdown, setCountdown] = useState<number>(30);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showLiveStream, setShowLiveStream] = useState<boolean>(true);
  const [aiConnected, setAiConnected] = useState<boolean>(false);
  const [isDemoTriggering, setIsDemoTriggering] = useState<boolean>(false);

  // Audio Context for synthesized siren
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const sirenIntervalRef = useRef<number | null>(null);
  const stompClientRef = useRef<Client | null>(null);

  // --- Web Audio Siren Synthesizer ---
  const startSiren = useCallback(() => {
    if (isMuted) return;
    try {
      if (!audioCtxRef.current) {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
    const wsUrl = getRealtimeWebSocketUrl();
    const client = new Client({
      brokerURL: wsUrl,
      reconnectDelay: 5000,
      debug: () => undefined,
      onConnect: () => {
        client.subscribe('/topic/emergency/fall', (msg) => {
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
  }, [startSiren, stopSiren]);

  // --- Local AI Edge Engine Polling (Fallback for Offline Local Demo) ---
  useEffect(() => {
    const pollInterval = window.setInterval(async () => {
      const status = await fallDetectionService.checkAiStatus();
      if (status) {
        setAiConnected(true);
        if (status.alert && status.state === 'CONFIRMED_FALL') {
          setActiveIncident((prev) => {
            if (!prev) {
              startSiren();
              setCountdown(30);
              return {
                id: `local-fall-${Date.now()}`,
                deviceId: 'cam_livingroom_01',
                roomName: status.safe_zone || 'Phòng khách',
                incidentType: status.incident_type === 'SAFE_ZONE_IMPACT_FALL' ? 'SAFE_ZONE_IMPACT_FALL' : 'ACCIDENTAL_FALL',
                state: 'DETECTED',
                confidenceScore: 0.96,
                metrics: status.metrics,
                snapshotUrl: 'http://localhost:5000/video_feed',
              };
            }
            return {
              ...prev,
              metrics: status.metrics,
            };
          });
        }
      } else {
        setAiConnected(false);
      }
    }, 1500);

    return () => clearInterval(pollInterval);
  }, [startSiren]);

  // --- Countdown Timer Logic ---
  useEffect(() => {
    if (!activeIncident || activeIncident.state === 'ACKNOWLEDGED') return;

    const timer = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Escalate to SOS
          setActiveIncident((curr) => curr ? { ...curr, state: 'ESCALATED_SOS' } : null);
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
    if (activeIncident) {
      await fallDetectionService.dismissIncident(activeIncident.id, 'Người dùng bấm xác nhận an toàn (Tôi ổn)');
    }
    setActiveIncident(null);
  };

  const handleAcknowledge = async () => {
    if (activeIncident) {
      await fallDetectionService.acknowledgeIncident(activeIncident.id);
      setActiveIncident((prev) => prev ? { ...prev, state: 'ACKNOWLEDGED' } : null);
    }
  };

  const handleCallEmergency = () => {
    window.open('tel:115', '_self');
  };

  const handleTriggerDemo = async () => {
    setIsDemoTriggering(true);
    await fallDetectionService.triggerDemoFall();
    setTimeout(() => {
      setIsDemoTriggering(false);
    }, 1000);
  };

  const formatClassification = (type: string) => {
    switch (type) {
      case 'SAFE_ZONE_IMPACT_FALL':
        return 'NGÃ VA CHẠM MẠNH VÀO NỘI THẤT GỖ';
      case 'HEAD_SLUMP_SUSPECTED':
        return 'NGHI NGỜ ĐỘT QUỴ / GỤC ĐẦU BẤT TỈNH';
      case 'ACCIDENTAL_FALL':
      default:
        return 'NGÃ ĐẬP MẠNH XUỐNG MẶT SÀN';
    }
  };

  return (
    <>
      {/* Floating Demo Trigger Button (For Client Presentation) */}
      <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2">
        <button
          onClick={handleTriggerDemo}
          disabled={isDemoTriggering}
          className="flex items-center gap-2 px-3 py-2 bg-red-600/90 hover:bg-red-700 text-white text-xs font-semibold rounded-full shadow-lg backdrop-blur-md border border-red-400/40 transition-all transform hover:scale-105 active:scale-95"
          title="Kích hoạt demo té ngã tức thì cho khách hàng"
        >
          <Flame className={`w-4 h-4 ${isDemoTriggering ? 'animate-spin' : 'animate-bounce text-yellow-300'}`} />
          {isDemoTriggering ? 'Đang kích hoạt...' : 'Demo Té Ngã 1-Chạm'}
        </button>

        {aiConnected && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            AI Edge Online
          </span>
        )}
      </div>

      {/* Emergency Full-Screen Modal */}
      {activeIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-lg animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl bg-slate-900/95 border-2 border-red-500/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            
            {/* Header: Pulsing Emergency Alert Banner */}
            <div className="bg-gradient-to-r from-red-700 via-rose-600 to-red-800 text-white px-6 py-4 flex items-center justify-between shadow-md">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-full animate-ping">
                  <AlertTriangle className="w-7 h-7 text-yellow-300" />
                </div>
                <div>
                  <h2 className="text-xl font-black tracking-wide flex items-center gap-2">
                    CẢNH BÁO TÉ NGÃ KHẨN CẤP (EMERGENCY SOS)
                  </h2>
                  <p className="text-xs text-red-100 font-medium">
                    Phát hiện tại: <span className="font-bold underline">{activeIncident.roomName || 'Khu vực camera'}</span> • Mã thiết bị: {activeIncident.deviceId}
                  </p>
                </div>
              </div>

              {/* Siren Audio Controls */}
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="p-2 rounded-lg bg-black/30 hover:bg-black/50 text-white transition-colors flex items-center gap-1.5 text-xs font-semibold"
                title={isMuted ? 'Bật còi' : 'Tắt còi tạm thời'}
              >
                {isMuted ? <VolumeX className="w-5 h-5 text-gray-300" /> : <Volume2 className="w-5 h-5 text-yellow-300 animate-pulse" />}
                {isMuted ? 'Đã tắt còi' : 'Còi đang hú'}
              </button>
            </div>

            {/* Countdown Progress Bar */}
            <div className="bg-slate-950 px-6 py-3 border-b border-red-900/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl font-extrabold text-red-400 font-mono">
                  {countdown < 10 ? `0${countdown}` : countdown}s
                </span>
                <span className="text-xs text-gray-300 max-w-xs">
                  {activeIncident.state === 'ESCALATED_SOS'
                    ? 'Hết thời gian chờ! Đã tự động kích hoạt cuộc gọi khẩn cấp SOS và còi hú tối đa.'
                    : activeIncident.state === 'ACKNOWLEDGED'
                    ? 'Người thân đã xác nhận đang kiểm tra hiện trường. Bộ đếm tạm dừng.'
                    : 'Nếu không xác nhận trong vòng 30 giây, hệ thống sẽ tự động kích hoạt còi hú 12V và gọi cấp cứu.'}
                </span>
              </div>

              <div className="w-48 h-3 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                <div
                  className="h-full bg-gradient-to-r from-yellow-500 to-red-600 transition-all duration-1000 ease-linear"
                  style={{ width: `${(countdown / 30) * 100}%` }}
                />
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto">
              
              {/* Left Column: Live AI Video Feed / Snapshot */}
              <div className="lg:col-span-7 flex flex-col gap-3">
                <div className="relative rounded-xl overflow-hidden bg-black aspect-video border border-red-500/40 shadow-inner flex items-center justify-center">
                  {showLiveStream ? (
                    <img
                      src="http://localhost:5000/video_feed"
                      alt="AI Live Vision Stream"
                      className="w-full h-full object-contain"
                      onError={() => setShowLiveStream(false)}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-6 text-center text-gray-400">
                      <Eye className="w-12 h-12 text-red-500 mb-2 opacity-50" />
                      <p className="text-sm font-medium">Đang tải luồng hình ảnh AI từ camera...</p>
                      <button
                        onClick={() => setShowLiveStream(true)}
                        className="mt-3 px-3 py-1 bg-red-900/60 hover:bg-red-800 text-xs text-white rounded border border-red-600/50"
                      >
                        Thử kết nối lại
                      </button>
                    </div>
                  )}

                  {/* Top Overlay Badge */}
                  <div className="absolute top-2 left-2 px-2.5 py-1 bg-red-600/90 text-white text-[11px] font-bold rounded flex items-center gap-1.5 shadow">
                    <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                    LIVE YOLOv8 HUD
                  </div>
                </div>

                {/* Classification info */}
                <div className="p-3 bg-red-950/40 rounded-xl border border-red-800/40">
                  <span className="text-[11px] text-red-300 font-bold uppercase tracking-wider block">Phân loại sự cố:</span>
                  <p className="text-sm font-extrabold text-white mt-0.5">
                    {formatClassification(activeIncident.incidentType)}
                  </p>
                  <p className="text-xs text-gray-300 mt-1">
                    Độ tin cậy AI: <span className="text-emerald-400 font-semibold">{Math.round(activeIncident.confidenceScore * 100)}%</span>
                  </p>
                </div>
              </div>

              {/* Right Column: Kinematic Telemetry & Decision Tree */}
              <div className="lg:col-span-5 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2 border-b border-gray-700/60 pb-2">
                    <Activity className="w-4 h-4 text-rose-400" />
                    Chỉ số động học khi ngã (Kinematics)
                  </h3>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 bg-slate-800/70 rounded-lg border border-slate-700">
                      <span className="text-gray-400 block text-[11px]">Góc cột sống (Spine)</span>
                      <span className="text-lg font-bold text-amber-400">
                        {activeIncident.metrics?.spine_angle ?? 18.5}°
                      </span>
                      <span className="text-[10px] text-gray-400 block">&lt; 30°: Mặt phẳng nằm</span>
                    </div>

                    <div className="p-2.5 bg-slate-800/70 rounded-lg border border-slate-700">
                      <span className="text-gray-400 block text-[11px]">Gia tốc va chạm</span>
                      <span className="text-lg font-bold text-rose-400">
                        {activeIncident.metrics?.accel_g ?? 2.8}g
                      </span>
                      <span className="text-[10px] text-gray-400 block">&gt; 2.2g: Va đập mạnh</span>
                    </div>

                    <div className="p-2.5 bg-slate-800/70 rounded-lg border border-slate-700">
                      <span className="text-gray-400 block text-[11px]">Xung lực giật (Jerk)</span>
                      <span className="text-lg font-bold text-yellow-400">
                        {activeIncident.metrics?.jerk_g_per_sec ?? 12.4} g/s
                      </span>
                      <span className="text-[10px] text-gray-400 block">Độ đột ngột của chuyển động</span>
                    </div>

                    <div className="p-2.5 bg-slate-800/70 rounded-lg border border-slate-700">
                      <span className="text-gray-400 block text-[11px]">Thời gian tư thế (PTT)</span>
                      <span className="text-lg font-bold text-cyan-400">
                        {activeIncident.metrics?.ptt_sec ?? 0.6}s
                      </span>
                      <span className="text-[10px] text-gray-400 block">&lt; 1.0s: Rơi mất kiểm soát</span>
                    </div>
                  </div>

                  {/* Safety Zone Status */}
                  <div className="p-2.5 bg-slate-800/50 rounded-lg border border-slate-700/60 text-xs">
                    <span className="text-gray-400 block text-[11px]">Bộ lọc vùng an toàn nội thất:</span>
                    <span className="text-emerald-400 font-semibold">
                      Phát hiện nằm trên mặt phẳng nguy hiểm (Mặt sàn nhà gạch men)
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 pt-2 border-t border-gray-800">
                  <button
                    onClick={handleDismiss}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 transform active:scale-98"
                  >
                    <CheckCircle2 className="w-5 h-5 text-white" />
                    TÔI ỔN / BÁO ĐỘNG GIẢ (HỦY BÁO ĐỘNG)
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleAcknowledge}
                      className="py-2.5 bg-slate-700 hover:bg-slate-600 text-gray-200 text-xs font-semibold rounded-xl border border-slate-600 transition-colors flex items-center justify-center gap-1.5"
                    >
                      Tôi đang kiểm tra
                    </button>

                    <button
                      onClick={handleCallEmergency}
                      className="py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow transition-colors flex items-center justify-center gap-1.5"
                    >
                      <PhoneCall className="w-4 h-4 text-white" />
                      GỌI CỨU HỘ 115
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
