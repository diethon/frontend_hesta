import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import {
  AlertTriangle,
  Camera,
  Activity,
  CheckCircle2,
  Volume2,
  VolumeX,
  PhoneCall,
  Flame,
  ArrowLeft,
  ShieldAlert,
  Radio,
  Server,
} from 'lucide-react';
import { fallDetectionService, type FallMetrics } from '../../services/fallDetectionService';

export const FallDetectionPage: React.FC = () => {
  const navigate = useNavigate();
  const [aiConnected, setAiConnected] = useState<boolean>(false);
  const [streamError, setStreamError] = useState<boolean>(false);
  const [state, setState] = useState<string>('IDLE');
  const [metrics, setMetrics] = useState<FallMetrics>({
    spine_angle: 88.5,
    v_norm: 0.05,
    accel_g: 1.02,
    jerk_g_per_sec: 2.4,
    ptt_sec: 0.0,
  });
  const [zone, setZone] = useState<string>('Khu Vực Camera (Toàn Cảnh)');
  const [fps, setFps] = useState<number>(30.0);
  const [isAlert, setIsAlert] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isTriggering, setIsTriggering] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(30);

  // Web Audio Siren Synthesizer
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const sirenIntervalRef = useRef<number | null>(null);

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
    } catch {
      // Audio autoplay policy fallback
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
  }, []);

  // Poll Local AI Status
  useEffect(() => {
    const interval = setInterval(async () => {
      const status = await fallDetectionService.checkAiStatus();
      if (status) {
        setAiConnected(true);
        setState(status.state);
        setZone(status.safe_zone || 'Toàn Cảnh Camera');
        setFps(status.fps || 30.0);
        if (status.metrics) {
          setMetrics(status.metrics);
        }
        if (status.alert || status.state === 'CONFIRMED_FALL') {
          setIsAlert(true);
          startSiren();
        } else {
          setIsAlert(false);
          stopSiren();
        }
      } else {
        setAiConnected(false);
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      stopSiren();
    };
  }, [startSiren, stopSiren]);

  // Countdown timer when alert is active
  useEffect(() => {
    if (!isAlert) {
      setCountdown(30);
      return;
    }
    const timer = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [isAlert]);

  const handleTriggerDemo = async () => {
    setIsTriggering(true);
    await fallDetectionService.triggerDemoFall();
    setTimeout(() => setIsTriggering(false), 800);
  };

  const handleDismiss = async () => {
    stopSiren();
    setIsAlert(false);
    await fallDetectionService.dismissAiLocal();
  };

  const renderPostureBadge = () => {
    if (state === 'CONFIRMED_FALL') {
      return (
        <span className="px-3 py-1.5 rounded-full text-xs font-black bg-red-600 text-white animate-pulse border border-red-400 flex items-center gap-1.5 shadow-lg shadow-red-500/30">
          <AlertTriangle className="w-4 h-4 text-yellow-300" />
          BỊ TÉ NGÃ KHẨN CẤP (FALLEN)
        </span>
      );
    }
    if (state === 'IMPACT' || state === 'UNRESPONSIVE') {
      return (
        <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-orange-500/20 text-orange-300 border border-orange-500/40 flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 text-orange-400" />
          CẢNH BÁO VA ĐẬP / BẤT TỈNH
        </span>
      );
    }
    if (state === 'CONTROLLED_REST' || state === 'LYING') {
      return (
        <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
          ĐANG NẰM (LYING DOWN)
        </span>
      );
    }
    if (state === 'SITTING') {
      return (
        <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          ĐANG NGỒI (SITTING)
        </span>
      );
    }
    return (
      <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
        ĐANG ĐỨNG (STANDING)
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/home')}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            Trang chủ HESTA
          </button>
          <div className="h-5 w-[1px] bg-slate-700 mx-1" />
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-red-500" />
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              Trung Tâm Giám Sát Thị Giác AI & Cứu Hộ Té Ngã
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {aiConnected ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              AI Edge Online (30 FPS)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-red-950/80 text-red-400 border border-red-500/30 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              Đang kết nối AI Server :5000...
            </span>
          )}

          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title={isMuted ? 'Bật còi cảnh báo' : 'Tắt còi tạm thời'}
          >
            {isMuted ? <VolumeX className="w-5 h-5 text-gray-400" /> : <Volume2 className="w-5 h-5 text-yellow-400" />}
          </button>
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto w-full">
        {/* Left Column: Live Video Feed (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className={`relative rounded-2xl overflow-hidden bg-black border-2 transition-all aspect-video shadow-2xl flex items-center justify-center ${
            isAlert ? 'border-red-500 ring-4 ring-red-500/30 alert-pulse' : 'border-slate-800'
          }`}>
            {!streamError ? (
              <img
                src="http://localhost:5000/video_feed"
                alt="Live AI Vision Stream"
                className="w-full h-full object-contain"
                onError={() => setStreamError(true)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <Camera className="w-16 h-16 text-slate-600 mb-3" />
                <p className="text-sm font-semibold text-slate-300">Không thể tải luồng video AI trực tiếp</p>
                <p className="text-xs text-slate-500 mt-1">Đảm bảo bạn đã chạy file CHAY_DEMO_KHACH_HANG.bat hoặc python ai_hesta/app_server.py</p>
                <button
                  onClick={() => setStreamError(false)}
                  className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white rounded-xl shadow transition-colors"
                >
                  Thử kết nối lại
                </button>
              </div>
            )}

            {/* Overlays */}
            <div className="absolute top-3 left-3 flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-black/60 backdrop-blur-md text-red-400 border border-red-500/30 flex items-center gap-1.5 shadow">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                LIVE YOLOv8 POSE
              </span>
              <span className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold bg-black/60 backdrop-blur-md text-emerald-400 border border-slate-700 shadow">
                {fps.toFixed(1)} FPS
              </span>
            </div>

            <div className="absolute top-3 right-3">
              {renderPostureBadge()}
            </div>

            {/* Bottom Alert Banner if Fall Detected */}
            {isAlert && (
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-red-950 via-red-900/90 to-transparent p-4 flex items-center justify-between text-white">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-6 h-6 text-yellow-300 animate-bounce" />
                  <div>
                    <span className="text-sm font-black uppercase tracking-wider text-yellow-200">
                      CẢNH BÁO TÉ NGÃ KHẨN CẤP
                    </span>
                    <p className="text-xs text-red-200">Tự động kích hoạt còi hú 12V & leo thang SOS sau: {countdown}s</p>
                  </div>
                </div>

                <button
                  onClick={handleDismiss}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition-transform active:scale-95 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Tôi ổn (Hủy)
                </button>
              </div>
            )}
          </div>

          {/* Quick Action Control Bar */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={handleTriggerDemo}
                disabled={isTriggering}
                className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-lg transition-transform hover:scale-105 active:scale-95 flex items-center gap-2"
              >
                <Flame className={`w-4 h-4 ${isTriggering ? 'animate-spin' : 'text-yellow-300 animate-bounce'}`} />
                {isTriggering ? 'Đang kích hoạt...' : 'Bấm Thử Nghiệm Báo Động Té Ngã (Demo Khách Hàng)'}
              </button>

              {isAlert && (
                <button
                  onClick={handleDismiss}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow transition-colors flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Xác nhận an toàn (Tôi ổn)
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
              <Radio className="w-4 h-4 text-emerald-400" />
              <span>Phạm vi theo dõi: </span>
              <strong className="text-slate-200">{zone}</strong>
            </div>
          </div>
        </div>

        {/* Right Column: Telemetry HUD & Status Panel (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Posture & State Card */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">Trạng Thái Nhận Diện</span>
              {renderPostureBadge()}
            </div>

            {/* Kinematic Meters */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-rose-400" />
                Chỉ Số Động Học Thời Gian Thực (Kinematics)
              </h3>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">Góc cột sống (Độ nghiêng θ)</span>
                  <span className="text-xl font-bold font-mono text-amber-300">
                    {(metrics.spine_angle ?? 88.5).toFixed(1)}°
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    {(metrics.spine_angle ?? 88.5) > 65 ? 'Đứng thẳng' : (metrics.spine_angle ?? 88.5) > 35 ? 'Đang ngồi' : 'Đang nằm'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">Vận tốc rơi thẳng đứng (v_norm)</span>
                  <span className="text-xl font-bold font-mono text-cyan-300">
                    {(metrics.v_norm ?? 0.05).toFixed(2)} /s
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">&gt; 1.3 /s: Rơi nhanh</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">Gia tốc va chạm (a_peak)</span>
                  <span className="text-xl font-bold font-mono text-rose-400">
                    {(metrics.accel_g ?? 1.02).toFixed(2)} g
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">&gt; 2.2g: Va đập mặt sàn</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">Độ giật xung lực (Jerk)</span>
                  <span className="text-xl font-bold font-mono text-yellow-300">
                    {(metrics.jerk_g_per_sec ?? 2.4).toFixed(1)} g/s
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Đột ngột chuyển động</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex justify-between items-center text-xs">
                <span className="text-slate-400">Thời gian tư thế (PTT):</span>
                <span className="font-mono font-bold text-slate-200">{(metrics.ptt_sec ?? 0.0).toFixed(2)}s</span>
              </div>
            </div>
          </div>

          {/* System Architecture Details */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3 text-xs">
            <h3 className="font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Server className="w-4 h-4 text-indigo-400" />
              Cấu Trúc Hệ Thống Biên (Edge Architecture)
            </h3>

            <div className="space-y-2 text-slate-400">
              <div className="flex justify-between items-center py-1 border-b border-slate-800">
                <span>Thiết bị AI xử lý:</span>
                <strong className="text-slate-200">Orange Pi 5 Plus (6 TOPS NPU)</strong>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800">
                <span>Mô hình thị giác:</span>
                <strong className="text-indigo-400 font-mono">YOLOv8-pose (COCO 17 Kpts)</strong>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800">
                <span>Nguồn Camera hiện tại:</span>
                <span className="text-amber-300 font-semibold">Webcam Laptop (Chuyển RTSP trong config.py)</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span>Thiết bị cảnh báo ngoại vi:</span>
                <span className="text-emerald-400 font-semibold">ESP32 + Relay Còi Hú 12V</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => window.open('tel:115', '_self')}
                className="w-full py-2.5 bg-red-700/80 hover:bg-red-600 text-white font-bold rounded-xl shadow transition-colors flex items-center justify-center gap-2"
              >
                <PhoneCall className="w-4 h-4" />
                Khẩn Cấp: Gọi Cứu Hộ 115
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
