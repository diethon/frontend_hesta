import React, { useState, useEffect, useRef } from 'react';
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
  Filter
} from 'lucide-react';
import type { MqttPacket } from '../../types/diagnostics';
import { getMqttPackets } from '../../services/diagnosticsApi';
import { notify } from '../ui/notify';

export const MqttSnifferConsole: React.FC = () => {
  const [packets, setPackets] = useState<MqttPacket[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'INBOUND' | 'OUTBOUND'>('ALL');
  const [isPaused, setIsPaused] = useState(false);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const consoleEndRef = useRef<HTMLDivElement>(null);

  const fetchPackets = async () => {
    try {
      setLoading(true);
      const res = await getMqttPackets();
      if (Array.isArray(res) && res.length > 0) {
        setPackets(res);
      }
    } catch {
      // Backend fallback handled gracefully
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPackets();
  }, []);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      fetchPackets();
    }, 4000);
    return () => clearInterval(interval);
  }, [isPaused]);

  useEffect(() => {
    if (isAutoScroll && consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [packets, isAutoScroll]);

  const handleCopyPayload = (id: string, text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    notify('Đã sao chép payload vào bộ nhớ tạm', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClear = () => {
    setPackets([]);
    notify('Đã xóa log console', 'info');
  };

  const filteredPackets = packets.filter((pkt) => {
    const matchDirection = directionFilter === 'ALL' || pkt.direction === directionFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchQuery =
      !q ||
      pkt.topic.toLowerCase().includes(q) ||
      pkt.payloadSummary.toLowerCase().includes(q);
    return matchDirection && matchQuery;
  });

  return (
    <div className="surface-card p-5 sm:p-6 rounded-2xl border border-line shadow-xs space-y-4">
      {/* ── Console Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-line pb-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-text flex items-center gap-2">
            <Terminal className="w-5 h-5 text-amber-500" />
            Live MQTT Packet Sniffer &amp; Telemetry Console
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Giám sát luồng gói tin INBOUND/OUTBOUND thời gian thực giữa Cloud Core và ESP32 Gateway Nodes.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsPaused(!isPaused)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition shadow-xs ${
              isPaused
                ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                : 'bg-surface text-text border-line hover:bg-off-soft'
            }`}
            title={isPaused ? 'Tiếp tục bắt gói tin' : 'Tạm dừng bắt gói tin'}
          >
            {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" /> : <Pause className="w-3.5 h-3.5 text-amber-600" />}
            {isPaused ? 'Tiếp tục' : 'Tạm dừng'}
          </button>

          <button
            type="button"
            onClick={() => setIsAutoScroll(!isAutoScroll)}
            className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl border transition shadow-xs ${
              isAutoScroll
                ? 'bg-primary/10 text-primary border-primary/30'
                : 'bg-surface text-muted border-line hover:text-text'
            }`}
            title="Tự động cuộn xuống dưới khi có gói tin mới"
          >
            Auto-scroll: {isAutoScroll ? 'BẬT' : 'TẮT'}
          </button>

          <button
            type="button"
            onClick={fetchPackets}
            disabled={loading}
            className="p-1.5 text-muted hover:text-text rounded-xl border border-line bg-surface hover:bg-off-soft transition"
            title="Làm mới thủ công"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleClear}
            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl border border-rose-200 transition"
            title="Xóa danh sách gói tin trên màn hình"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Search & Filter Bar ── */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Lọc theo topic (vd: hesta/homes/+/devices) hoặc payload JSON..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-line bg-surface text-text placeholder-muted focus:outline-none focus:border-primary"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto shrink-0">
          <Filter className="w-3.5 h-3.5 text-muted shrink-0" />
          {(['ALL', 'INBOUND', 'OUTBOUND'] as const).map((dir) => (
            <button
              key={dir}
              type="button"
              onClick={() => setDirectionFilter(dir)}
              className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border transition ${
                directionFilter === dir
                  ? 'bg-primary text-white border-primary shadow-xs'
                  : 'bg-surface text-muted border-line hover:text-text hover:bg-off-soft'
              }`}
            >
              {dir === 'ALL' ? 'Tất cả' : dir === 'INBOUND' ? 'IN (Thu)' : 'OUT (Phát)'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Terminal Console Output Window ── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs overflow-hidden shadow-inner">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3 text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="ml-2 font-bold text-slate-300">CONSOLE LOG ({filteredPackets.length} gói tin)</span>
          </div>
          <span className="text-[10px] text-slate-500">Bấm dòng để mở rộng JSON đầy đủ</span>
        </div>

        <div className="max-h-96 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
          {filteredPackets.length === 0 ? (
            <div className="py-12 text-center text-slate-500 italic">
              {loading ? 'Đang lắng nghe gói tin MQTT...' : 'Không có gói tin nào phù hợp với bộ lọc.'}
            </div>
          ) : (
            filteredPackets.map((pkt) => {
              const isInbound = pkt.direction === 'INBOUND';
              const isExpanded = expandedId === pkt.id;
              const formattedTime = pkt.timestamp
                ? new Date(pkt.timestamp).toLocaleTimeString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    fractionalSecondDigits: 3,
                  })
                : '12:00:00.000';

              return (
                <div
                  key={pkt.id}
                  onClick={() => setExpandedId(isExpanded ? null : pkt.id)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                    isExpanded
                      ? 'bg-slate-900 border-slate-700 shadow-md'
                      : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-900 hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      {/* Timestamp */}
                      <span className="text-slate-500 text-[11px]">
                        [{formattedTime}]
                      </span>

                      {/* Direction Badge */}
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                          isInbound
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                        }`}
                      >
                        {isInbound ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                        {pkt.direction}
                      </span>

                      {/* QoS badge */}
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                        QoS {pkt.qos ?? 0}
                      </span>

                      {/* Topic */}
                      <span className="text-amber-400 font-bold break-all">
                        {pkt.topic}
                      </span>
                    </div>

                    {/* Copy action */}
                    <button
                      type="button"
                      onClick={(e) => handleCopyPayload(pkt.id, pkt.payloadSummary, e)}
                      className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 transition shrink-0 self-end sm:self-auto"
                      title="Sao chép nội dung payload"
                    >
                      {copiedId === pkt.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Đã chép</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Payload Summary preview */}
                  <div className="mt-2 text-slate-300 text-[11px] bg-slate-950/80 p-2 rounded-lg border border-slate-800/80 overflow-x-auto">
                    {isExpanded ? (
                      <pre className="whitespace-pre-wrap font-mono text-emerald-300">
                        {(() => {
                          try {
                            return JSON.stringify(JSON.parse(pkt.payloadSummary), null, 2);
                          } catch {
                            return pkt.payloadSummary;
                          }
                        })()}
                      </pre>
                    ) : (
                      <p className="truncate font-mono text-slate-400">
                        {pkt.payloadSummary}
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
    </div>
  );
};
