import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Activity,
  Radio,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Send,
  AlertTriangle,
  Server,
  Zap,
  Search,
  Cpu,
  Home,
  CheckCircle2,
  X,
  Terminal,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  LayoutGrid,
  List,
} from 'lucide-react';
import type { DiagnosticsSummary, NodeDiagnostics } from '../../types/diagnostics';
import {
  getDiagnosticsSummary,
  getNodeDiagnostics,
  resetNodeCircuitBreaker,
  tripNodeCircuitBreaker,
  pingNode,
} from '../../services/diagnosticsApi';
import { notify } from '../ui/notify';
import { getErrorMessage } from '../../utils/errors';

export const LatencyGaugeArc: React.FC<{
  avgLatencyMs: number;
  p95LatencyMs?: number;
  minLatencyMs?: number;
  maxLatencyMs?: number;
}> = ({ avgLatencyMs, p95LatencyMs, minLatencyMs, maxLatencyMs }) => {
  const maxVal = 150;
  const clampedAvg = Math.min(Math.max(avgLatencyMs, 0), maxVal);
  const p95 = p95LatencyMs ?? Math.round(avgLatencyMs * 1.35);

  const needleAngle = 180 + (clampedAvg / maxVal) * 180;
  const needleRad = (needleAngle * Math.PI) / 180;
  const cx = 90;
  const cy = 76;
  const needleLen = 46;
  const nx = cx + needleLen * Math.cos(needleRad);
  const ny = cy + needleLen * Math.sin(needleRad);

  const getGaugeTone = (val: number) => {
    if (val === 0) return 'text-text';
    if (val < 50) return 'text-emerald-700';
    if (val <= 100) return 'text-amber-700';
    return 'text-rose-700';
  };

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div className="relative w-44 h-20">
        <svg viewBox="0 0 180 88" className="w-full h-full overflow-visible" aria-hidden="true">
          <path
            d="M 28 76 A 62 62 0 0 1 152 76"
            fill="none"
            stroke="#e8f2f7"
            strokeWidth="12"
            strokeLinecap="round"
          />
          <path
            d="M 28 76 A 62 62 0 0 1 59 22.3"
            fill="none"
            stroke="#22c58a"
            strokeWidth="8.5"
            strokeLinecap="round"
          />
          <path d="M 63 20 A 62 62 0 0 1 117 20" fill="none" stroke="#f5b841" strokeWidth="8.5" />
          <path
            d="M 121 22.3 A 62 62 0 0 1 152 76"
            fill="none"
            stroke="#ef6b6b"
            strokeWidth="8.5"
            strokeLinecap="round"
          />

          <text x="24" y="87" fontSize="8" fill="#6b7c8f" textAnchor="middle" fontWeight="700">
            0ms
          </text>
          <text x="53" y="13" fontSize="8" fill="#6b7c8f" textAnchor="middle" fontWeight="700">
            50
          </text>
          <text x="127" y="13" fontSize="8" fill="#6b7c8f" textAnchor="middle" fontWeight="700">
            100
          </text>
          <text x="157" y="87" fontSize="8" fill="#6b7c8f" textAnchor="middle" fontWeight="700">
            150+
          </text>

          <line
            x1={cx}
            y1={cy}
            x2={nx}
            y2={ny}
            stroke="#3a4a5a"
            strokeWidth="3.5"
            strokeLinecap="round"
            className="transition-all duration-300"
          />
          <circle cx={cx} cy={cy} r="5.5" fill="#3a4a5a" />
          <circle cx={cx} cy={cy} r="2.2" fill="#ffffff" />
        </svg>
      </div>

      <div className="text-center w-full mt-1">
        <div className="flex items-baseline justify-center gap-1">
          <span className={`text-xl font-extrabold tracking-tight ${getGaugeTone(avgLatencyMs)}`}>
            {avgLatencyMs}
          </span>
          <span className="text-xs font-semibold text-muted">
            {avgLatencyMs === 0 ? 'ms (Chưa đo)' : 'ms (Avg RTT)'}
          </span>
        </div>

        <div className="mt-2.5 grid grid-cols-4 gap-1.5 text-[10px] font-mono">
          <div className="rounded-xl bg-sidebar/80 border border-line/70 px-1.5 py-1.5">
            <span className="block text-muted text-[9px] uppercase tracking-wide">Min</span>
            <span className="font-bold text-text whitespace-nowrap">{minLatencyMs ?? 0}ms</span>
          </div>
          <div className="rounded-xl bg-sidebar/80 border border-line/70 px-1.5 py-1.5">
            <span className="block text-muted text-[9px] uppercase tracking-wide">Avg</span>
            <span className="font-bold text-sky-700 whitespace-nowrap">{avgLatencyMs}ms</span>
          </div>
          <div className="rounded-xl bg-sidebar/80 border border-line/70 px-1.5 py-1.5">
            <span className="block text-muted text-[9px] uppercase tracking-wide">P95</span>
            <span className="font-bold text-text whitespace-nowrap">
              {avgLatencyMs === 0 ? 0 : p95}ms
            </span>
          </div>
          <div className="rounded-xl bg-sidebar/80 border border-line/70 px-1.5 py-1.5">
            <span className="block text-muted text-[9px] uppercase tracking-wide">Max</span>
            <span className="font-bold text-text whitespace-nowrap">{maxLatencyMs ?? 0}ms</span>
          </div>
        </div>
      </div>
    </div>
  );
};

