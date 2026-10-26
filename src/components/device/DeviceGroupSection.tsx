import React, { useState, useEffect, useRef } from 'react';
import {
  Layers,
  Plus,
  Power,
  PowerOff,
  SunMedium,
  Trash2,
  ChevronDown,
  ChevronUp,
  X,
  Sparkles
} from 'lucide-react';
import type { DeviceResponse } from '../../types/device';
import type { DeviceGroupResponse, DeviceGroupRequest } from '../../types/deviceGroup';
import {
  getHomeDeviceGroups,
  createDeviceGroup,
  deleteDeviceGroup,
  sendGroupCommand
} from '../../services/deviceGroupApi';
import { notify } from '../ui/notify';

interface DeviceGroupSectionProps {
  homeId: string;
  availableDevices: DeviceResponse[];
  onRefreshDevices?: () => void;
}

export const DeviceGroupSection: React.FC<DeviceGroupSectionProps> = ({
  homeId,
  availableDevices,
  onRefreshDevices
}) => {
  const [groups, setGroups] = useState<DeviceGroupResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [executingGroupIds, setExecutingGroupIds] = useState<Record<string, boolean>>({});
  const [groupFeedback, setGroupFeedback] = useState<Record<string, string>>({});
  const [groupBrightness, setGroupBrightness] = useState<Record<string, number>>({});
  const debounceTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const feedbackTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    return () => {
      Object.values(debounceTimersRef.current).forEach((timer) => clearTimeout(timer));
      Object.values(feedbackTimersRef.current).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  // Modal create group state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (homeId) {
      loadGroups();
    }
  }, [homeId]);

  const loadGroups = async () => {
    setIsLoading(true);
    try {
      const data = await getHomeDeviceGroups(homeId);
      setGroups(data);
    } catch {
      // Fallback empty
      setGroups([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) {
      notify('Vui lòng nhập tên nhóm', 'error');
      return;
    }
    if (selectedDeviceIds.length === 0) {
      notify('Vui lòng chọn ít nhất một thiết bị vào nhóm', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const req: DeviceGroupRequest = {
        name: newGroupName.trim(),
        icon: 'layers',
        deviceIds: selectedDeviceIds
      };
      await createDeviceGroup(homeId, req);
      notify('Đã tạo nhóm thiết bị thành công', 'success');
      setIsModalOpen(false);
      setNewGroupName('');
      setSelectedDeviceIds([]);
      loadGroups();
    } catch {
      notify('Lỗi khi tạo nhóm thiết bị', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteGroup = async (groupId: string, name: string) => {
    if (!window.confirm(`Bạn có chắc muốn xóa nhóm "${name}"?`)) return;
    if (debounceTimersRef.current[groupId]) {
      clearTimeout(debounceTimersRef.current[groupId]);
      delete debounceTimersRef.current[groupId];
    }
    try {
      await deleteDeviceGroup(groupId);
      notify(`Đã xóa nhóm "${name}"`, 'success');
      loadGroups();
    } catch {
      notify('Lỗi khi xóa nhóm thiết bị', 'error');
    }
  };

  const handleGroupPower = async (groupId: string, powerAction: 'TURN_ON' | 'TURN_OFF') => {
    // RACE CONDITION FIX: Clear any pending debounce dimmer commands for this group!
    if (debounceTimersRef.current[groupId]) {
      clearTimeout(debounceTimersRef.current[groupId]);
      delete debounceTimersRef.current[groupId];
    }

    setExecutingGroupIds((prev) => ({ ...prev, [groupId]: true }));
    setGroupFeedback((prev) => ({ ...prev, [groupId]: 'Đang gửi lệnh đồng thời...' }));
    try {
      const res = await sendGroupCommand(groupId, powerAction);
      const isSuccess = (res.successCount ?? 0) > 0;
      setGroupFeedback((prev) => ({
        ...prev,
        [groupId]: isSuccess
          ? `✓ ${res.successCount}/${res.totalDevices} thiết bị thành công`
          : `⚠ 0/${res.totalDevices} thiết bị phản hồi`
      }));
      if (isSuccess) {
        notify(
          `Đã ${powerAction === 'TURN_ON' ? 'bật' : 'tắt'} nhóm (${res.successCount}/${res.totalDevices} thiết bị)`,
          'success'
        );
      } else {
        notify(
          `Không có thiết bị nào trong nhóm phản hồi lệnh ${powerAction === 'TURN_ON' ? 'bật' : 'tắt'}`,
          'error'
        );
      }
      onRefreshDevices?.();
    } catch {
      setGroupFeedback((prev) => ({ ...prev, [groupId]: 'Lỗi thực thi lệnh' }));
      notify('Lỗi khi điều khiển nhóm thiết bị', 'error');
    } finally {
      setExecutingGroupIds((prev) => {
        const next = { ...prev };
        delete next[groupId];
        return next;
      });
      if (feedbackTimersRef.current[groupId]) {
        clearTimeout(feedbackTimersRef.current[groupId]);
      }
      feedbackTimersRef.current[groupId] = setTimeout(() => {
        setGroupFeedback((prev) => {
          const next = { ...prev };
          delete next[groupId];
          return next;
        });
        delete feedbackTimersRef.current[groupId];
      }, 4000);
    }
  };

  const handleGroupBrightnessChange = async (groupId: string, brightnessVal: number) => {
    setExecutingGroupIds((prev) => ({ ...prev, [groupId]: true }));
    try {
      const res = await sendGroupCommand(groupId, 'SET_BRIGHTNESS', { brightness: brightnessVal });
      const isSuccess = (res.successCount ?? 0) > 0;
      setGroupFeedback((prev) => ({
        ...prev,
        [groupId]: isSuccess
          ? `✓ Độ sáng ${brightnessVal}% (${res.successCount}/${res.totalDevices})`
          : `⚠ 0/${res.totalDevices} thiết bị cập nhật`
      }));
      if (!isSuccess) {
        notify(`Không có thiết bị nào trong nhóm áp dụng độ sáng`, 'error');
      }
      onRefreshDevices?.();
    } catch {
      notify('Lỗi khi chỉnh độ sáng nhóm', 'error');
    } finally {
      setExecutingGroupIds((prev) => {
        const next = { ...prev };
        delete next[groupId];
        return next;
      });
    }
  };

  const handleSliderChange = (groupId: string, val: number) => {
    setGroupBrightness((prev) => ({ ...prev, [groupId]: val }));
    if (debounceTimersRef.current[groupId]) {
      clearTimeout(debounceTimersRef.current[groupId]);
    }
    debounceTimersRef.current[groupId] = setTimeout(() => {
      handleGroupBrightnessChange(groupId, val);
      delete debounceTimersRef.current[groupId];
    }, 250);
  };

  const handleSliderCommit = (groupId: string, val: number) => {
    if (debounceTimersRef.current[groupId]) {
      clearTimeout(debounceTimersRef.current[groupId]);
      delete debounceTimersRef.current[groupId];
    }
    handleGroupBrightnessChange(groupId, val);
  };

  const handlePresetClick = (groupId: string, b: number) => {
    if (debounceTimersRef.current[groupId]) {
      clearTimeout(debounceTimersRef.current[groupId]);
      delete debounceTimersRef.current[groupId];
    }
    setGroupBrightness((prev) => ({ ...prev, [groupId]: b }));
    handleGroupBrightnessChange(groupId, b);
  };

  return (
    <div className="surface-card p-4 sm:p-5 border border-line rounded-2xl shadow-xs">
      {/* ── Header Bar ── */}
      <div className="flex items-center justify-between gap-3">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setIsExpanded(!isExpanded)}
          onKeyDown={(e) => e.key === 'Enter' && setIsExpanded(!isExpanded)}
          className="flex items-center gap-3 cursor-pointer select-none"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-text">Nhóm thiết bị thông minh</h2>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-off-soft text-muted border border-line">
                {groups.length} nhóm
              </span>
            </div>
            <p className="text-xs text-muted">Điều khiển đồng thời nhiều thiết bị, đồng bộ độ sáng & trạng thái</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Tạo nhóm</span>
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 text-icon hover:text-text rounded-lg transition-colors"
            aria-label={isExpanded ? 'Thu gọn nhóm' : 'Mở rộng nhóm'}
          >
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* ── Content: Collapsible List ── */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-line space-y-3">
          {isLoading ? (
            <div className="text-center py-4 text-xs text-muted">Đang tải danh sách nhóm...</div>
          ) : groups.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-line rounded-xl bg-off-soft/30 space-y-2">
              <p className="text-sm font-medium text-text">Chưa có nhóm thiết bị nào</p>
              <p className="text-xs text-muted max-w-md mx-auto">
                Tạo nhóm (ví dụ: &quot;Toàn bộ đèn tầng 1&quot; hoặc &quot;Quạt &amp; Đèn khách&quot;) để bật/tắt và điều chỉnh độ sáng cùng lúc.
              </p>
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Tạo nhóm đầu tiên
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {groups.map((group) => {
                const isBusy = !!executingGroupIds[group.id];
                const feedback = groupFeedback[group.id];

                return (
                  <div
                    key={group.id}
                    className="p-4 rounded-xl border border-line bg-surface hover:border-primary/40 transition-all shadow-xs flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm text-text truncate">{group.name}</h3>
                          <p className="text-xs text-muted mt-0.5">
                            {group.deviceCount} thiết bị thành viên
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteGroup(group.id, group.name)}
                          className="p-1 text-icon hover:text-error rounded-md transition-colors"
                          title="Xóa nhóm này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Members preview badges */}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {group.devices?.slice(0, 4).map((d) => (
                          <span
                            key={d.id}
                            className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-off-soft text-text border border-line truncate max-w-[120px]"
                          >
                            {d.name}
                          </span>
                        ))}
                        {group.devices && group.devices.length > 4 && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-off-soft text-muted">
                            +{group.devices.length - 4}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Group Actions */}
                    <div className="space-y-2 pt-2 border-t border-line/60">
                      {feedback && (
                        <div className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {feedback}
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleGroupPower(group.id, 'TURN_ON')}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition-colors disabled:opacity-50"
                        >
                          <Power className="w-3.5 h-3.5" />
                          Bật tất cả
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleGroupPower(group.id, 'TURN_OFF')}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold hover:bg-rose-100 transition-colors disabled:opacity-50"
                        >
                          <PowerOff className="w-3.5 h-3.5" />
                          Tắt tất cả
                        </button>
                      </div>

                      {/* Group Brightness Slider & Presets */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="flex items-center gap-1.5 text-muted font-medium">
                            <SunMedium className="w-3.5 h-3.5 text-amber-500" />
                            Độ sáng chung nhóm
                          </span>
                          <span className="font-bold text-text">{groupBrightness[group.id] ?? 80}%</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="100"
                          value={groupBrightness[group.id] ?? 80}
                          disabled={isBusy}
                          onChange={(e) => handleSliderChange(group.id, Number(e.target.value))}
                          onPointerUp={(e) => handleSliderCommit(group.id, Number((e.target as HTMLInputElement).value))}
                          onKeyUp={(e) => {
                            if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) {
                              handleSliderCommit(group.id, Number((e.target as HTMLInputElement).value));
                            }
                          }}
                          className="w-full h-1.5 bg-line rounded-lg appearance-none cursor-pointer accent-amber-500 disabled:opacity-50"
                          title="Kéo hoặc dùng phím mũi tên để điều chỉnh độ sáng đồng loạt cho cả nhóm"
                        />
                        <div className="flex items-center gap-1">
                          {[25, 50, 75, 100].map((b) => (
                            <button
                              key={b}
                              type="button"
                              disabled={isBusy}
                              onClick={() => handlePresetClick(group.id, b)}
                              className="flex-1 py-0.5 text-[10px] font-bold rounded-md border border-line bg-surface hover:bg-amber-50 hover:border-amber-200 hover:text-amber-800 text-text transition-colors"
                            >
                              {b}%
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Modal: Tạo Nhóm Mới ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="surface-card w-full max-w-md p-6 rounded-2xl shadow-xl border border-line space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <h3 className="text-base font-bold text-text flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Tạo nhóm thiết bị mới
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-icon hover:text-text rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted mb-1">Tên nhóm</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Đèn phòng khách & bếp"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-line bg-surface text-text focus:outline-none focus:border-primary"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted mb-1.5">
                  Chọn thiết bị thành viên ({selectedDeviceIds.length} đã chọn)
                </label>
                <div className="max-h-56 overflow-y-auto custom-scrollbar border border-line rounded-xl p-2 space-y-1 bg-off-soft/20">
                  {availableDevices.map((d) => {
                    const isSelected = selectedDeviceIds.includes(d.id);
                    return (
                      <label
                        key={d.id}
                        className={`flex items-center justify-between p-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                          isSelected ? 'bg-primary/10 text-primary border border-primary/30' : 'hover:bg-off-soft text-text'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              const isChecked = e.target.checked;
                              setSelectedDeviceIds((prev) =>
                                isChecked
                                  ? (prev.includes(d.id) ? prev : [...prev, d.id])
                                  : prev.filter((id) => id !== d.id)
                              );
                            }}
                            className="rounded border-line text-primary focus:ring-0"
                          />
                          <span className="truncate">{d.name}</span>
                        </div>
                        <span className="text-[10px] text-muted shrink-0 ml-2">
                          {d.roomName || d.deviceType}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-line text-muted hover:text-text transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-primary text-white hover:bg-primary-hover transition-colors shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang tạo...' : 'Lưu nhóm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
