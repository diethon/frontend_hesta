import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import type { MqttDeadLetter } from '../../types/diagnostics';
import {
  getDeadLetters,
  replayDeadLetter,
  replayAllDeadLetters,
  clearDeadLetters,
} from '../../services/diagnosticsApi';
import { notify } from '../ui/notify';
import { getSortedFormattedJson } from '../device/DeviceStateVisualizer';

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
      notify.error('Không thể tải danh sách tín hiệu chờ xử lý');
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
      notify.success('Đã gửi lại thành công', 'Tín hiệu đã được nạp lại vào luồng xử lý của hệ thống');
      await fetchLetters();
    } catch {
      notify.error('Gửi lại thất bại, vui lòng thử lại sau');
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
      notify.success(`Đã gửi lại ${count} tín hiệu`, 'Toàn bộ dữ liệu đã được tự động xử lý');
      await fetchLetters();
    } catch {
      notify.error('Gặp sự cố khi gửi lại toàn bộ tín hiệu');
    } finally {
      setIsReplayingAll(false);
    }
  };

  const handleClear = async () => {
    if (!window.confirm('Bạn có chắc muốn dọn sạch toàn bộ các tín hiệu đang lưu trong hộp thư này?')) return;
    try {
      await clearDeadLetters();
      setLetters([]);
      notify.success('Đã dọn dẹp sạch sẽ hộp thư tín hiệu');
    } catch {
      notify.error('Lỗi khi dọn dẹp hộp thư');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    notify.success('Đã sao chép nội dung vào bộ nhớ tạm');
  };

  // Diễn giải lý do giữ lại tín hiệu bằng tiếng Việt
  const getFriendlyReason = (reason: string) => {
    if (reason.includes('RATE_LIMIT')) {
      return {
        label: 'Gửi dồn dập (Tạm giữ chống quá tải)',
        color: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      };
    }
    if (reason.includes('MALFORMED') || reason.includes('JSON')) {
      return {
        label: 'Dữ liệu sai định dạng',
        color: 'bg-red-500/10 text-red-500 border-red-500/20',
      };
    }
    return {
      label: 'Mất kết nối tạm thời',
      color: 'bg-primary/10 text-primary border-primary/20',
    };
  };

  // Diễn giải loại kênh truyền tín hiệu
  const getFriendlyTopic = (topic: string) => {
    if (topic.includes('telemetry')) return 'Dữ liệu điện năng & cảm biến';
    if (topic.includes('status')) return 'Trạng thái hoạt động thiết bị';
    if (topic.includes('command')) return 'Lệnh điều khiển';
    return topic || 'Kênh chung';
  };

  // Thử trích xuất dữ liệu thân thiện từ chuỗi JSON
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
              <span key={idx} className="px-2 py-0.5 rounded-md bg-surface border border-line text-[11px] font-medium text-text">
                {item}
              </span>
            ))}
          </div>
        );
      }
    } catch {
      // Ignore parse error
    }
    return null;
  };

  const unhandledCount = letters.filter((l) => !l.replayed).length;
  const replayedCount = letters.filter((l) => l.replayed).length;

  return (
    <div className="space-y-6">
      {/* Banner Giới Thiệu Chức Năng Dễ Hiểu */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-primary/10 via-surface to-surface border border-line">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/20 text-primary flex items-center justify-center shrink-0 mt-0.5">
            <Inbox className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-text">
                Trung Tâm Cứu Tín Hiệu Thiết Bị (Dead-Letter Queue)
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
                Bảo Vệ Dữ Liệu Gia Đình
              </span>
            </div>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              Khi mạng gia đình chập chờn hoặc thiết bị gửi dữ liệu quá dồn dập, các tín hiệu (điện năng, nhiệt độ, bật/tắt)
              sẽ được <strong>giữ lại an toàn tại đây thay vì bị đánh mất</strong>. Bạn có thể bấm <strong>&quot;Thử Gửi Lại&quot;</strong> để hệ thống cập nhật đúng tình trạng thiết bị.
            </p>
          </div>
        </div>
      </div>

      {/* 4 Thẻ Trạng Thái Trực Quan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-surface border border-line flex items-center justify-between">
          <div>
            <p className="text-xs text-muted font-medium">Tín hiệu chờ gửi lại</p>
            <p className="text-2xl font-bold text-red-500 mt-1">{unhandledCount}</p>
            <p className="text-[10px] text-muted mt-0.5">Cần nạp lại vào hệ thống</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-line flex items-center justify-between">
          <div>
            <p className="text-xs text-muted font-medium">Đã gửi lại thành công</p>
            <p className="text-2xl font-bold text-emerald-500 mt-1">{replayedCount}</p>
            <p className="text-[10px] text-muted mt-0.5">Đã đồng bộ vào thiết bị</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-line flex items-center justify-between">
          <div>
            <p className="text-xs text-muted font-medium">Tốc độ tiếp nhận</p>
            <p className="text-xl font-bold text-primary mt-1">An Toàn</p>
            <p className="text-[10px] text-muted mt-0.5">Tối đa 50 tín hiệu/giây</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Radio className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-line flex items-center justify-between">
          <div>
            <p className="text-xs text-muted font-medium">Bộ nhớ lưu tạm</p>
            <p className="text-xl font-bold text-text mt-1">{letters.length} / 500</p>
            <p className="text-[10px] text-muted mt-0.5">Tự động xoay vòng an toàn</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Danh Sách Tín Hiệu */}
      <div className="rounded-2xl border border-line bg-surface overflow-hidden shadow-sm">
        {/* Thanh Công Cụ */}
        <div className="p-4 border-b border-line flex flex-wrap items-center justify-between gap-3 bg-surface/50">
          <div className="flex items-center gap-2">
            <span className={`flex h-2.5 w-2.5 rounded-full ${unhandledCount > 0 ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
            <h4 className="text-sm font-bold text-text">
              Danh Sách Tín Hiệu Đang Chờ Xử Lý
            </h4>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReplayAll}
              disabled={isReplayingAll || unhandledCount === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-hover disabled:opacity-50 transition-all shadow-sm"
              title="Thử gửi lại tất cả các tín hiệu đang chờ"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isReplayingAll ? 'animate-spin' : ''}`} />
              Thử Gửi Lại Tất Cả ({unhandledCount})
            </button>

            <button
              onClick={handleClear}
              disabled={letters.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-500/30 text-red-500 hover:bg-red-500/10 text-xs font-semibold disabled:opacity-50 transition-all"
              title="Xóa sạch các tín hiệu không cần nữa"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Dọn Sạch
            </button>

            <button
              onClick={fetchLetters}
              disabled={isLoading}
              className="p-1.5 rounded-xl border border-line text-muted hover:text-text hover:bg-sidebar transition-colors"
              title="Làm mới danh sách"
            >
              <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Nội Dung: Trạng Thái Trống Hoặc Từng Dòng Tín Hiệu */}
        {letters.length === 0 ? (
          <div className="py-16 px-4 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-4 ring-8 ring-emerald-500/5">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h4 className="text-base font-bold text-text mb-1">
              Mọi Tín Hiệu Đều Hoạt Động Trơn Tru!
            </h4>
            <p className="text-xs text-muted max-w-md mx-auto leading-relaxed">
              Toàn bộ cảm biến, công tắc và ổ cắm trong gia đình đang truyền tín hiệu ổn định, không có dữ liệu nào bị gián đoạn hay thất lạc.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-line overflow-x-auto">
            {letters.map((item) => {
              const isExpanded = expandedId === item.id;
              const reasonInfo = getFriendlyReason(item.failureReason);

              return (
                <div key={item.id} className="p-4 hover:bg-sidebar/30 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      className="flex items-start gap-2 text-left min-w-0"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-muted shrink-0 mt-0.5" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-text hover:text-primary transition-colors">
                            {getFriendlyTopic(item.topic)}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted font-mono mt-0.5 truncate max-w-xs sm:max-w-md">
                          {item.topic}
                        </p>
                        {renderParsedSummary(item.payload)}
                      </div>
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${reasonInfo.color}`}
                      >
                        {reasonInfo.label}
                      </span>

                      {item.replayed ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-500">
                          <CheckCircle2 className="w-3 h-3" /> Đã gửi lại
                        </span>
                      ) : (
                        <button
                          onClick={() => handleReplayOne(item.id)}
                          disabled={replayingId === item.id}
                          className="flex items-center gap-1 px-3 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white text-xs font-semibold transition-all disabled:opacity-50"
                        >
                          <Send className={`w-3 h-3 ${replayingId === item.id ? 'animate-spin' : ''}`} />
                          Thử gửi lại
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
                    <span className="flex items-center gap-1">
                      <Cpu className="w-3.5 h-3.5" />
                      Thiết bị: <strong className="text-text font-mono">{item.nodeId || 'Chưa định danh'}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Thời gian: {new Date(item.receivedAt).toLocaleTimeString()}
                    </span>
                    {item.replayedAt && (
                      <span className="text-emerald-500 font-medium">
                        Đã gửi lại lúc: {new Date(item.replayedAt).toLocaleTimeString()}
                      </span>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="mt-3 p-3.5 rounded-xl bg-sidebar/80 border border-line text-xs text-text relative">
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-line text-[11px] text-muted">
                        <span className="flex items-center gap-1.5 font-semibold">
                          <Info className="w-3.5 h-3.5 text-primary" />
                          Chi tiết dữ liệu gốc từ thiết bị:
                        </span>
                        <button
                          onClick={() => copyToClipboard(item.payload)}
                          className="flex items-center gap-1 text-primary hover:underline font-medium"
                        >
                          <Copy className="w-3 h-3" /> Sao chép dữ liệu
                        </button>
                      </div>
                      <pre className="font-mono overflow-x-auto whitespace-pre-wrap break-all max-h-48 text-[11px] text-emerald-400 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
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
    </div>
  );
};