interface HomeGroup {
  homeKey: string;
  homeId?: string;
  homeName: string;
  nodes: NodeDiagnostics[];
  onlineCount: number;
  quarantinedCount: number;
}

interface NodeDiagnosticsWidgetProps {
  onStatsChange?: () => void;
  onInspectNode?: (nodeCode: string, homeId?: string) => void;
}

export const NodeDiagnosticsWidget: React.FC<NodeDiagnosticsWidgetProps> = ({
  onStatsChange,
  onInspectNode,
}) => {
  const [summary, setSummary] = useState<DiagnosticsSummary | null>(null);
  const [nodes, setNodes] = useState<NodeDiagnostics[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pingingId, setPingingId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [trippingCode, setTrippingCode] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [homeFilter, setHomeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ONLINE' | 'OFFLINE' | 'QUARANTINED'>('ALL');
  const [viewMode, setViewMode] = useState<'GROUPED' | 'TABLE'>('GROUPED');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [expandedHomeOverrides, setExpandedHomeOverrides] = useState<Record<string, boolean>>({});
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const fetchData = useCallback(
    async ({ silent = false, manual = false }: { silent?: boolean; manual?: boolean } = {}) => {
      if (manual) setIsRefreshing(true);
      try {
        const [sumRes, nodeRes] = await Promise.all([
          getDiagnosticsSummary(),
          getNodeDiagnostics(),
        ]);
        setSummary(sumRes);
        setNodes(nodeRes);
        const now = new Date();
        setLastUpdatedAt(now);
        setNowMs(now.getTime());
      } catch (e) {
        if (!silent) {
          notify.error(
            'Không thể tải dữ liệu chẩn đoán',
            getErrorMessage(e, 'Vui lòng kiểm tra kết nối máy chủ')
          );
        }
      } finally {
        setInitialLoading(false);
        if (manual) setIsRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData();
    const interval = setInterval(() => {
      void fetchData({ silent: true });
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handlePing = async (nodeId: string, nodeCode: string) => {
    setPingingId(nodeId);
    try {
      const updated = await pingNode(nodeId);
      setNodes((prev) => prev.map((n) => (n.nodeId === nodeId ? updated : n)));
      notify.success(
        `Ping ${nodeCode} thành công`,
        `RTT: ${updated.averageLatencyMs} ms (P95: ${updated.p95LatencyMs ?? updated.averageLatencyMs} ms)`
      );
      void fetchData({ silent: true });
      onStatsChange?.();
    } catch (err: unknown) {
      notify.error(
        `Ping ${nodeCode} thất bại`,
        getErrorMessage(err, `Không nhận được phản hồi Pong từ Edge Node ${nodeCode}`)
      );
      void fetchData({ silent: true });
      onStatsChange?.();
    } finally {
      setPingingId(null);
    }
  };

  const handleResetCircuit = async (nodeId: string, nodeCode: string) => {
    setResettingId(nodeId);
    try {
      const updated = await resetNodeCircuitBreaker(nodeId);
      setNodes((prev) => prev.map((n) => (n.nodeId === nodeId ? updated : n)));
      notify.success(
        `Đã khôi phục Circuit Breaker (${nodeCode})`,
        'Mạch bảo vệ đã chuyển về trạng thái CLOSED và cho phép gửi lệnh trở lại'
      );
      void fetchData({ silent: true });
      onStatsChange?.();
    } catch (err: unknown) {
      notify.error(
        `Lỗi khôi phục mạch ${nodeCode}`,
        getErrorMessage(err, 'Không thể reset Circuit Breaker')
      );
    } finally {
      setResettingId(null);
    }
  };

  const handleTripCircuit = async (nodeId: string, nodeCode: string) => {
    setTrippingCode(nodeCode);
    try {
      const updated = await tripNodeCircuitBreaker(nodeId);
      setNodes((prev) => prev.map((n) => (n.nodeId === nodeId ? updated : n)));
      notify.warning(
        `Đã ngắt mạch bảo vệ (${nodeCode})`,
        'Mạch chuyển sang trạng thái OPEN để cô lập tạm thời các lệnh điều khiển'
      );
      void fetchData({ silent: true });
      onStatsChange?.();
    } catch (err: unknown) {
      notify.error(
        `Lỗi ngắt mạch ${nodeCode}`,
        getErrorMessage(err, 'Không thể kích hoạt Trip Circuit Breaker')
      );
    } finally {
      setTrippingCode(null);
    }
  };

  const formatLastSeen = (lastPingAt?: string): string => {
    if (!lastPingAt) return 'Chưa có tín hiệu';
    const diffSec = Math.max(0, Math.floor((nowMs - new Date(lastPingAt).getTime()) / 1000));
    if (diffSec < 10) return 'Vừa xong';
    if (diffSec < 60) return `${diffSec}s trước`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} phút trước`;
    return `${Math.floor(diffMin / 60)} giờ trước`;
  };

  const getCircuitBadge = (state: string, consecutiveFailures: number) => {
    switch (state) {
      case 'CLOSED':
        return (
          <div className="inline-flex flex-col gap-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-success-soft text-emerald-700 border border-emerald-200 w-fit">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              CLOSED (Ổn định)
            </span>
            {consecutiveFailures > 0 && (
              <span className="text-[10px] font-medium text-amber-700">
                Cảnh báo: {consecutiveFailures} lỗi liên tiếp
              </span>
            )}
          </div>
        );
      case 'OPEN':
        return (
          <div className="inline-flex flex-col gap-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-error-soft text-rose-700 border border-rose-200 animate-pulse w-fit">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              OPEN (Đang cách ly)
            </span>
            <span className="text-[10px] font-medium text-rose-700">
              {consecutiveFailures} lỗi liên tiếp
            </span>
          </div>
        );
      default:
        return (
          <div className="inline-flex flex-col gap-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-warning-soft text-amber-700 border border-amber-200 w-fit">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              HALF_OPEN (Thăm dò)
            </span>
          </div>
        );
    }
  };

  const homeOptions = useMemo(() => {
    const map = new Map<string, { key: string; name: string; total: number; online: number }>();
    for (const n of nodes) {
      const key = n.homeId || 'UNASSIGNED';
      const name = n.homeName && n.homeName !== 'N/A' ? n.homeName : 'Chưa gán ngôi nhà';
      const existing = map.get(key) ?? { key, name, total: 0, online: 0 };
      existing.total += 1;
      if (n.status === 'ONLINE') existing.online += 1;
      map.set(key, existing);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [nodes]);

  const filteredNodes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return nodes.filter((node) => {
      const nodeHomeKey = node.homeId || 'UNASSIGNED';
      if (homeFilter !== 'ALL' && nodeHomeKey !== homeFilter) return false;

      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ONLINE' && node.status === 'ONLINE') ||
        (statusFilter === 'OFFLINE' && node.status !== 'ONLINE') ||
        (statusFilter === 'QUARANTINED' && node.circuitState !== 'CLOSED');
      if (!matchStatus) return false;

      if (!q) return true;
      const attachedText = (node.attachedDeviceTypes || []).join(' ').toLowerCase();
      return (
        node.nodeCode.toLowerCase().includes(q) ||
        (node.homeName || '').toLowerCase().includes(q) ||
        (node.firmwareVersion || '').toLowerCase().includes(q) ||
        (node.deviceType || '').toLowerCase().includes(q) ||
        attachedText.includes(q)
      );
    });
  }, [nodes, homeFilter, statusFilter, searchQuery]);

  const homeGroups = useMemo<HomeGroup[]>(() => {
    const map = new Map<string, HomeGroup>();
    for (const n of filteredNodes) {
      const homeKey = n.homeId || 'UNASSIGNED';
      const homeName = n.homeName && n.homeName !== 'N/A' ? n.homeName : 'Chưa gán ngôi nhà';
      const existing = map.get(homeKey) ?? {
        homeKey,
        homeId: n.homeId,
        homeName,
        nodes: [],
        onlineCount: 0,
        quarantinedCount: 0,
      };
      existing.nodes.push(n);
      if (n.status === 'ONLINE') existing.onlineCount += 1;
      if (n.circuitState !== 'CLOSED') existing.quarantinedCount += 1;
      map.set(homeKey, existing);
    }
    return Array.from(map.values()).sort((a, b) => {
      if (b.quarantinedCount !== a.quarantinedCount) return b.quarantinedCount - a.quarantinedCount;
      return a.homeName.localeCompare(b.homeName, 'vi');
    });
  }, [filteredNodes]);

  const totalItems = viewMode === 'GROUPED' ? homeGroups.length : filteredNodes.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);

  const pagedHomeGroups = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return homeGroups.slice(start, start + pageSize);
  }, [homeGroups, safePage, pageSize]);

  const pagedFlatNodes = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredNodes.slice(start, start + pageSize);
  }, [filteredNodes, safePage, pageSize]);

  const isHomeExpanded = (homeKey: string) => {
    if (homeKey in expandedHomeOverrides) return expandedHomeOverrides[homeKey];
    if (homeFilter !== 'ALL' || searchQuery.trim().length > 0) return true;
    return homeGroups.length <= 5;
  };

  const toggleHomeAccordion = (homeKey: string) => {
    const current = isHomeExpanded(homeKey);
    setExpandedHomeOverrides((prev) => ({ ...prev, [homeKey]: !current }));
  };

  const renderDeviceTypeChips = (node: NodeDiagnostics) => {
    const types = node.attachedDeviceTypes || [];
    const shown = types.slice(0, 3);
    const rest = types.length - shown.length;
    return (
      <div className="flex items-center gap-1 flex-wrap mt-0.5">
        {node.firmwareVersion ? (
          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-info-soft text-sky-700 border border-sky-200">
            FW {node.firmwareVersion}
          </span>
        ) : (
          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-sidebar text-muted border border-line/70">
            FW: --
          </span>
        )}
        {(node.attachedDeviceCount ?? 0) > 0 && (
          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-sidebar text-text border border-line/80">
            {node.attachedDeviceCount} thiết bị
          </span>
        )}
        {shown.map((dt) => (
          <span
            key={dt}
            className="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-sidebar text-muted border border-line/70"
          >
            {dt}
          </span>
        ))}
        {rest > 0 && (
          <span
            className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-sidebar text-sky-700 border border-sky-200"
            title={types.join(', ')}
          >
            +{rest} loại
          </span>
        )}
      </div>
    );
  };

  const renderActionButtons = (node: NodeDiagnostics, compactMobile = false) => {
    const isPinging = pingingId === node.nodeId;
    const isResetting = resettingId === node.nodeId;
    const isTripping = trippingCode === node.nodeCode;

    return (
      <div
        className={`flex items-center gap-1.5 flex-wrap ${
          compactMobile ? 'w-full pt-1' : 'justify-end'
        }`}
      >
        {onInspectNode && (
          <button
            type="button"
            onClick={() => onInspectNode(node.nodeCode, node.homeId)}
            className={`inline-flex items-center justify-center gap-1 text-xs font-semibold rounded-xl border border-line bg-surface hover:bg-sidebar-hover/80 text-text transition-colors shadow-2xs cursor-pointer ${
              compactMobile ? 'min-h-[38px] px-3 py-1.5' : 'px-2.5 py-1.5'
            }`}
            title="Mở MQTT Sniffer chỉ soi gói tin của Node này"
          >
            <Terminal className="w-3 h-3 text-sky-700" />
            <span>Soi gói</span>
          </button>
        )}

        <button
          type="button"
          disabled={isPinging}
          onClick={() => handlePing(node.nodeId, node.nodeCode)}
          className={`inline-flex items-center justify-center gap-1 text-xs font-semibold rounded-xl border border-sky-200 bg-info-soft hover:bg-primary hover:text-white hover:border-primary text-sky-700 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer ${
            compactMobile ? 'flex-1 min-h-[38px] px-3 py-1.5' : 'px-2.5 py-1.5'
          }`}
          title="Gửi gói tin MQTT Ping/Pong đo RTT thực tế"
        >
          <Send className={`w-3 h-3 ${isPinging ? 'animate-pulse' : ''}`} />
          <span>{isPinging ? 'Đang Ping...' : 'Ping RTT'}</span>
        </button>

        {node.circuitState !== 'OPEN' && (
          <button
            type="button"
            disabled={isTripping}
            onClick={() => handleTripCircuit(node.nodeId, node.nodeCode)}
            className={`inline-flex items-center justify-center gap-1 text-xs font-semibold rounded-xl border border-line bg-surface hover:bg-warning-soft hover:border-amber-200 text-muted hover:text-amber-700 transition-colors shadow-2xs disabled:opacity-40 cursor-pointer ${
              compactMobile ? 'min-h-[38px] px-3 py-1.5' : 'px-2.5 py-1.5'
            }`}
            title="Ngắt mạch khẩn cấp (Trip Circuit Breaker sang OPEN)"
          >
            <ShieldAlert className={`w-3 h-3 ${isTripping ? 'animate-spin text-rose-600' : ''}`} />
            <span>Ngắt mạch</span>
          </button>
        )}

        {node.circuitState !== 'CLOSED' && (
          <button
            type="button"
            disabled={isResetting}
            onClick={() => handleResetCircuit(node.nodeId, node.nodeCode)}
            className={`inline-flex items-center justify-center gap-1 text-xs font-semibold rounded-xl border border-emerald-200 bg-success-soft text-emerald-700 hover:bg-emerald-600 hover:text-white transition-colors shadow-2xs disabled:opacity-50 cursor-pointer ${
              compactMobile ? 'min-h-[38px] px-3 py-1.5' : 'px-2.5 py-1.5'
            }`}
            title="Khôi phục trạng thái mạch về CLOSED"
          >
            <RefreshCw className={`w-3 h-3 ${isResetting ? 'animate-spin' : ''}`} />
            <span>Khôi phục</span>
          </button>
        )}
      </div>
    );
  };

  const renderNodesCollection = (nodeList: NodeDiagnostics[], showHomeColumn: boolean) => (
    <>
      {/* Mobile Cards (< md) */}
      <div className="md:hidden space-y-3">
        {nodeList.map((node) => {
          const avgMs = node.avgLatencyMs ?? node.averageLatencyMs ?? 0;
          const p95Ms = node.p95LatencyMs ?? Math.round(avgMs * 1.35);

          return (
            <div
              key={node.nodeId}
              className="rounded-2xl border border-line bg-sidebar/40 p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-sky-700 shrink-0" />
                    <span className="font-mono font-bold text-xs text-text break-all">
                      {node.nodeCode}
                    </span>
                  </div>
                  {showHomeColumn && (
                    <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted">
                      <Home className="w-3 h-3 shrink-0" />
                      <span className="truncate">
                        {node.homeName && node.homeName !== 'N/A' ? node.homeName : 'Chưa gán nhà'}
                      </span>
                    </div>
                  )}
                  {renderDeviceTypeChips(node)}
                </div>

                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold shrink-0 border ${
                    node.status === 'ONLINE'
                      ? 'bg-success-soft text-emerald-700 border-emerald-200'
                      : 'bg-surface text-muted border-line'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      node.status === 'ONLINE' ? 'bg-emerald-600 animate-pulse' : 'bg-muted/60'
                    }`}
                  />
                  {node.status}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-line/60">
                {getCircuitBadge(node.circuitState, node.consecutiveFailures)}
                <div className="text-right font-mono text-[11px]">
                  <span className="font-bold text-text">{avgMs}ms</span>{' '}
                  <span className="text-muted">(P95: {p95Ms}ms)</span>
                  <div className="text-[10px] text-muted">
                    Lệnh: {node.successfulCommands}/{node.totalCommands} &bull;{' '}
                    {formatLastSeen(node.lastPingAt)}
                  </div>
                </div>
              </div>

              {renderActionButtons(node, true)}
            </div>
          );
        })}
      </div>

      {/* Desktop Table (>= md) */}
      <div className="hidden md:block overflow-x-auto custom-scrollbar rounded-2xl border border-line/80">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-line text-muted uppercase text-[11px] font-semibold bg-sidebar/70">
              <th className="py-3 px-3.5">Edge Node &amp; Thiết bị gắn kèm</th>
              {showHomeColumn && <th className="py-3 px-3">Ngôi nhà</th>}
              <th className="py-3 px-3">Kết nối &amp; Heartbeat</th>
              <th className="py-3 px-3">Circuit Breaker</th>
              <th className="py-3 px-3 text-center">Độ trễ RTT (ms)</th>
              <th className="py-3 px-3 text-center">Độ tin cậy lệnh</th>
              <th className="py-3 px-3.5 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60 bg-surface">
            {nodeList.map((node) => {
              const avgMs = node.avgLatencyMs ?? node.averageLatencyMs ?? 0;
              const p95Ms = node.p95LatencyMs ?? Math.round(avgMs * 1.35);
              const minMs = node.minLatencyMs ?? 0;
              const maxMs = node.maxLatencyMs ?? avgMs;
              const cmdPct =
                node.totalCommands > 0
                  ? Math.round((node.successfulCommands * 100) / node.totalCommands)
                  : null;

              return (
                <tr
                  key={node.nodeId}
                  className={`hover:bg-sidebar/50 transition-colors ${
                    node.status !== 'ONLINE' ? 'bg-sidebar/25' : ''
                  }`}
                >
                  <td className="py-3.5 px-3.5 max-w-[280px]">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5 text-sky-700 shrink-0" />
                        <span className="font-mono font-bold text-text break-all">
                          {node.nodeCode}
                        </span>
                      </div>
                      {renderDeviceTypeChips(node)}
                    </div>
                  </td>

                  {showHomeColumn && (
                    <td className="py-3.5 px-3 text-muted">
                      <div className="inline-flex items-center gap-1.5 max-w-[160px]">
                        <Home className="w-3.5 h-3.5 text-muted/70 shrink-0" />
                        <span className="truncate text-text font-medium" title={node.homeName}>
                          {node.homeName && node.homeName !== 'N/A' ? node.homeName : 'Chưa gán nhà'}
                        </span>
                      </div>
                    </td>
                  )}

                  <td className="py-3.5 px-3">
                    <div className="flex flex-col gap-1">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold w-fit border ${
                          node.status === 'ONLINE'
                            ? 'bg-success-soft text-emerald-700 border-emerald-200'
                            : 'bg-sidebar text-muted border-line'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            node.status === 'ONLINE' ? 'bg-emerald-600 animate-pulse' : 'bg-muted/60'
                          }`}
                        />
                        {node.status}
                      </span>
                      <span
                        className="text-[10px] text-muted font-mono"
                        title={
                          node.lastPingAt ? new Date(node.lastPingAt).toLocaleString('vi-VN') : ''
                        }
                      >
                        {formatLastSeen(node.lastPingAt)}
                      </span>
                    </div>
                  </td>

                  <td className="py-3.5 px-3">
                    {getCircuitBadge(node.circuitState, node.consecutiveFailures)}
                  </td>

                  <td className="py-3.5 px-3 text-center">
                    <div className="inline-flex flex-col items-center gap-0.5">
                      <span
                        className={`font-mono font-bold px-2.5 py-0.5 rounded-lg text-[11px] border ${
                          avgMs === 0
                            ? 'text-muted bg-sidebar border-line'
                            : avgMs < 50
                            ? 'text-emerald-700 bg-success-soft border-emerald-200'
                            : avgMs <= 100
                            ? 'text-sky-700 bg-info-soft border-sky-200'
                            : 'text-rose-700 bg-error-soft border-rose-200'
                        }`}
                      >
                        {avgMs} ms
                      </span>
                      <span className="text-[10px] text-muted font-mono">
                        P95: {p95Ms}ms &bull; ({minMs}-{maxMs})
                      </span>
                    </div>
                  </td>

                  <td className="py-3.5 px-3 text-center">
                    <div className="inline-flex flex-col items-center">
                      <span className="font-semibold text-text">
                        {node.successfulCommands}/{node.totalCommands}
                      </span>
                      {cmdPct !== null && (
                        <span className="text-[10px] text-muted font-mono">{cmdPct}% đạt</span>
                      )}
                    </div>
                  </td>

                  <td className="py-3.5 px-3.5 text-right">{renderActionButtons(node, false)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );

  const reliabilityPct = summary?.systemReliabilityPct ?? 100;
  const onlineRatio =
    summary && summary.totalNodes > 0
      ? Math.round((summary.onlineNodes * 100) / summary.totalNodes)
      : 0;

  return (
    <div className="space-y-6 tabular-nums">
      {/* ── Summary KPI Cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Card 1: Cloud Broker */}
        <div className="rounded-3xl border border-line bg-surface/95 backdrop-blur-sm shadow-soft p-5 flex flex-col justify-between transition hover:-translate-y-0.5">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-muted">Cloud MQTT Broker Trung Tâm</span>
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                  summary?.brokerConnected
                    ? 'bg-success-soft text-emerald-700 border-emerald-200'
                    : 'bg-error-soft text-rose-700 border-rose-200'
                }`}
              >
                <Server className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`text-xl font-extrabold tracking-tight ${
                  summary
                    ? summary.brokerConnected
                      ? 'text-emerald-700'
                      : 'text-rose-700'
                    : 'text-text'
                }`}
              >
                {summary ? (summary.brokerConnected ? 'CONNECTED' : 'DISCONNECTED') : 'Đang tải...'}
              </div>
              {summary && (
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    summary.brokerConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                  }`}
                />
              )}
            </div>
            <p className="text-[11px] font-mono text-muted mt-1 truncate" title={summary?.brokerUrl}>
              {summary?.brokerUrl || 'tcp://localhost:1883'}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-line/70 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted font-medium">Độ tin cậy lệnh toàn cục</span>
              <span className="font-bold text-text">{reliabilityPct.toFixed(1)}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-sidebar overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  reliabilityPct >= 95
                    ? 'bg-emerald-500'
                    : reliabilityPct >= 80
                    ? 'bg-amber-400'
                    : 'bg-rose-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, reliabilityPct))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 2: Scale - Homes & Edge Nodes */}
        <div className="rounded-3xl border border-line bg-surface/95 backdrop-blur-sm shadow-soft p-5 flex flex-col justify-between transition hover:-translate-y-0.5">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-muted">Ngôi Nhà &amp; Edge Nodes</span>
              <div className="w-9 h-9 bg-info-soft text-sky-700 border border-sky-200 rounded-xl flex items-center justify-center">
                <Radio className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <div className="text-2xl font-extrabold text-text tracking-tight">
                {summary ? `${summary.onlineNodes} / ${summary.totalNodes}` : '...'}
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-info-soft text-sky-700 border border-sky-200">
                {summary?.totalHomes ?? homeOptions.length} ngôi nhà
              </span>
            </div>
            <p className="text-xs text-muted mt-1.5">
              <span className="font-semibold text-text">{summary?.offlineNodes ?? 0}</span> node đang ngoại tuyến
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-line/70 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted font-medium">Tỷ lệ node trực tuyến</span>
              <span className="font-bold text-text">{onlineRatio}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-sidebar overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-mint to-primary transition-all duration-500"
                style={{ width: `${onlineRatio}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 3: Circuit Breaker Quarantined */}
        <div className="rounded-3xl border border-line bg-surface/95 backdrop-blur-sm shadow-soft p-5 flex flex-col justify-between transition hover:-translate-y-0.5">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-muted">Mạch bảo vệ (Circuit Breaker)</span>
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                  (summary?.quarantinedNodes ?? 0) > 0
                    ? 'bg-error-soft text-rose-700 border-rose-200'
                    : 'bg-success-soft text-emerald-700 border-emerald-200'
                }`}
              >
                {(summary?.quarantinedNodes ?? 0) > 0 ? (
                  <ShieldAlert className="w-4 h-4" />
                ) : (
                  <ShieldCheck className="w-4 h-4" />
                )}
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <div
                className={`text-2xl font-extrabold tracking-tight ${
                  (summary?.quarantinedNodes ?? 0) > 0 ? 'text-rose-700' : 'text-emerald-700'
                }`}
              >
                {summary?.quarantinedNodes ?? 0}
              </div>
              <span className="text-xs font-semibold text-muted">Node đang cách ly (OPEN)</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-line/70 flex items-center gap-1.5 text-xs">
            {(summary?.quarantinedNodes ?? 0) === 0 ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span className="text-emerald-700 font-medium">Tất cả mạch đều thông suốt</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-rose-700 shrink-0" />
                <span className="text-rose-700 font-medium">Cần kiểm tra hoặc Reset mạch</span>
              </>
            )}
          </div>
        </div>

        {/* Card 4: Network Reliability & Latency Gauge Arc */}
        <div className="rounded-3xl border border-line bg-surface/95 backdrop-blur-sm shadow-soft p-4 flex flex-col justify-between transition hover:-translate-y-0.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-muted">Độ trễ RTT (100 mẫu)</span>
            <div className="w-7 h-7 bg-info-soft text-sky-700 border border-sky-200 rounded-lg flex items-center justify-center">
              <Zap className="w-3.5 h-3.5" />
            </div>
          </div>
          <LatencyGaugeArc
            avgLatencyMs={summary?.avgLatencyMs ?? summary?.averageLatencyMs ?? 0}
            p95LatencyMs={summary?.p95LatencyMs}
            minLatencyMs={summary?.minLatencyMs}
            maxLatencyMs={summary?.maxLatencyMs}
          />
        </div>
      </div>

      {/* ── Edge Nodes Monitor Panel (100+ Home Scale) ── */}
      <div className="rounded-3xl border border-line bg-surface/95 backdrop-blur-sm shadow-soft p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-text flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary shrink-0" />
              <span>Quản Lý Edge Nodes Theo Ngôi Nhà &amp; Mạch Bảo Vệ</span>
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Hỗ trợ 100+ nhà: gom nhóm theo từng Ngôi nhà hoặc xem bảng phân trang; đo Ping RTT và soi gói MQTT từng Node riêng biệt.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {lastUpdatedAt && (
              <span className="hidden lg:inline text-[11px] font-mono text-muted">
                Cập nhật: {lastUpdatedAt.toLocaleTimeString('vi-VN')}
              </span>
            )}

            {/* View mode toggle */}
            <div className="inline-flex p-1 rounded-xl border border-line bg-sidebar">
              <button
                type="button"
                onClick={() => {
                  setViewMode('GROUPED');
                  setPage(1);
                }}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  viewMode === 'GROUPED'
                    ? 'bg-primary text-white shadow-2xs'
                    : 'text-muted hover:text-text'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Theo Ngôi nhà</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMode('TABLE');
                  setPage(1);
                }}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  viewMode === 'TABLE'
                    ? 'bg-primary text-white shadow-2xs'
                    : 'text-muted hover:text-text'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Bảng phẳng</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => void fetchData({ manual: true })}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-line bg-surface hover:bg-sidebar-hover/70 text-text transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-primary' : 'text-muted'}`}
              />
              <span>Làm mới</span>
            </button>
          </div>
        </div>

        {/* Multi-Home Filter Toolbar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          {/* Search Input */}
          <div className="relative lg:col-span-5">
            <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Tìm mã Node, tên nhà, firmware hoặc thiết bị (vd: LED_RGB, AIR_CONDITIONER)..."
              className="w-full min-h-[40px] pl-10 pr-8 py-2 text-xs sm:text-sm rounded-2xl border border-line bg-sidebar/70 text-text placeholder:text-muted/80 focus:outline-none focus:border-primary focus:bg-surface transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setPage(1);
                }}
                aria-label="Xóa từ khóa tìm kiếm"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted hover:text-text cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Home Dropdown Filter */}
          <div className="lg:col-span-3">
            <select
              aria-label="Lọc theo ngôi nhà"
              value={homeFilter}
              onChange={(e) => {
                setHomeFilter(e.target.value);
                setPage(1);
              }}
              className="w-full min-h-[40px] px-3 py-2 text-xs sm:text-sm rounded-2xl border border-line bg-sidebar/70 text-text font-medium focus:outline-none focus:border-primary focus:bg-surface transition-colors"
            >
              <option value="ALL">
                Tất cả ngôi nhà ({homeOptions.length} nhà · {nodes.length} node)
              </option>
              {homeOptions.map((h) => (
                <option key={h.key} value={h.key}>
                  {h.name} ({h.online}/{h.total} online)
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter Pills */}
          <div className="lg:col-span-4 flex items-center gap-1.5 flex-wrap lg:justify-end">
            {(
              [
                { id: 'ALL', label: `Tất cả (${filteredNodes.length})` },
                { id: 'ONLINE', label: 'Trực tuyến' },
                { id: 'OFFLINE', label: 'Ngoại tuyến' },
                { id: 'QUARANTINED', label: 'Cách ly' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setStatusFilter(opt.id);
                  setPage(1);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors cursor-pointer ${
                  statusFilter === opt.id
                    ? 'bg-primary text-white border-primary shadow-2xs'
                    : 'bg-surface text-muted border-line hover:text-text hover:bg-sidebar-hover/60'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main View Body */}
        {initialLoading ? (
          <div className="py-12 text-center text-xs text-muted rounded-2xl border border-line bg-sidebar/30">
            Đang tải dữ liệu Edge Nodes của toàn bộ các Ngôi nhà...
          </div>
        ) : filteredNodes.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted rounded-2xl border border-line bg-sidebar/30 px-4">
            {nodes.length === 0
              ? 'Chưa có Edge Node phần cứng nào được đăng ký trong hệ thống.'
              : 'Không tìm thấy Edge Node nào khớp với điều kiện lọc hiện tại.'}
          </div>
        ) : viewMode === 'GROUPED' ? (
          <div className="space-y-3">
            {pagedHomeGroups.map((group) => {
              const expanded = isHomeExpanded(group.homeKey);
              return (
                <div
                  key={group.homeKey}
                  className="rounded-2xl border border-line bg-sidebar/30 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleHomeAccordion(group.homeKey)}
                    className="w-full px-4 py-3.5 flex flex-wrap items-center justify-between gap-3 bg-sidebar/60 hover:bg-sidebar-hover/60 transition-colors text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {expanded ? (
                        <ChevronDown className="w-4 h-4 text-muted shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted shrink-0" />
                      )}
                      <span className="w-8 h-8 rounded-xl bg-surface border border-line text-sky-700 flex items-center justify-center shrink-0">
                        <Home className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-text truncate">{group.homeName}</div>
                        <div className="text-[11px] text-muted">
                          {group.nodes.length} Edge Node(s)
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          group.onlineCount > 0
                            ? 'bg-success-soft text-emerald-700 border-emerald-200'
                            : 'bg-surface text-muted border-line'
                        }`}
                      >
                        {group.onlineCount}/{group.nodes.length} trực tuyến
                      </span>
                      {group.quarantinedCount > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-error-soft text-rose-700 border border-rose-200 animate-pulse">
                          {group.quarantinedCount} node bị cách ly
                        </span>
                      )}
                    </div>
                  </button>

                  {expanded && <div className="p-3 sm:p-4 bg-surface">{renderNodesCollection(group.nodes, false)}</div>}
                </div>
              );
            })}
          </div>
        ) : (
          renderNodesCollection(pagedFlatNodes, true)
        )}

        {/* Pagination Bar */}
        {!initialLoading && totalItems > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-line/70 text-xs text-muted">
            <div className="flex items-center gap-2">
              <span>Hiển thị</span>
              <select
                aria-label="Số mục mỗi trang"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="px-2.5 py-1 rounded-xl border border-line bg-surface text-text font-semibold focus:outline-none focus:border-primary"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <span>
                {viewMode === 'GROUPED'
                  ? `ngôi nhà / trang (Tổng ${homeGroups.length} nhà · ${filteredNodes.length} node)`
                  : `node / trang (Tổng ${filteredNodes.length} node)`}
              </span>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-line bg-surface hover:bg-sidebar-hover/70 text-text font-semibold disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Trước</span>
              </button>
              <span className="font-mono font-bold text-text px-2">
                Trang {safePage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-line bg-surface hover:bg-sidebar-hover/70 text-text font-semibold disabled:opacity-40 cursor-pointer"
              >
                <span>Sau</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
