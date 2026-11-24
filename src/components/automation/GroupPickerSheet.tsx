import React, { useMemo, useState } from 'react';
import type { DeviceGroupResponse } from '../../types/deviceGroup';
import { Icon } from '../ui/LucideIcon';

interface GroupPickerSheetProps {
  groups: DeviceGroupResponse[];
  selectedGroupId?: string;
  onSelect: (group: DeviceGroupResponse) => void;
  onClose: () => void;
}

/** Same look as ScenePickerSheet: pick one device group of the home. */
export const GroupPickerSheet: React.FC<GroupPickerSheetProps> = ({ groups, selectedGroupId, onSelect, onClose }) => {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? groups.filter((g) => g.name.toLowerCase().includes(q)) : groups;
  }, [groups, query]);

  return (
    <div className="sub-sheet-layer">
      <header className="sub-sheet-header">
        <strong>Chọn nhóm thiết bị</strong>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Đóng">
          <Icon name="x" size={16} />
        </button>
      </header>

      <div className="sub-sheet-scroll">
        <input
          autoFocus
          className="picker-search search"
          placeholder="Tìm nhóm..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="space-y-2">
          {filtered.map((group) => {
            const isSelected = group.id === selectedGroupId;
            const empty = !group.deviceCount;
            return (
              <button
                key={group.id}
                type="button"
                disabled={empty}
                onClick={() => {
                  onSelect(group);
                  onClose();
                }}
                className={`w-full p-3 rounded-2xl flex items-center justify-between text-left transition-all border ${
                  isSelected
                    ? 'bg-[var(--accent-soft)] border-[var(--accent)]'
                    : 'bg-[var(--solid)] hover:bg-[var(--muted)] border-[var(--border)]'
                } ${empty ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-[var(--accent)] text-white' : 'bg-[var(--muted)] text-[var(--secondary)]'
                    }`}
                  >
                    <Icon name="grid" size={18} />
                  </div>
                  <div className="min-w-0">
                    <strong className="text-xs text-[var(--text)] block truncate">{group.name}</strong>
                    <span className="text-[11px] text-[var(--secondary)] block truncate">
                      {empty ? 'Nhóm chưa có thiết bị' : `${group.deviceCount} thiết bị`}
                    </span>
                  </div>
                </div>
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                    isSelected ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-[var(--tertiary)]'
                  }`}
                >
                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="p-8 text-center text-xs text-[var(--tertiary)]">
              Chưa có nhóm nào. Tạo nhóm ở trang Thiết bị.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
