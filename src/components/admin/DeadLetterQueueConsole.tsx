import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShieldAlert,
  RotateCw,
  Trash2,
  Send,
  CheckCircle2,
  Clock,
  Radio,
  Copy,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Info,
  Cpu,
  Inbox,
  Search,
  X,
} from 'lucide-react';
import type { MqttDeadLetter } from '../../types/diagnostics';
import {
  getDeadLetters,
  replayDeadLetter,
  replayAllDeadLetters,
  clearDeadLetters,
} from '../../services/diagnosticsApi';
import { notify } from '../ui/notify';
import { getErrorMessage } from '../../utils/errors';
import { getSortedFormattedJson } from '../device/DeviceStateVisualizer';
import { ConfirmModal } from '../ui/ConfirmModal';

interface DeadLetterQueueConsoleProps {
  onQueueChange?: () => void;
}

export const DeadLetterQueueConsole: React.FC<DeadLetterQueueConsoleProps> = ({
  onQueueChange,
}) => {
  const [letters, setLetters] = useState<MqttDeadLetter[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const [isReplayingAll, setIsReplayingAll] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'REPLAYED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchLetters = useCallback(
    async ({ silent = false, manual = false }: { silent?: boolean; manual?: boolean } = {}) => {
      if (manual) setIsRefreshing(true);
      try {
        const data = await getDeadLetters(100, false);
        setLetters(data);
      } catch (err) {
        if (!silent) {
          notify.error(
            'Không thể tải danh sách Dead-Letter Queue',
            getErrorMessage(err, 'Vui lòng thử lại sau')
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
    void fetchLetters();
    const timer = setInterval(() => {
      void fetchLetters({ silent: true });
    }, 5000);
    return () => clearInterval(timer);
  }, [fetchLetters]);

  const handleReplayOne = async (id: string) => {
    setReplayingId(id);
    try {
      await replayDeadLetter(id);
      notify.success('Đã gửi lại thành công', 'Tín hiệu đã được nạp lại vào kênh MQTT Inbound');
      await fetchLetters({ silent: true });
      onQueueChange?.();
    } catch (err) {
      notify.error(
        'Gửi lại thất bại',
        getErrorMessage(err, 'Không thể phát lại bản tin từ hàng đợi')
      );
    } finally {
      setReplayingId(null);
    }
  };

  const handleReplayAll = async () => {
    const unhandled = letters.filter((l) => !l.replayed);
    if (unhandled.length === 0) {
      notify.info('Không có tín hiệu nào cần gửi lại');
      return;
    }
    setIsReplayingAll(true);
    try {
      const count = await replayAllDeadLetters();
      notify.success(`Đã phát lại ${count} tín hiệu`, 'Toàn bộ dữ liệu đã được đưa vào luồng xử lý');
      await fetchLetters({ silent: true });
      onQueueChange?.();
    } catch (err) {
      notify.error(
        'Gặp sự cố khi gửi lại toàn bộ tín hiệu',
        getErrorMessage(err, 'Vui lòng thử lại sau')
      );
    } finally {
      setIsReplayingAll(false);
    }
  };

  const handleConfirmClear = async () => {
    setIsClearing(true);
    try {
      await clearDeadLetters();
      setLetters([]);
      setIsClearModalOpen(false);
      notify.success('Đã dọn dẹp sạch sẽ hàng đợi DLQ');
      onQueueChange?.();
    } catch (err) {
      notify.error('Lỗi khi dọn dẹp hàng đợi', getErrorMessage(err, 'Không thể xóa hàng đợi'));
    } finally {
      setIsClearing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    notify.success('Đã sao chép payload vào bộ nhớ tạm');
  };

  const getFriendlyReason = (reason: string) => {
    if (reason.includes('RATE_LIMIT')) {
      return {
        label: 'Giới hạn tần suất (Chống quá tải >50 gói/s)',
        color: 'bg-warning-soft text-amber-700 border-amber-200',
      };
    }
    if (reason.includes('MALFORMED') || reason.includes('JSON')) {
      return {
        label: 'Dữ liệu JSON sai định dạng',
        color: 'bg-error-soft text-rose-700 border-rose-200',
      };
    }
    return {
      label: reason || 'Lỗi xử lý gói tin MQTT',
      color: 'bg-info-soft text-sky-700 border-sky-200',
    };
  };

  const getFriendlyTopic = (topic: string) => {
    if (topic.includes('telemetry')) return 'Dữ liệu điện năng & cảm biến';
    if (topic.includes('status')) return 'Trạng thái hoạt động thiết bị';
    if (topic.includes('command')) return 'Lệnh điều khiển';
    if (topic.includes('ota')) return 'Thông báo cập nhật OTA';
    return topic || 'Kênh MQTT chung';
  };

  const renderParsedSummary = (payloadStr: string) => {
    try {
      const parsed = JSON.parse(payloadStr);
      const items: string[] = [];
      if (parsed.power !== undefined) {
        const isTrue = parsed.power === true || parsed.power === 'ON' || parsed.power === 'true';
        items.push(`Nguồn: ${isTrue ? 'BẬT' : 'TẮT'}`);
      }
      if (parsed.r !== undefined && parsed.g !== undefined && parsed.b !== undefined) {
        items.push(`Màu RGB: (${parsed.r}, ${parsed.g}, ${parsed.b})`);
      }
      if (parsed.voltage !== undefined) items.push(`Điện áp: ${parsed.voltage}V`);
      if (parsed.current !== undefined) items.push(`Dòng điện: ${parsed.current}A`);
      if (parsed.watts !== undefined || parsed.powerWatts !== undefined) {
        items.push(`Công suất: ${parsed.watts ?? parsed.powerWatts}W`);
      }
      if (parsed.temperature !== undefined) items.push(`Nhiệt độ: ${parsed.temperature}°C`);
      if (parsed.humidity !== undefined) items.push(`Độ ẩm: ${parsed.humidity}%`);

      if (items.length > 0) {
        return (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {items.map((item, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded-md bg-surface border border-line text-[11px] font-medium text-text"
              >
                {item}
              </span>
            ))}
          </div>
        );
      }
    } catch {
      // Raw malformed JSON — displayed inside expanded box
    }
    return null;
  };

  const unhandledCount = letters.filter((l) => !l.replayed).length;
  const replayedCount = letters.filter((l) => l.replayed).length;

  const filteredLetters = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return letters.filter((item) => {
      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'PENDING' && !item.replayed) ||
        (statusFilter === 'REPLAYED' && item.replayed);
      if (!matchStatus) return false;
      if (!q) return true;
      return (
        (item.nodeId || '').toLowerCase().includes(q) ||
        item.topic.toLowerCase().includes(q) ||
        item.failureReason.toLowerCase().includes(q) ||
        item.payload.toLowerCase().includes(q)
      );
    });
  }, [letters, statusFilter, searchQuery]);

  return (
    <div className="space-y-6 tabular-nums">
      {/* Banner Giới Thiệu */}
      <div className="rounded-3xl border border-line bg-surface/95 backdrop-blur-sm shadow-soft p-5 sm:p-6">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-info-soft text-sky-700 border border-sky-200 flex items-center justify-center shrink-0 mt-0.5">
            <Inbox className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-text">
                Hàng đợi gói tin lỗi (MQTT Dead-Letter Queue)
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-info-soft text-sky-700 border border-sky-200">
                Ingress Rate-Limiter &amp; Bảo vệ Dữ liệu
              </span>
            </div>
            <p className="text-xs text-muted mt-1 leading-relaxed max-w-3xl">
              Bảo vệ Backend khi thiết bị vượt ngưỡng tốc độ (&gt; 50 bản tin/giây) hoặc gửi payload JSON sai chuẩn.
              Các bản tin được giữ lại trong bộ đệm an toàn để Admin kiểm tra và phát lại (Replay) bất cứ lúc nào.
            </p>
          </div>
        </div>
      </div>

      {/* 4 KPI Thống kê DLQ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-3xl border border-line bg-surface/95 shadow-soft p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted font-medium">Chờ phát lại</p>
            <div className={`text-2xl font-extrabold mt-1 ${unhandledCount > 0 ? 'text-rose-700' : 'text-text'}`}>
              {unhandledCount}
            </div>
            <p className="text-[11px] text-muted mt-0.5">Cần nạp lại vào hệ thống</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-error-soft border border-rose-200 text-rose-700 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-3xl border border-line bg-surface/95 shadow-soft p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted font-medium">Đã phát lại thành công</p>
            <div className="text-2xl font-extrabold text-emerald-700 mt-1">{replayedCount}</div>
            <p className="text-[11px] text-muted mt-0.5">Đã đồng bộ vào luồng MQTT</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-success-soft border border-emerald-200 text-emerald-700 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-3xl border border-line bg-surface/95 shadow-soft p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted font-medium">Ngưỡng Rate-Limiter</p>
            <div className="text-xl font-extrabold text-sky-700 mt-1">50 gói / giây</div>
            <p className="text-[11px] text-muted mt-0.5">Chống spam mỗi Edge Node</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-info-soft border border-sky-200 text-sky-700 flex items-center justify-center">
            <Radio className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-3xl border border-line bg-surface/95 shadow-soft p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted font-medium">Sức chứa bộ đệm</p>
            <div className="text-xl font-extrabold text-text mt-1">{letters.length} / 500</div>
            <p className="text-[11px] text-muted mt-0.5">Ring buffer xoay vòng</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sidebar border border-line text-text flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Danh Sách Bản Tin DLQ */}
      <div className="rounded-3xl border border-line bg-surface/95 backdrop-blur-sm shadow-soft overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 sm:p-5 border-b border-line space-y-3 bg-sidebar/50">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className={`flex h-2.5 w-2.5 rounded-full ${
                  unhandledCount > 0 ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'
                }`}
              />
              <h3 className="text-sm font-bold text-text">
                Danh sách bản tin trong hàng đợi ({filteredLetters.length})
              </h3>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleReplayAll}
                disabled={isReplayingAll || unhandledCount === 0}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-hover disabled:opacity-50 transition-colors shadow-2xs cursor-pointer"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isReplayingAll ? 'animate-spin' : ''}`} />
                <span>Phát lại tất cả ({unhandledCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setIsClearModalOpen(true)}
                disabled={letters.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 bg-error-soft text-rose-700 hover:brightness-95 text-xs font-semibold disabled:opacity-40 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Dọn sạch</span>
              </button>

              <button
                type="button"
                onClick={() => void fetchLetters({ manual: true })}
                disabled={isRefreshing}
                className="p-2 rounded-xl border border-line bg-surface text-muted hover:text-text hover:bg-sidebar-hover/70 transition-colors cursor-pointer disabled:opacity-50"
                title="Làm mới danh sách"
              >
                <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
              </button>
            </div>
          </div>

          {/* Search + Status filter */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Lọc theo Node ID, topic, lý do lỗi hoặc nội dung payload..."
                className="w-full min-h-[38px] pl-10 pr-8 py-1.5 text-xs sm:text-sm rounded-xl border border-line bg-surface text-text placeholder:text-muted/80 focus:outline-none focus:border-primary"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Xóa từ khóa tìm kiếm"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted hover:text-text cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {(
                [
                  { id: 'ALL', label: `Tất cả (${letters.length})` },
                  { id: 'PENDING', label: `Chờ gửi lại (${unhandledCount})` },
                  { id: 'REPLAYED', label: `Đã xử lý (${replayedCount})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                    statusFilter === tab.id
                      ? 'bg-primary text-white border-primary shadow-2xs'
                      : 'bg-surface text-muted border-line hover:text-text hover:bg-sidebar-hover/60'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        {initialLoading ? (
          <div className="py-14 text-center text-xs text-muted">
            Đang tải dữ liệu hàng đợi Dead-Letter...
          </div>
        ) : filteredLetters.length === 0 ? (
          <div className="py-14 px-4 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-3xl bg-success-soft border border-emerald-200 text-emerald-700 flex items-center justify-center mb-4">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div className="text-base font-bold text-text mb-1">
              {letters.length === 0
                ? 'Hàng đợi DLQ Đang Sạch!'
                : 'Không có bản tin nào khớp với bộ lọc'}
            </div>
            <p className="text-xs text-muted max-w-md mx-auto leading-relaxed">
              {letters.length === 0
                ? 'Toàn bộ cảm biến và thiết bị IoT đang truyền tải ổn định, chưa phát sinh gói tin lỗi hay vượt ngưỡng tốc độ.'
                : 'Thử thay đổi bộ lọc trạng thái hoặc từ khóa tìm kiếm để xem các bản tin khác.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {filteredLetters.map((item) => {
              const isExpanded = expandedId === item.id;
              const reasonInfo = getFriendlyReason(item.failureReason);

              return (
                <div key={item.id} className="p-4 sm:p-5 hover:bg-sidebar/40 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      className="flex items-start gap-2.5 text-left min-w-0 cursor-pointer"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-muted shrink-0 mt-0.5" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-bold text-text hover:text-sky-700 transition-colors">
                          {getFriendlyTopic(item.topic)}
                        </div>
                        <p className="text-[11px] text-muted font-mono mt-0.5 break-all">
                          {item.topic}
                        </p>
                        {renderParsedSummary(item.payload)}
                      </div>
                    </button>

                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${reasonInfo.color}`}
                      >
                        {reasonInfo.label}
                      </span>

                      {item.replayed ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-success-soft text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Đã phát lại
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleReplayOne(item.id)}
                          disabled={replayingId === item.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-info-soft text-sky-700 border border-sky-200 hover:bg-primary hover:text-white hover:border-primary text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
                        >
                          <Send className={`w-3 h-3 ${replayingId === item.id ? 'animate-spin' : ''}`} />
                          <span>Phát lại (Replay)</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-2.5 pl-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
                    <span className="flex items-center gap-1">
                      <Cpu className="w-3.5 h-3.5" />
                      Node:{' '}
                      <strong className="text-text font-mono">{item.nodeId || 'Chưa định danh'}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Nhận lúc: {new Date(item.receivedAt).toLocaleString('vi-VN')}
                    </span>
                    {item.replayedAt && (
                      <span className="text-emerald-700 font-semibold">
                        Đã phát lại: {new Date(item.replayedAt).toLocaleString('vi-VN')}
                      </span>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="mt-3 ml-6 p-3.5 rounded-2xl bg-sidebar/80 border border-line text-xs text-text">
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-line text-[11px] text-muted">
                        <span className="flex items-center gap-1.5 font-semibold text-text">
                          <Info className="w-3.5 h-3.5 text-primary" />
                          Payload gốc từ thiết bị
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(item.payload)}
                          className="flex items-center gap-1 text-sky-700 hover:underline font-semibold cursor-pointer"
                        >
                          <Copy className="w-3 h-3" /> Sao chép JSON
                        </button>
                      </div>
                      <pre className="font-mono overflow-x-auto whitespace-pre-wrap break-all max-h-48 text-[11px] text-[#6ee7b7] bg-[#0b1424] p-3 rounded-xl border border-[#1e2d45]">
                        {(() => {
                          try {
                            const obj = JSON.parse(item.payload);
                            return getSortedFormattedJson(obj, true);
                          } catch {
                            return item.payload;
                          }
                        })()}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={isClearModalOpen}
        title="Dọn sạch hàng đợi tín hiệu DLQ"
        description="Bạn có chắc chắn muốn xóa toàn bộ bản tin đang lưu trong Dead-Letter Queue? Hành động này không thể hoàn tác."
        confirmText="Dọn sạch ngay"
        cancelText="Hủy bỏ"
        variant="danger"
        loading={isClearing}
        onConfirm={handleConfirmClear}
        onCancel={() => setIsClearModalOpen(false)}
      />
    </div>
  );
};
