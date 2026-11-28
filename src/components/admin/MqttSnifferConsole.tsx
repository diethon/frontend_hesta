import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import {
  Terminal,
  Search,
  Pause,
  Play,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  RotateCcw,
  X,
  Home,
  Cpu,
  Globe,
} from 'lucide-react';
import type { MqttPacket, NodeDiagnostics } from '../../types/diagnostics';
import { getMqttPackets, getNodeDiagnostics } from '../../services/diagnosticsApi';
import { notify } from '../ui/notify';
import { getErrorMessage } from '../../utils/errors';

export const MqttSnifferConsole: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [globalStreamEnabled, setGlobalStreamEnabled] = useState<boolean>(false);
  const [nodes, setNodes] = useState<NodeDiagnostics[]>([]);
  const [packets, setPackets] = useState<MqttPacket[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'INBOUND' | 'OUTBOUND'>('ALL');
  const [isPaused, setIsPaused] = useState(false);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [loadedTargetKey, setLoadedTargetKey] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [clearedAtMs, setClearedAtMs] = useState<number | null>(null);

  const consoleEndRef = useRef<HTMLDivElement>(null);

  const selectedHomeId = globalStreamEnabled ? 'ALL' : searchParams.get('homeId') || 'ALL';
  const selectedNodeCode = globalStreamEnabled ? '' : searchParams.get('node') || '';

  // Load nodes list once to populate Home / Node selectors
  useEffect(() => {
    void getNodeDiagnostics()
      .then((list) => {
        if (Array.isArray(list)) setNodes(list);
      })
      .catch(() => {
        // Silent metadata fallback
      });
  }, []);

  const hasTargetedSelection =
    Boolean(selectedNodeCode.trim()) ||
    (Boolean(selectedHomeId) && selectedHomeId !== 'ALL') ||
    globalStreamEnabled;

  const targetKey = globalStreamEnabled
    ? 'GLOBAL'
    : selectedNodeCode.trim()
    ? `NODE:${selectedNodeCode.trim()}`
    : selectedHomeId !== 'ALL'
    ? `HOME:${selectedHomeId}`
    : 'NONE';

  const initialLoading = hasTargetedSelection && loadedTargetKey !== targetKey;

  const updateTargetInUrl = (nextHomeId: string, nextNodeCode: string) => {
    const next: Record<string, string> = { tab: 'mqtt' };
    if (nextHomeId && nextHomeId !== 'ALL') next.homeId = nextHomeId;
    if (nextNodeCode) next.node = nextNodeCode;
    setSearchParams(next, { replace: true });
  };

  const queryParams = useMemo(
    () =>
      globalStreamEnabled
        ? undefined
        : {
            nodeCode: selectedNodeCode.trim() || undefined,
            homeId:
              !selectedNodeCode.trim() && selectedHomeId !== 'ALL' ? selectedHomeId : undefined,
          },
    [globalStreamEnabled, selectedNodeCode, selectedHomeId]
  );

  const handleManualRefresh = async () => {
    if (!hasTargetedSelection) return;
    setIsRefreshing(true);
    try {
      const res = await getMqttPackets(queryParams);
      if (Array.isArray(res)) {
        setPackets(res);
      }
      setLoadedTargetKey(targetKey);
    } catch (err) {
      notify.error(
        'Không thể tải luồng gói tin MQTT',
        getErrorMessage(err, 'Vui lòng kiểm tra kết nối backend')
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!hasTargetedSelection) return;
    let cancelled = false;

    const runFetch = async (silent: boolean) => {
      try {
        const res = await getMqttPackets(queryParams);
        if (!cancelled) {
          if (Array.isArray(res)) {
            setPackets(res);
          }
          setLoadedTargetKey(targetKey);
        }
      } catch (err) {
        if (!cancelled) {
          if (!silent) {
            notify.error(
              'Không thể tải luồng gói tin MQTT',
              getErrorMessage(err, 'Vui lòng kiểm tra kết nối backend')
            );
          }
          setLoadedTargetKey(targetKey);
        }
      }
    };

    void runFetch(false);
    if (isPaused) {
      return () => {
        cancelled = true;
      };
    }

    const interval = setInterval(() => {
      void runFetch(true);
    }, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [hasTargetedSelection, queryParams, targetKey, isPaused]);

  const homeOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const n of nodes) {
      if (!n.homeId) continue;
      const name = n.homeName && n.homeName !== 'N/A' ? n.homeName : 'Nhà chưa đặt tên';
      const existing = map.get(n.homeId) ?? { id: n.homeId, name, count: 0 };
      existing.count += 1;
      map.set(n.homeId, existing);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [nodes]);

  const nodeOptions = useMemo(() => {
    const base =
      selectedHomeId && selectedHomeId !== 'ALL'
        ? nodes.filter((n) => n.homeId === selectedHomeId)
        : nodes;
    return [...base].sort((a, b) => {
      if (a.status === 'ONLINE' && b.status !== 'ONLINE') return -1;
      if (a.status !== 'ONLINE' && b.status === 'ONLINE') return 1;
      return a.nodeCode.localeCompare(b.nodeCode);
    });
  }, [nodes, selectedHomeId]);

  const quickPickNodes = useMemo(() => {
    return [...nodes]
      .sort((a, b) => {
        if (a.status === 'ONLINE' && b.status !== 'ONLINE') return -1;
        if (a.status !== 'ONLINE' && b.status === 'ONLINE') return 1;
        return a.nodeCode.localeCompare(b.nodeCode);
      })
      .slice(0, 8);
  }, [nodes]);

  const handleCopyPayload = (id: string, text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    notify.success('Đã sao chép payload vào bộ nhớ tạm');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClear = () => {
    setClearedAtMs(Date.now());
    notify.info('Đã ẩn các gói tin cũ trên màn hình', 'Chỉ hiển thị gói tin mới phát sinh từ thời điểm này');
  };

  const handleRestoreHistory = () => {
    setClearedAtMs(null);
    notify.info('Đã hiện lại toàn bộ gói tin trong bộ đệm của mục tiêu');
  };

  const isPktInbound = (dir?: string) => dir === 'INBOUND' || dir === 'IN';
  const isPktOutbound = (dir?: string) => dir === 'OUTBOUND' || dir === 'OUT';

  const visibleBuffer = useMemo(() => {
    if (clearedAtMs === null) return packets;
    return packets.filter((pkt) => {
      const ts = pkt.timestamp ? new Date(pkt.timestamp).getTime() : 0;
      return ts > clearedAtMs;
    });
  }, [packets, clearedAtMs]);

  const hiddenCount = packets.length - visibleBuffer.length;
  const inboundCount = useMemo(
    () => visibleBuffer.filter((p) => isPktInbound(p.direction)).length,
    [visibleBuffer]
  );
  const outboundCount = useMemo(
    () => visibleBuffer.filter((p) => isPktOutbound(p.direction)).length,
    [visibleBuffer]
  );

  const filteredPackets = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return visibleBuffer.filter((pkt) => {
      const matchDirection =
        directionFilter === 'ALL' ||
        (directionFilter === 'INBOUND' && isPktInbound(pkt.direction)) ||
        (directionFilter === 'OUTBOUND' && isPktOutbound(pkt.direction));
      const matchQuery =
        !q ||
        pkt.topic.toLowerCase().includes(q) ||
        pkt.payloadSummary.toLowerCase().includes(q);
      return matchDirection && matchQuery;
    });
  }, [visibleBuffer, directionFilter, searchQuery]);

  useEffect(() => {
    if (isAutoScroll && consoleEndRef.current && filteredPackets.length > 0) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [filteredPackets.length, isAutoScroll]);

  const activeTargetLabel = useMemo(() => {
    if (globalStreamEnabled) return 'GLOBAL STREAM (50 gói toàn hệ thống)';
    if (selectedNodeCode) {
      const matched = nodes.find((n) => n.nodeCode === selectedNodeCode);
      const hName = matched?.homeName && matched.homeName !== 'N/A' ? ` · ${matched.homeName}` : '';
      return `Node ${selectedNodeCode}${hName} (tối đa 100 gói riêng)`;
    }
    if (selectedHomeId && selectedHomeId !== 'ALL') {
      const hName = homeOptions.find((h) => h.id === selectedHomeId)?.name || selectedHomeId;
      return `Tất cả Node thuộc ${hName} (tối đa 100 gói)`;
    }
    return 'Chưa chọn mục tiêu soi gói tin';
  }, [globalStreamEnabled, selectedNodeCode, selectedHomeId, nodes, homeOptions]);

  return (
    <div className="rounded-3xl border border-line bg-surface/95 backdrop-blur-sm shadow-soft p-5 sm:p-6 space-y-4 tabular-nums">
      {/* ── Console Header ── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 border-b border-line/70 pb-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-text flex items-center gap-2">
            <Terminal className="w-5 h-5 text-primary shrink-0" />
            <span>MQTT Packet Sniffer Mục Tiêu (Debug Theo Nhà / Node)</span>
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Cô lập bộ đệm riêng 100 gói tin cho từng Edge Node hoặc Ngôi nhà để tránh trôi gói và bảo vệ riêng tư khi vận hành 100+ nhà.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            disabled={!hasTargetedSelection}
            onClick={() => setIsPaused(!isPaused)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors shadow-2xs cursor-pointer disabled:opacity-40 ${
              isPaused
                ? 'bg-error-soft text-rose-700 border-rose-200 hover:brightness-95'
                : 'bg-surface text-text border-line hover:bg-sidebar-hover/70'
            }`}
          >
            {isPaused ? (
              <Play className="w-3.5 h-3.5 text-emerald-700 fill-emerald-700" />
            ) : (
              <Pause className="w-3.5 h-3.5 text-sky-700" />
            )}
            <span>{isPaused ? 'Tiếp tục' : 'Tạm dừng'}</span>
          </button>

          <button
            type="button"
            disabled={!hasTargetedSelection}
            onClick={() => setIsAutoScroll(!isAutoScroll)}
            className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors shadow-2xs cursor-pointer disabled:opacity-40 ${
              isAutoScroll
                ? 'bg-info-soft text-sky-700 border-sky-200'
                : 'bg-surface text-muted border-line hover:text-text hover:bg-sidebar-hover/70'
            }`}
          >
            <span>Auto-scroll: {isAutoScroll ? 'BẬT' : 'TẮT'}</span>
          </button>

          <button
            type="button"
            onClick={() => void handleManualRefresh()}
            disabled={isRefreshing || !hasTargetedSelection}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-text rounded-xl border border-line bg-surface hover:bg-sidebar-hover/70 transition-colors cursor-pointer disabled:opacity-40"
            title="Làm mới thủ công"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-primary' : 'text-muted'}`} />
            <span className="hidden sm:inline">Làm mới</span>
          </button>

          {clearedAtMs !== null && hiddenCount > 0 && (
            <button
              type="button"
              onClick={handleRestoreHistory}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-sky-700 bg-info-soft border border-sky-200 hover:brightness-95 rounded-xl transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Hiện lại ({hiddenCount})</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleClear}
            disabled={visibleBuffer.length === 0}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-error-soft border border-rose-200 hover:brightness-95 rounded-xl transition-colors cursor-pointer disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Xóa màn hình</span>
          </button>
        </div>
      </div>

      {/* ── Target Home & Edge Node Picker Bar ── */}
      <div className="rounded-2xl border border-line bg-sidebar/55 p-3.5 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        <div className="md:col-span-4 space-y-1">
          <label className="text-[11px] font-semibold text-muted flex items-center gap-1">
            <Home className="w-3 h-3 text-sky-700" />
            <span>1. Chọn Ngôi nhà (Home)</span>
          </label>
          <select
            aria-label="Chọn ngôi nhà để soi gói tin"
            value={selectedHomeId}
            onChange={(e) => {
              const nextHome = e.target.value;
              setGlobalStreamEnabled(false);
              setPackets([]);
              setClearedAtMs(null);
              updateTargetInUrl(nextHome, '');
            }}
            className="w-full min-h-[38px] px-3 py-1.5 text-xs sm:text-sm rounded-xl border border-line bg-surface text-text font-medium focus:outline-none focus:border-primary"
          >
            <option value="ALL">-- Chọn một Ngôi nhà --</option>
            {homeOptions.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name} ({h.count} node)
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-5 space-y-1">
          <label className="text-[11px] font-semibold text-muted flex items-center gap-1">
            <Cpu className="w-3 h-3 text-sky-700" />
            <span>2. Chọn Edge Node cụ thể</span>
          </label>
          <select
            aria-label="Chọn Edge Node để soi gói tin"
            value={selectedNodeCode}
            onChange={(e) => {
              const nextNode = e.target.value;
              setGlobalStreamEnabled(false);
              setPackets([]);
              setClearedAtMs(null);
              const matched = nodes.find((n) => n.nodeCode === nextNode);
              const nextHome = matched?.homeId || selectedHomeId;
              updateTargetInUrl(nextHome, nextNode);
            }}
            className="w-full min-h-[38px] px-3 py-1.5 text-xs sm:text-sm rounded-xl border border-line bg-surface text-text font-mono font-medium focus:outline-none focus:border-primary"
          >
            <option value="">
              {selectedHomeId !== 'ALL'
                ? '-- Tất cả Node thuộc nhà đang chọn --'
                : '-- Chọn một Edge Node --'}
            </option>
            {nodeOptions.map((n) => (
              <option key={n.nodeId} value={n.nodeCode}>
                [{n.status}] {n.nodeCode}
                {n.homeName && n.homeName !== 'N/A' ? ` (${n.homeName})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3 flex items-end justify-start md:justify-end h-full pt-1 md:pt-4">
          <button
            type="button"
            onClick={() => {
              const nextGlobal = !globalStreamEnabled;
              setGlobalStreamEnabled(nextGlobal);
              setPackets([]);
              if (nextGlobal) {
                updateTargetInUrl('ALL', '');
              }
              setClearedAtMs(null);
            }}
            className={`w-full md:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-colors cursor-pointer ${
              globalStreamEnabled
                ? 'bg-warning-soft border-amber-300 text-amber-800'
                : 'bg-surface border-line text-muted hover:text-text hover:bg-sidebar-hover/60'
            }`}
            title="Bật chế độ xem luồng 50 gói gần nhất của toàn bộ hệ thống"
          >
            <Globe className="w-3.5 h-3.5 shrink-0" />
            <span>{globalStreamEnabled ? 'Đang xem Luồng tổng' : 'Xem Luồng tổng'}</span>
          </button>
        </div>
      </div>

      {/* ── Search & Direction Filter Bar ── */}
      {hasTargetedSelection && (
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Lọc nhanh theo topic hoặc nội dung payload JSON..."
              className="w-full min-h-[40px] pl-10 pr-8 py-2 text-xs sm:text-sm rounded-2xl border border-line bg-sidebar/70 text-text placeholder:text-muted/80 focus:outline-none focus:border-primary focus:bg-surface transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Xóa bộ lọc tìm kiếm"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted hover:text-text cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
            <Filter className="w-3.5 h-3.5 text-muted shrink-0 mr-0.5" />
            {(
              [
                { id: 'ALL', label: `Tất cả (${visibleBuffer.length})` },
                { id: 'INBOUND', label: `INBOUND (${inboundCount})` },
                { id: 'OUTBOUND', label: `OUTBOUND (${outboundCount})` },
              ] as const
            ).map((dir) => (
              <button
                key={dir.id}
                type="button"
                onClick={() => setDirectionFilter(dir.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors cursor-pointer ${
                  directionFilter === dir.id
                    ? 'bg-primary text-white border-primary shadow-2xs'
                    : 'bg-surface text-muted border-line hover:text-text hover:bg-sidebar-hover/60'
                }`}
              >
                {dir.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Body: Target Prompt OR High-Contrast Dark Terminal Window ── */}
      {!hasTargetedSelection ? (
        <div className="rounded-2xl border border-dashed border-line bg-sidebar/40 p-6 sm:p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-info-soft border border-sky-200 text-sky-700 flex items-center justify-center mx-auto">
            <Terminal className="w-6 h-6" />
          </div>
          <div className="space-y-1.5 max-w-xl mx-auto">
            <div className="text-sm sm:text-base font-bold text-text">
              Chọn Ngôi nhà hoặc Edge Node cần gỡ lỗi để bắt đầu soi gói tin
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Để tránh nhiễu dữ liệu từ 100+ ngôi nhà khác và không làm trôi bộ đệm 50 gói toàn cục, chế độ mặc định chỉ lấy luồng gói tin tách biệt của đúng Ngôi nhà hoặc Node bạn chọn.
            </p>
          </div>

          {quickPickNodes.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                Chọn nhanh một Node để soi ngay
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {quickPickNodes.map((n) => (
                  <button
                    key={n.nodeId}
                    type="button"
                    onClick={() => {
                      setGlobalStreamEnabled(false);
                      setPackets([]);
                      setClearedAtMs(null);
                      updateTargetInUrl(n.homeId || 'ALL', n.nodeCode);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-line bg-surface hover:border-primary hover:bg-info-soft text-xs font-mono font-semibold text-text transition-colors cursor-pointer"
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        n.status === 'ONLINE' ? 'bg-emerald-500 animate-pulse' : 'bg-muted/50'
                      }`}
                    />
                    <span>{n.nodeCode}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-[#1e2d45] bg-[#0b1424] text-[#e2e8f0] p-4 font-mono text-xs overflow-hidden shadow-inner">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1e2d45] pb-2.5 mb-3 text-[11px] text-[#94a3b8]">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="w-2.5 h-2.5 rounded-full bg-[#fb7185]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#38bdf8]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#34d399]" />
              <span className="ml-1 font-bold text-[#f1f5f9]">
                {activeTargetLabel} &bull; {filteredPackets.length} gói
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                  isPaused
                    ? 'bg-[#3b1824] text-[#fda4af] border-[#881337]'
                    : 'bg-[#0f2e28] text-[#6ee7b7] border-[#065f46]'
                }`}
              >
                {isPaused ? 'PAUSED' : 'LIVE · 2s'}
              </span>
            </div>
            <span className="text-[10px] text-[#94a3b8]">Nhấn vào gói tin để mở rộng JSON</span>
          </div>

          <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {initialLoading ? (
              <div className="py-12 text-center text-[#94a3b8]">
                Đang tải bộ đệm gói tin của mục tiêu...
              </div>
            ) : filteredPackets.length === 0 ? (
              <div className="py-12 text-center text-[#94a3b8]">
                {visibleBuffer.length === 0
                  ? 'Chưa ghi nhận gói tin MQTT nào cho mục tiêu này. Hãy thử bấm Ping RTT hoặc điều khiển một thiết bị thuộc nhà này.'
                  : 'Không có gói tin nào khớp với điều kiện lọc.'}
              </div>
            ) : (
              filteredPackets.map((pkt, idx) => {
                const isInbound = isPktInbound(pkt.direction);
                const packetKey = pkt.id || `${pkt.timestamp}-${pkt.topic}-${idx}`;
                const isExpanded = expandedId === packetKey;
                const formattedTime = pkt.timestamp
                  ? new Date(pkt.timestamp).toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      fractionalSecondDigits: 3,
                    })
                  : '--:--:--.---';

                return (
                  <div
                    key={packetKey}
                    onClick={() => setExpandedId(isExpanded ? null : packetKey)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isExpanded
                        ? 'bg-[#15233d] border-[#38bdf8]/70 shadow-md'
                        : 'bg-[#111d33] border-[#1e2d45] hover:border-[#38bdf8]/40 hover:bg-[#14223a]'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="text-[#94a3b8] text-[11px]">[{formattedTime}]</span>

                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                            isInbound
                              ? 'bg-[#064e3b]/60 text-[#6ee7b7] border-[#059669]/50'
                              : 'bg-[#0c4a6e]/60 text-[#7dd3fc] border-[#0284c7]/50'
                          }`}
                        >
                          {isInbound ? (
                            <ArrowDownLeft className="w-3 h-3" />
                          ) : (
                            <ArrowUpRight className="w-3 h-3" />
                          )}
                          {isInbound ? 'INBOUND' : 'OUTBOUND'}
                        </span>

                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#070d18] text-[#cbd5e1] border border-[#1e2d45]">
                          QoS {pkt.qos ?? 0}
                        </span>

                        <span className="text-[#7dd3fc] font-semibold break-all">{pkt.topic}</span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleCopyPayload(packetKey, pkt.payloadSummary, e)}
                        className="inline-flex items-center gap-1 text-[11px] text-[#cbd5e1] hover:text-white px-2.5 py-1 rounded-lg bg-[#070d18] hover:bg-[#1e2d45] border border-[#1e2d45] transition shrink-0 self-end sm:self-auto cursor-pointer"
                      >
                        {copiedId === packetKey ? (
                          <>
                            <Check className="w-3 h-3 text-[#34d399]" />
                            <span className="text-[#34d399]">Đã chép</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="mt-2 text-[11px] bg-[#070d18] text-[#6ee7b7] p-2.5 rounded-lg border border-[#1e2d45] overflow-x-auto">
                      {isExpanded ? (
                        <pre className="whitespace-pre-wrap font-mono text-[#6ee7b7]">
                          {(() => {
                            try {
                              return JSON.stringify(JSON.parse(pkt.payloadSummary), null, 2);
                            } catch {
                              return pkt.payloadSummary;
                            }
                          })()}
                        </pre>
                      ) : (
                        <p className="truncate font-mono text-[#6ee7b7]/90">
                          {pkt.payloadSummary || '(empty payload)'}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={consoleEndRef} />
          </div>
        </div>
      )}
    </div>
  );
};
