import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router';
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
  ShieldCheck,
  Check,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Sliders,
} from 'lucide-react';
import { useAppSelector } from '../../store/hooks';
import { DashboardNavRail } from '../home/DashboardNavRail';
import { DashboardBottomNav } from '../home/DashboardBottomNav';
import { VoiceAssistantButton } from '../ui/VoiceAssistant';
import { NotificationBell } from '../notification/NotificationBell';
import { fallDetectionService, type FallMetrics } from '../../services/fallDetectionService';

export const FallDetectionPage: React.FC = () => {
  const navigate = useNavigate();
  const { homeId: routeHomeId } = useParams<{ homeId: string }>();
  const authUser = useAppSelector((state) => state.auth.user);
  const storedHomeId = typeof window !== 'undefined' ? localStorage.getItem('currentHomeId') || undefined : undefined;
  const homeId = routeHomeId || storedHomeId;
  const userInitial = authUser?.fullName ? authUser.fullName.charAt(0).toUpperCase() : 'H';

  const [, setAiConnected] = useState<boolean>(false);
  const [isCameraOnline, setIsCameraOnline] = useState<boolean>(true);
  const [streamError, setStreamError] = useState<boolean>(false);
  const [state, setState] = useState<string>('IDLE');
  const [metrics, setMetrics] = useState<FallMetrics>({
    spine_angle: 88.5,
    v_norm: 0.05,
    accel_g: 1.02,
    jerk_g_per_sec: 2.4,
    ptt_sec: 0.0,
  });
  const [zone, setZone] = useState<string>('Phòng khách');
  const [, setFps] = useState<number>(30.0);
  const [isAlert, setIsAlert] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isTriggering, setIsTriggering] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(30);
  const [showTechDetails, setShowTechDetails] = useState<boolean>(false);

  // Web Audio Siren Synthesizer
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const sirenIntervalRef = useRef<number | null>(null);

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
    return () => events.forEach((evt) => window.removeEventListener(evt, unlockAudio));
  }, []);

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
        setZone(
          status.safe_zone && !status.safe_zone.includes('Omnipresent')
            ? status.safe_zone
            : 'Phòng khách'
        );
        setFps(status.fps || 30.0);

        if (typeof status.is_camera_online === 'boolean') {
          setIsCameraOnline(status.is_camera_online);
        } else if (status.camera_health) {
          setIsCameraOnline(status.camera_health.is_online);
        } else {
          setIsCameraOnline(true);
        }

        if (status.metrics) {
          setMetrics(status.metrics);
        }
        if (status.alert || status.state === 'CONFIRMED_FALL') {
          setIsAlert((prev) => {
            if (!prev) {
              setCountdown(30);
              startSiren();
            }
            return true;
          });
        } else {
          setIsAlert(false);
          setCountdown(30);
          stopSiren();
        }
      } else {
        setAiConnected(false);
        setIsCameraOnline(false);
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      stopSiren();
    };
  }, [startSiren, stopSiren]);

  // Countdown timer when alert is active
  useEffect(() => {
    if (!isAlert) return;
    const timer = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [isAlert]);

  const handleTriggerDemo = async () => {
    setIsTriggering(true);
    setCountdown(30);
    await fallDetectionService.triggerDemoFall();
    setTimeout(() => setIsTriggering(false), 800);
  };

  const handleDismiss = async () => {
    stopSiren();
    setIsAlert(false);
    setCountdown(30);
    await fallDetectionService.dismissAiLocal();
    const activeIncidents = await fallDetectionService.getActiveIncidents();
    await Promise.all(
      activeIncidents.map((inc) =>
        fallDetectionService.dismissIncident(inc.id, 'Người dùng xác nhận an toàn')
      )
    );
  };

  const getPipelineStage = (currentState: string, alertActive: boolean): number => {
    if (alertActive) return 5;
    if (currentState === 'CONFIRMED_FALL') return 4;
    if (currentState === 'IMPACT' || currentState === 'UNRESPONSIVE') return 3;
    if (
      currentState === 'BENDING' ||
      currentState === 'SITTING' ||
      currentState === 'CONTROLLED_REST' ||
      currentState === 'LYING'
    ) {
      return 2;
    }
    return 1;
  };

  const activeStage = getPipelineStage(state, isAlert);

  const pipelineStages = [
    { step: 1, title: 'Đứng / Đi lại', desc: 'Sinh hoạt bình thường' },
    { step: 2, title: 'Cúi / Ngồi nghỉ', desc: 'Tư thế sinh hoạt an toàn' },
    { step: 3, title: 'Phát hiện ngã', desc: 'Chuyển động rơi đột ngột' },
    { step: 4, title: 'Nằm bất động', desc: 'Kiểm tra phản ứng' },
    { step: 5, title: 'Báo động khẩn', desc: 'Hú còi & báo người nhà' },
  ];

  const getHumanPostureLabel = () => {
    if (isAlert || state === 'CONFIRMED_FALL') return 'Phát hiện té ngã khẩn cấp';
    if (state === 'IMPACT' || state === 'UNRESPONSIVE') return 'Phát hiện va chạm mạnh';
    if (state === 'BENDING') return 'Đang cúi người';
    if (state === 'CONTROLLED_REST' || state === 'LYING') return 'Đang nằm nghỉ';
    if (state === 'SITTING') return 'Đang ngồi';
    return 'Đang đứng / Đi lại bình thường';
  };

  const renderPostureBadge = (surface: 'dark' | 'light' = 'dark') => {
    const isDark = surface === 'dark';
    if (isAlert || state === 'CONFIRMED_FALL') {
      return (
        <span className="px-3 py-1.5 rounded-full text-xs font-extrabold bg-rose-600 text-white animate-pulse border border-rose-400 flex items-center gap-1.5 shadow-md">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-200 shrink-0" />
          <span>CẢNH BÁO TÉ NGÃ</span>
        </span>
      );
    }
    if (state === 'IMPACT' || state === 'UNRESPONSIVE') {
      return (
        <span
          className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
            isDark
              ? 'bg-[#0b111e]/85 text-amber-300 border-amber-500/40 backdrop-blur-md'
              : 'bg-amber-500/15 text-amber-800 border-amber-500/30'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span>Theo dõi va chạm</span>
        </span>
      );
    }
    return (
      <span
        className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
          isDark
            ? 'bg-[#0b111e]/85 text-emerald-300 border-emerald-500/40 backdrop-blur-md'
            : 'bg-emerald-500/15 text-emerald-800 border-emerald-500/30'
        }`}
      >
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
        <span>An toàn</span>
      </span>
    );
  };

  const spineVal = metrics.spine_angle ?? 88.5;
  const vNormVal = metrics.v_norm ?? 0.05;
  const accelVal = metrics.accel_g ?? 1.02;
  const jerkVal = metrics.jerk_g_per_sec ?? 2.4;

  return (
    <div className="app-shell">
      <div className="mesh mesh-one" />
      <div className="mesh mesh-two" />
      <div className="mesh mesh-three" />

      <DashboardNavRail
        homeId={homeId}
        activeItem="overview"
        user={authUser || undefined}
        onSelectOverview={() => navigate('/home')}
      />

      <main id="main-content">
        {/* Clean Consumer Topbar */}
        <header className="topbar scenes-topbar">
          <div>
            <span className="eyebrow">AN NINH &amp; CHĂM SÓC GIA ĐÌNH</span>
            <h2>Giám sát an toàn người thân</h2>
          </div>

          <div className="top-actions">
            <VoiceAssistantButton />
            <NotificationBell />
            <div className="avatar">{userInitial}</div>
          </div>
        </header>

        {/* Compact Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-3xl bg-[var(--solid)] border border-[var(--border)] shadow-xs mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/home')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[var(--solid)] border border-[var(--border)] text-xs font-bold text-[var(--text)] hover:bg-[var(--g1)] shadow-xs transition-all cursor-pointer active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Trang chủ</span>
            </button>

            <span
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold border ${
                isCameraOnline && !streamError
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isCameraOnline && !streamError ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              {isCameraOnline && !streamError ? 'Camera đang hoạt động' : 'Camera tạm ngắt'}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsMuted(!isMuted)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[var(--solid)] border border-[var(--border)] text-xs font-bold text-[var(--text)] hover:bg-[var(--g1)] shadow-xs transition-all cursor-pointer active:scale-95"
            >
              {isMuted ? (
                <>
                  <VolumeX className="w-4 h-4 text-[var(--secondary)]" />
                  <span>Đã tắt tiếng còi</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 text-amber-600" />
                  <span>Còi báo động: Bật</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleTriggerDemo}
              disabled={isTriggering}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
            >
              <Flame className={`w-3.5 h-3.5 ${isTriggering ? 'animate-spin' : 'text-amber-200'}`} />
              <span>{isTriggering ? 'Đang kích hoạt...' : 'Thử báo động'}</span>
            </button>
          </div>
        </div>

        {/* Main Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Live Camera View (8 cols) */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            <div className="glass-card glass-g2 p-3 sm:p-4 rounded-3xl border border-[var(--border)] shadow-xs">
              <div
                className={`relative rounded-2xl overflow-hidden bg-[#090d16] border-2 transition-all aspect-video flex items-center justify-center ${
                  isAlert
                    ? 'border-rose-500 ring-4 ring-rose-500/25'
                    : 'border-[#1e293b]'
                }`}
              >
                {!streamError ? (
                  <img
                    src="http://localhost:5000/video_feed"
                    alt="Hình ảnh trực tiếp từ camera phòng khách"
                    className="w-full h-full object-contain"
                    onError={() => setStreamError(true)}
                  />
                ) : (
                  <div className="relative w-full h-full flex flex-col items-center justify-center p-6 text-center">
                    <img
                      src="/camera_living_room.jpg"
                      alt="Khung hình phòng khách"
                      className="absolute inset-0 w-full h-full object-cover opacity-30 pointer-events-none"
                    />
                    <div className="relative z-10 max-w-sm p-6 rounded-2xl bg-[#0b111e]/90 border border-white/15 backdrop-blur-md space-y-3">
                      <div className="w-11 h-11 rounded-2xl bg-white/10 text-cyan-300 flex items-center justify-center mx-auto">
                        <Camera className="w-5 h-5" />
                      </div>
                      <p className="text-sm font-bold text-white">
                        Camera phòng khách đang tạm ngắt
                      </p>
                      <p className="text-xs text-white/75 leading-relaxed">
                        Hình ảnh trực tiếp sẽ tự động hiển thị khi camera kết nối lại.
                      </p>
                      <button
                        type="button"
                        onClick={() => setStreamError(false)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white rounded-xl shadow transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Kết nối lại camera</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Clean Top-Left Location Badge */}
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#0b111e]/85 backdrop-blur-md text-white border border-white/15 flex items-center gap-1.5 shadow">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    <span>{zone}</span>
                  </span>
                </div>

                {/* Top-Right Status Badge */}
                <div className="absolute top-3 right-3">
                  {renderPostureBadge('dark')}
                </div>

                {/* Bottom Emergency Alert Banner */}
                {isAlert && (
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-[#450a0a] via-[#7f1d1d]/95 to-transparent p-4 flex flex-wrap items-center justify-between gap-3 text-white">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-rose-600/40 border border-rose-400/40">
                        <AlertTriangle className="w-6 h-6 text-amber-300 animate-pulse" />
                      </div>
                      <div className="tabular-nums">
                        <span className="text-sm font-black uppercase tracking-wider text-amber-200 block">
                          PHÁT HIỆN TÉ NGÃ KHẨN CẤP
                        </span>
                        <p className="text-xs text-white/90">
                          Tự động gọi cứu hộ sau: <strong>{countdown} giây</strong>
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleDismiss}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition-transform active:scale-95 flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Tôi ổn (Tắt báo động)</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Collapsible Technical AI Drawer (Hidden by default so user UI stays clean) */}
            <div className="glass-card glass-g2 px-5 py-3.5 rounded-3xl border border-[var(--border)] shadow-xs">
              <button
                type="button"
                onClick={() => setShowTechDetails((prev) => !prev)}
                className="w-full flex items-center justify-between text-xs font-semibold text-[var(--secondary)] hover:text-[var(--text)] transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>Thông số phân tích AI &amp; Quy trình 5 bước</span>
                </span>
                <span className="flex items-center gap-1 text-[11px] text-[var(--accent)]">
                  {showTechDetails ? 'Thu gọn' : 'Xem chi tiết'}
                  {showTechDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </span>
              </button>

              {showTechDetails && (
                <div className="mt-4 pt-4 border-t border-[var(--border)]/60 space-y-4">
                  {/* 5-Step Pipeline */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {pipelineStages.map((stg) => {
                      const isCurrent = activeStage === stg.step;
                      const isPassed = activeStage > stg.step;

                      let cardStyle = 'bg-[var(--g1)] border-[var(--border)] text-[var(--secondary)]';
                      if (isCurrent) {
                        cardStyle =
                          stg.step >= 4
                            ? 'bg-rose-600 text-white border-rose-500 shadow-sm'
                            : 'bg-emerald-600 text-white border-emerald-500 shadow-sm';
                      } else if (isPassed) {
                        cardStyle = 'bg-[var(--accent-soft)] border-[var(--accent)]/30 text-[var(--accent)]';
                      }

                      return (
                        <div
                          key={stg.step}
                          className={`p-2.5 rounded-2xl border transition-all text-left flex flex-col justify-between gap-1 ${cardStyle}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase opacity-80">
                              Bước {stg.step}
                            </span>
                            {isPassed && !isCurrent && <Check className="w-3 h-3" />}
                          </div>
                          <div className="text-xs font-bold leading-tight">{stg.title}</div>
                          <p className="text-[10px] opacity-80 leading-snug">{stg.desc}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* 4 Compact Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 tabular-nums text-xs">
                    <div className="p-3 rounded-2xl bg-[var(--g1)] border border-[var(--border)]">
                      <span className="text-[10px] text-[var(--secondary)] block">Độ nghiêng cơ thể</span>
                      <strong className="text-base font-extrabold font-mono text-[var(--text)]">
                        {spineVal.toFixed(0)}°
                      </strong>
                    </div>
                    <div className="p-3 rounded-2xl bg-[var(--g1)] border border-[var(--border)]">
                      <span className="text-[10px] text-[var(--secondary)] block">Tốc độ hạ trọng tâm</span>
                      <strong className="text-base font-extrabold font-mono text-[var(--accent)]">
                        {vNormVal.toFixed(2)} /s
                      </strong>
                    </div>
                    <div className="p-3 rounded-2xl bg-[var(--g1)] border border-[var(--border)]">
                      <span className="text-[10px] text-[var(--secondary)] block">Lực va chạm</span>
                      <strong className="text-base font-extrabold font-mono text-rose-600">
                        {accelVal.toFixed(2)} g
                      </strong>
                    </div>
                    <div className="p-3 rounded-2xl bg-[var(--g1)] border border-[var(--border)]">
                      <span className="text-[10px] text-[var(--secondary)] block">Độ đột ngột</span>
                      <strong className="text-base font-extrabold font-mono text-amber-600">
                        {jerkVal.toFixed(1)} g/s
                      </strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Clean Family Status & Emergency Actions (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="glass-card glass-g2 p-5 rounded-3xl border border-[var(--border)] shadow-xs space-y-5">
              {/* Big Reassuring Status Header */}
              <div
                className={`p-4 rounded-2xl border flex items-center gap-3.5 ${
                  isAlert
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                    : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-800 dark:text-emerald-300'
                }`}
              >
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                    isAlert ? 'bg-rose-600 text-white animate-pulse' : 'bg-emerald-600 text-white'
                  }`}
                >
                  {isAlert ? <AlertTriangle className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
                </div>
                <div>
                  <div className="text-sm font-extrabold">
                    {isAlert ? 'Phát hiện nguy cơ té ngã!' : 'Người thân đang an toàn'}
                  </div>
                  <p className="text-xs opacity-85 mt-0.5">
                    {isAlert
                      ? `Tự động phát cảnh báo khẩn cấp sau ${countdown}s`
                      : 'Chưa ghi nhận sự cố bất thường'}
                  </p>
                </div>
              </div>

              {/* 3 Simple User-Centric Info Rows */}
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between py-2 border-b border-[var(--border)]/60">
                  <span className="text-[var(--secondary)] flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-[var(--accent)]" />
                    Trạng thái hiện tại
                  </span>
                  <strong className="text-[var(--text)] font-bold">{getHumanPostureLabel()}</strong>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-[var(--border)]/60">
                  <span className="text-[var(--secondary)]">Khu vực theo dõi</span>
                  <strong className="text-[var(--text)] font-bold">{zone}</strong>
                </div>

                <div className="flex items-center justify-between py-2">
                  <span className="text-[var(--secondary)]">Tự động báo động</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                    Đang bật (24/7)
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5 pt-1">
                {isAlert && (
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-2xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Xác nhận an toàn (Tắt còi)</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => window.open('tel:115', '_self')}
                  className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-2xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <PhoneCall className="w-4 h-4" />
                  <span>Gọi Cấp Cứu Y Tế 115</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <DashboardBottomNav
        activeItem="overview"
        homeId={homeId}
        onSelectOverview={() => navigate('/home')}
      />
    </div>
  );
};
