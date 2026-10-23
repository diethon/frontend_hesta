import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  RotateCw,
  Trash2,
  Send,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Radio,
  Copy,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import type { MqttDeadLetter } from '../../types/diagnostics';
import {
  getDeadLetters,
  replayDeadLetter,
  replayAllDeadLetters,
  clearDeadLetters,
} from '../../services/diagnosticsApi';
import { notify } from '../ui/notify';

export const DeadLetterQueueConsole: React.FC = () => {
  const [letters, setLetters] = useState<MqttDeadLetter[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const [isReplayingAll, setIsReplayingAll] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchLetters = async () => {
    setIsLoading(true);
    try {
      const data = await getDeadLetters(50, false);
      setLetters(data);
    } catch {
      notify.error('Lỗi khi tải danh sách Dead-Letter Queue');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLetters();
    const timer = setInterval(fetchLetters, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleReplayOne = async (id: string) => {
    setReplayingId(id);
    try {
      await replayDeadLetter(id);
      notify.success('Replay thành công', 'Đã chuyển tiếp gói tin vào luồng xử lý');
      await fetchLetters();
    } catch {
      notify.error('Replay thất bại');
    } finally {
      setReplayingId(null);
    }
  };

  const handleReplayAll = async () => {
    if (letters.filter((l) => !l.replayed).length === 0) {
      notify.info('Không có thông điệp nào cần replay');
      return;
    }
    setIsReplayingAll(true);
    try {
      const count = await replayAllDeadLetters();
      notify.success(`Đã replay ${count} thông điệp`, 'Hệ thống đã tự động định tuyến lại');
      await fetchLetters();
    } catch {
      notify.error('Lỗi khi replay tất cả');
    } finally {
      setIsReplayingAll(false);
    }
  };

  const handleClear = async () => {
    if (!window.confirm('Bạn có chắc muốn xóa sạch toàn bộ hàng đợi Dead-Letter?')) return;
    try {
      await clearDeadLetters();
      setLetters([]);
      notify.success('Đã xóa sạch Dead-Letter Queue');
    } catch {
      notify.error('Lỗi khi xóa DLQ');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    notify.success('Đã sao chép vào bộ nhớ tạm');
  };

  const unhandledCount = letters.filter((l) => !l.replayed).length;
  const replayedCount = letters.filter((l) => l.replayed).length;

  return (
    <div className="space-y-6">
      {/* KPI Header Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-surface border border-line flex items-center justify-between">
          <div>
            <p className="text-xs text-muted font-medium">Gói Tin Bị Cách Ly (Chưa xử lý)</p>
            <p className="text-2xl font-bold text-red-500 mt-1">{unhandledCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-line flex items-center justify-between">
          <div>
            <p className="text-xs text-muted font-medium">Đã Replay Thành Công</p>
            <p className="text-2xl font-bold text-emerald-500 mt-1">{replayedCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-line flex items-center justify-between">
          <div>
            <p className="text-xs text-muted font-medium">Ingress Rate Limit</p>
            <p className="text-2xl font-bold text-primary mt-1">50 msg/s</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Radio className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-line flex items-center justify-between">
          <div>
            <p className="text-xs text-muted font-medium">Sức Chứa Bộ Đệm Ring</p>
            <p className="text-2xl font-bold text-text mt-1">{letters.length} / 500</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="rounded-2xl border border-line bg-surface overflow-hidden shadow-sm">
        {/* Actions Bar */}
        <div className="p-4 border-b border-line flex flex-wrap items-center justify-between gap-3 bg-surface/50">
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 rounded-full bg-red-500 animate-pulse" />
            <h3 className="text-base font-semibold text-text">
              Danh Sách Gói Tin Bị Cách Ly (Dead-Letter Queue)
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReplayAll}
              disabled={isReplayingAll || unhandledCount === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-hover disabled:opacity-50 transition-all shadow-sm"
              title="Replay toàn bộ thông điệp chưa xử lý"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isReplayingAll ? 'animate-spin' : ''}`} />
              Replay Tất Cả ({unhandledCount})
            </button>

            <button
              onClick={handleClear}
              disabled={letters.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-500/30 text-red-500 hover:bg-red-500/10 text-xs font-semibold disabled:opacity-50 transition-all"
              title="Xóa toàn bộ hàng đợi DLQ"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Xóa Sạch
            </button>

            <button
              onClick={fetchLetters}
              disabled={isLoading}
              className="p-1.5 rounded-xl border border-line text-muted hover:text-text hover:bg-sidebar transition-colors"
              title="Làm mới dữ liệu"
            >
              <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Content Table or Empty State */}
        {letters.length === 0 ? (
          <div className="py-16 px-4 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-4 ring-8 ring-emerald-500/5">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h4 className="text-lg font-bold text-text mb-1">
              Hạ Tầng Sạch Sẽ — Không Có Rác MQTT
            </h4>
            <p className="text-xs text-muted max-w-md mx-auto">
              Tất cả thông điệp từ các Edge Node gửi lên Broker đều đúng định dạng JSON và tuân thủ
              ngưỡng an toàn 50 msg/s.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-line overflow-x-auto">
            {letters.map((item) => {
              const isExpanded = expandedId === item.id;
              const isRateLimit = item.failureReason.includes('RATE_LIMIT');
              const isMalformed = item.failureReason.includes('JSON') || item.failureReason.includes('MALFORMED');

              return (
                <div key={item.id} className="p-4 hover:bg-sidebar/30 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      className="flex items-center gap-2 text-left font-mono text-xs font-semibold text-text hover:text-primary transition-colors min-w-0"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-muted shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted shrink-0" />
                      )}
                      <span className="truncate max-w-xs sm:max-w-md">{item.topic || 'Không có topic'}</span>
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isRateLimit
                            ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                            : isMalformed
                            ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                            : 'bg-primary/10 text-primary border border-primary/20'
                        }`}
                      >
                        {item.failureReason}
                      </span>

                      {item.replayed ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-500">
                          <CheckCircle2 className="w-3 h-3" /> Đã Replay
                        </span>
                      ) : (
                        <button
                          onClick={() => handleReplayOne(item.id)}
                          disabled={replayingId === item.id}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white text-xs font-semibold transition-all disabled:opacity-50"
                        >
                          <Send className={`w-3 h-3 ${replayingId === item.id ? 'animate-spin' : ''}`} />
                          Replay
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
                    <span>Node: <strong className="text-text font-mono">{item.nodeId || 'UNKNOWN'}</strong></span>
                    <span>Thời gian: {new Date(item.receivedAt).toLocaleTimeString()}</span>
                    {item.replayedAt && (
                      <span className="text-emerald-500">
                        Replayed lúc: {new Date(item.replayedAt).toLocaleTimeString()}
                      </span>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="mt-3 p-3 rounded-xl bg-sidebar/80 border border-line font-mono text-xs text-text relative">
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-line text-[11px] text-muted">
                        <span>Payload JSON bị chặn:</span>
                        <button
                          onClick={() => copyToClipboard(item.payload)}
                          className="flex items-center gap-1 text-primary hover:underline"
                        >
                          <Copy className="w-3 h-3" /> Sao chép
                        </button>
                      </div>
                      <pre className="overflow-x-auto whitespace-pre-wrap break-all max-h-48 text-[11px] text-text">
                        {item.payload}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
