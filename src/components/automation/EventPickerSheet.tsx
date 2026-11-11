import React, { useState, useMemo } from 'react';
import { Icon, type IconName } from '../home/HomeIcons';

export interface SystemEventOption {
  code: string;
  name: string;
  description: string;
  icon: IconName;
}

export const SYSTEM_EVENTS: SystemEventOption[] = [
  {
    code: 'EVENT',
    name: 'Sự kiện thiết bị (IoT Event)',
    description: 'Phát sinh khi thiết bị trong nhà (công tắc, rèm, khóa, cổng) thay đổi trạng thái và gửi bản tin sự kiện',
    icon: 'zap',
  },
  {
    code: 'DEVICE_STATE_CHANGED',
    name: 'Thay đổi trạng thái thiết bị (Realtime)',
    description: 'Sự kiện phát sinh trên luồng realtime khi thiết bị thay đổi trạng thái hoạt động',
    icon: 'activity',
  },
];

interface EventPickerSheetProps {
  selectedEvent?: string;
  onSelect: (eventCode: string) => void;
  onClose: () => void;
}

export const EventPickerSheet: React.FC<EventPickerSheetProps> = ({
  selectedEvent,
  onSelect,
  onClose,
}) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SYSTEM_EVENTS;
    return SYSTEM_EVENTS.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.code.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <div className="sub-sheet-layer">
      <header className="sub-sheet-header">
        <strong>Chọn sự kiện hệ thống</strong>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Đóng"
        >
          <Icon name="x" size={16} />
        </button>
      </header>

      <div className="sub-sheet-body space-y-3">
        <input
          autoFocus
          className="picker-search"
          placeholder="Tìm theo tên sự kiện hoặc mô tả..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="space-y-1.5 pt-1">
          {filtered.map((item) => {
            const isSelected = item.code === selectedEvent;
            return (
              <button
                key={item.code}
                type="button"
                onClick={() => {
                  onSelect(item.code);
                  onClose();
                }}
                className={`w-full p-3 rounded-2xl flex items-center justify-between text-left transition-all cursor-pointer border ${
                  isSelected
                    ? 'bg-[var(--accent-soft)] border-[var(--accent)]'
                    : 'bg-[var(--solid)] hover:bg-[var(--muted)] border-[var(--border)]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--muted)] text-[var(--secondary)]'
                    }`}
                  >
                    <Icon name={item.icon} size={18} />
                  </div>
                  <div className="min-w-0">
                    <strong className="text-xs text-[var(--text)] block truncate">
                      {item.name}
                    </strong>
                    <span className="text-[11px] text-[var(--secondary)] block truncate">
                      {item.description}
                    </span>
                  </div>
                </div>

                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                    isSelected
                      ? 'border-[var(--accent)] bg-[var(--accent)]'
                      : 'border-[var(--tertiary)]'
                  }`}
                >
                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
              </button>
            );
          })}

          {filtered.length === 0 && query.trim() ? (
            <div className="p-4 rounded-2xl bg-[var(--solid)] border border-[var(--border)] text-center space-y-2">
              <p className="text-xs text-[var(--secondary)]">
                Dùng mã sự kiện tùy chỉnh: <strong className="text-[var(--text)]">{query.trim()}</strong>
              </p>
              <button
                type="button"
                onClick={() => {
                  onSelect(query.trim());
                  onClose();
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--accent)] text-white hover:opacity-90 cursor-pointer"
              >
                Sử dụng mã sự kiện này
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--tertiary)]">
              Không tìm thấy sự kiện nào phù hợp.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

