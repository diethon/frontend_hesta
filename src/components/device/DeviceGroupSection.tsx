import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus,
  Power,
  PowerOff,
  SunMedium,
  Trash2,
  ChevronDown,
  X,
  Sparkles,
  CheckSquare,
  Square,
} from 'lucide-react';
import type { DeviceResponse } from '../../types/device';
import type { DeviceGroupResponse, DeviceGroupRequest } from '../../types/deviceGroup';
import {
  getHomeDeviceGroups,
  createDeviceGroup,
  deleteDeviceGroup,
  sendGroupCommand,
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
  onRefreshDevices,
}) => {
  const [groups, setGroups] = useState<DeviceGroupResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [executingGroupIds, setExecutingGroupIds] = useState<Record<string, boolean>>({});
  const [groupFeedback, setGroupFeedback] = useState<Record<string, string>>({});
  const [groupBrightness, setGroupBrightness] = useState<Record<string, number>>({});
  const debounceTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const feedbackTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Cleanup ref timers on unmount (with local copy to satisfy ESLint)
  useEffect(() => {
    const debounceTimers = debounceTimersRef.current;
    const feedbackTimers = feedbackTimersRef.current;
    return () => {
      Object.values(debounceTimers).forEach((timer) => clearTimeout(timer));
      Object.values(feedbackTimers).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  // Modal create group state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reusable loader for mutation events
  const reloadGroups = useCallback(async () => {
    if (!homeId) return;
    setIsLoading(true);
    try {
      const data = await getHomeDeviceGroups(homeId);
      setGroups(data);
    } catch {
      setGroups([]);
    } finally {
      setIsLoading(false);
    }
  }, [homeId]);

  // Initial fetch with active cancel guard
  useEffect(() => {
    let active = true;
    if (!homeId) return;

    const fetchInitial = async () => {
      setIsLoading(true);
      try {
        const data = await getHomeDeviceGroups(homeId);
        if (!active) return;
        setGroups(data);
      } catch {
        if (!active) return;
        setGroups([]);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void fetchInitial();

    return () => {
      active = false;
    };
  }, [homeId]);

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
        deviceIds: selectedDeviceIds,
      };
      await createDeviceGroup(homeId, req);
      notify('Đã tạo nhóm thiết bị thành công', 'success');
      setIsModalOpen(false);
      setNewGroupName('');
      setSelectedDeviceIds([]);
      await reloadGroups();
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
      await reloadGroups();
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
          : `⚠ 0/${res.totalDevices} thiết bị phản hồi`,
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
          : `⚠ 0/${res.totalDevices} thiết bị cập nhật`,
      }));
      if (!isSuccess) {
        notify('Không có thiết bị nào trong nhóm áp dụng độ sáng', 'error');
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

  // Toggle select all devices in modal
  const areAllSelected =
    availableDevices.length > 0 && selectedDeviceIds.length === availableDevices.length;

  const handleToggleSelectAll = () => {
    if (areAllSelected) {
      setSelectedDeviceIds([]);
    } else {
      setSelectedDeviceIds(availableDevices.map((d) => d.id));
    }
  };

  return (
    <div className="w-full tabular-nums">
      {/* ── Section Header Row ── */}
      <div className="flex items-center justify-between gap-3 py-1">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          aria-controls="device-groups-collapsible"
          className="flex items-center gap-2 text-left cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-lg p-1 -m-1 select-none"
        >
          <h2 className="text-base font-semibold text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">
            Nhóm thiết bị
          </h2>
          <span className="text-xs text-[var(--secondary)] font-normal tabular-nums">
            {groups.length} nhóm
          </span>
          <ChevronDown
            className={`w-4 h-4 text-[var(--secondary)] transition-transform duration-200 ${
              isExpanded ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          />
        </button>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          title="Tạo nhóm thiết bị mới"
          aria-label="Tạo nhóm thiết bị mới"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border)] bg-transparent hover:bg-[var(--muted)]/50 text-xs font-medium text-[var(--text)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          <Plus className="w-3.5 h-3.5 text-[var(--secondary)]" />
          <span>Tạo nhóm</span>
        </button>
      </div>

      {/* ── Content: Collapsible List ── */}
      {isExpanded && (
        <div id="device-groups-collapsible" className="mt-3 space-y-3">
          {isLoading ? (
            <div className="text-center py-5 text-xs text-[var(--secondary)]">
              Đang tải danh sách nhóm...
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-[var(--border)] rounded-2xl bg-[var(--g1)]/40 space-y-2.5">
              <p className="text-sm font-semibold text-[var(--text)]">Chưa có nhóm thiết bị nào</p>
              <p className="text-xs text-[var(--secondary)] max-w-md mx-auto">
                Tạo nhóm (ví dụ: &quot;Toàn bộ đèn tầng 1&quot; hoặc &quot;Quạt &amp; Đèn khách&quot;) để bật/tắt và điều chỉnh độ sáng cùng lúc.
              </p>
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--muted)]/50 text-xs font-medium text-[var(--text)] transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tạo nhóm đầu tiên</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {groups.map((group) => {
                const isBusy = !!executingGroupIds[group.id];
                const feedback = groupFeedback[group.id];
                const currentBrightness = groupBrightness[group.id] ?? 80;

                return (
                  <div
                    key={group.id}
                    className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--solid)] hover:border-[var(--accent)]/40 transition-all shadow-xs flex flex-col justify-between space-y-3.5"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm text-[var(--text)] truncate">{group.name}</h3>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/20">
                              {group.deviceCount} thiết bị
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteGroup(group.id, group.name)}
                          className="p-1.5 text-[var(--secondary)] hover:text-rose-600 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Xóa nhóm này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Members preview badges */}
                      <div className="flex flex-wrap gap-1 mt-2.5">
                        {group.devices?.slice(0, 4).map((d) => (
                          <span
                            key={d.id}
                            className="px-2 py-0.5 text-[11px] font-medium rounded-lg bg-[var(--g1)] text-[var(--text)] border border-[var(--border)] truncate max-w-[120px]"
                          >
                            {d.name}
                          </span>
                        ))}
                        {group.devices && group.devices.length > 4 && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-[var(--g1)] text-[var(--secondary)] border border-[var(--border)]">
                            +{group.devices.length - 4}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Group Actions */}
                    <div className="space-y-2.5 pt-2 border-t border-[var(--border)]/60">
                      {feedback && (
                        <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                          {feedback}
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleGroupPower(group.id, 'TURN_ON')}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <Power className="w-3.5 h-3.5" />
                          Bật tất cả
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleGroupPower(group.id, 'TURN_OFF')}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-500/20 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <PowerOff className="w-3.5 h-3.5" />
                          Tắt tất cả
                        </button>
                      </div>

                      {/* Group Brightness Slider & Presets */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="flex items-center gap-1.5 text-[var(--secondary)] font-medium">
                            <SunMedium className="w-3.5 h-3.5 text-amber-600" />
                            Độ sáng chung nhóm
                          </span>
                          <span className="font-semibold text-[var(--text)] tabular-nums">{currentBrightness}%</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="100"
                          value={currentBrightness}
                          disabled={isBusy}
                          onChange={(e) => handleSliderChange(group.id, Number(e.target.value))}
                          onPointerUp={(e) => handleSliderCommit(group.id, Number((e.target as HTMLInputElement).value))}
                          onKeyUp={(e) => {
                            if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) {
                              handleSliderCommit(group.id, Number((e.target as HTMLInputElement).value));
                            }
                          }}
                          className="w-full h-1.5 bg-[var(--g1)] rounded-lg appearance-none cursor-pointer accent-amber-600 disabled:opacity-50"
                          title="Kéo hoặc dùng phím mũi tên để điều chỉnh độ sáng đồng loạt cho cả nhóm"
                        />
                        <div className="flex items-center gap-1 pt-0.5">
                          {[25, 50, 75, 100].map((b) => {
                            const isPresetActive = currentBrightness === b;
                            return (
                              <button
                                key={b}
                                type="button"
                                disabled={isBusy}
                                onClick={() => handlePresetClick(group.id, b)}
                                className={`flex-1 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                                  isPresetActive
                                    ? 'bg-amber-600 text-white border-amber-600 shadow-2xs font-extrabold'
                                    : 'bg-[var(--g1)] text-[var(--secondary)] border-[var(--border)] hover:bg-amber-600/10 hover:border-amber-600/30 hover:text-amber-700 dark:hover:text-amber-300'
                                }`}
                              >
                                {b}%
                              </button>
                            );
                          })}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/55 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md p-6 rounded-3xl shadow-2xl border border-[var(--border)] bg-[var(--solid)] space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <h3 className="text-base font-bold text-[var(--text)] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[var(--accent)]" />
                Tạo nhóm thiết bị mới
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-[var(--secondary)] hover:text-[var(--text)] rounded-xl hover:bg-[var(--g1)] transition-colors cursor-pointer"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[var(--secondary)] mb-1">Tên nhóm</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Đèn phòng khách & bếp"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[var(--border)] bg-[var(--g1)] text-[var(--text)] placeholder:text-[var(--tertiary)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 transition-all"
                  autoFocus
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-[var(--secondary)]">
                    Chọn thiết bị thành viên ({selectedDeviceIds.length} đã chọn)
                  </label>
                  {availableDevices.length > 0 && (
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="text-[11px] font-bold text-[var(--accent)] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {areAllSelected ? (
                        <>
                          <Square className="w-3 h-3" />
                          <span>Bỏ chọn tất cả</span>
                        </>
                      ) : (
                        <>
                          <CheckSquare className="w-3 h-3" />
                          <span>Chọn tất cả</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="max-h-56 overflow-y-auto custom-scrollbar border border-[var(--border)] rounded-2xl p-2 space-y-1 bg-[var(--g1)]/40">
                  {availableDevices.length === 0 ? (
                    <div className="py-6 text-center text-xs text-[var(--tertiary)]">
                      Không có thiết bị khả dụng để thêm vào nhóm
                    </div>
                  ) : (
                    availableDevices.map((d) => {
                      const isSelected = selectedDeviceIds.includes(d.id);
                      return (
                        <label
                          key={d.id}
                          className={`flex items-center justify-between p-2.5 rounded-xl text-xs font-medium cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/30 font-bold'
                              : 'hover:bg-[var(--g1)] text-[var(--text)] border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
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
                              className="rounded border-[var(--border)] text-[var(--accent)] focus:ring-0 cursor-pointer"
                            />
                            <span className="truncate">{d.name}</span>
                          </div>
                          <span className="text-[10px] text-[var(--tertiary)] shrink-0 ml-2">
                            {d.roomName || d.deviceType}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-[var(--border)] bg-[var(--g1)] text-[var(--secondary)] hover:text-[var(--text)] transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || selectedDeviceIds.length === 0 || !newGroupName.trim()}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-[var(--accent)] text-white hover:opacity-95 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
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
