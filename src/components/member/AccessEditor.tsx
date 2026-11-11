import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  getMemberAccess,
  getHomeRooms,
  type AccessScope,
  type AccessLevel,
  type MemberAccessDetailResponse,
  type MemberDeviceAccessDto,
  type UpdateMemberAccessPayload,
} from '../../services/homeApi';
import { getErrorMessage } from '../../utils/errors';
import { notify } from '../ui/notify';
import { Icon } from '../home/HomeIcons';
import { ConfirmModal } from '../ui/ConfirmModal';
import { ChevronRight } from 'lucide-react';

export interface AccessEditorProps {
  homeId: string;
  targetUserId?: string;
  initialData?: MemberAccessDetailResponse;
  onChange?: (payload: UpdateMemberAccessPayload) => void;
  onSave?: (payload: UpdateMemberAccessPayload) => Promise<void>;
  showSaveButton?: boolean;
}

const LEVEL_ORDER: Record<AccessLevel, number> = {
  NONE: 0,
  VIEW: 1,
  CONTROL: 2,
};

export const AccessEditor: React.FC<AccessEditorProps> = ({
  homeId,
  targetUserId,
  initialData,
  onChange,
  onSave,
  showSaveButton = true,
}) => {
  const [scope, setScope] = useState<AccessScope>(initialData?.scope ?? 'ALL');
  const [version, setVersion] = useState<string>(initialData?.version ?? '1');
  const [rooms, setRooms] = useState<{ id: string; name: string }[]>([]);
  const [devices, setDevices] = useState<MemberDeviceAccessDto[]>([]);
  const [roomLevels, setRoomLevels] = useState<Record<string, AccessLevel>>({});
  const [deviceOverrides, setDeviceOverrides] = useState<Record<string, AccessLevel | 'INHERIT'>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRooms, setExpandedRooms] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Baselines for dirty checking and reduction confirmation
  const [initialScope, setInitialScope] = useState<AccessScope>(initialData?.scope ?? 'ALL');
  const [initialRoomLevels, setInitialRoomLevels] = useState<Record<string, AccessLevel>>({});
  const [initialDeviceOverrides, setInitialDeviceOverrides] = useState<Record<string, AccessLevel | 'INHERIT'>>({});

  const [showReductionConfirm, setShowReductionConfirm] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<UpdateMemberAccessPayload | null>(null);

  // Load access detail if editing an existing member
  useEffect(() => {
    let active = true;

    if (initialData) {
      applyLoadedData(initialData);
      return;
    }

    if (targetUserId && homeId) {
      setLoading(true);
      setError(null);

      getMemberAccess(homeId, targetUserId)
        .then((data) => {
          if (active) {
            applyLoadedData(data);
          }
        })
        .catch((err: unknown) => {
          if (active) {
            setError(getErrorMessage(err, 'Không thể tải cấu hình phân quyền'));
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    } else if (homeId) {
      // Invitation mode: fetch rooms and prepare empty scope
      getHomeRooms(homeId)
        .then((roomsData) => {
          if (!active) return;
          setRooms(roomsData);
          const initialLevels: Record<string, AccessLevel> = {};
          roomsData.forEach((r) => {
            initialLevels[r.id] = 'CONTROL';
          });
          setRoomLevels(initialLevels);
          setInitialRoomLevels(initialLevels);
        })
        .catch(() => {});
    }

    return () => {
      active = false;
    };
  }, [homeId, targetUserId, initialData]);

  const applyLoadedData = (data: MemberAccessDetailResponse) => {
    setScope(data.scope);
    setInitialScope(data.scope);
    setVersion(data.version);

    const rList = data.rooms.map((r) => ({ id: r.roomId, name: r.roomName || 'Phòng' }));
    setRooms(rList);
    setDevices(data.devices || []);

    const rLevels: Record<string, AccessLevel> = {};
    data.rooms.forEach((r) => {
      rLevels[r.roomId] = r.level;
    });
    setRoomLevels(rLevels);
    setInitialRoomLevels(rLevels);

    const dOverrides: Record<string, AccessLevel | 'INHERIT'> = {};
    (data.devices || []).forEach((d) => {
      if (d.isOverride && d.level) {
        dOverrides[d.deviceId] = d.level;
      } else {
        dOverrides[d.deviceId] = 'INHERIT';
      }
    });
    setDeviceOverrides(dOverrides);
    setInitialDeviceOverrides(dOverrides);
  };

  const getEffectiveDeviceLevel = useCallback(
    (dev: MemberDeviceAccessDto): AccessLevel => {
      const override = deviceOverrides[dev.deviceId];
      if (override && override !== 'INHERIT') {
        return override;
      }
      if (dev.roomId && roomLevels[dev.roomId]) {
        return roomLevels[dev.roomId];
      }
      return 'NONE';
    },
    [deviceOverrides, roomLevels]
  );

  const getInitialEffectiveDeviceLevel = useCallback(
    (dev: MemberDeviceAccessDto): AccessLevel => {
      if (initialScope === 'ALL') return 'CONTROL';
      const override = initialDeviceOverrides[dev.deviceId];
      if (override && override !== 'INHERIT') {
        return override;
      }
      if (dev.roomId && initialRoomLevels[dev.roomId]) {
        return initialRoomLevels[dev.roomId];
      }
      return 'NONE';
    },
    [initialScope, initialDeviceOverrides, initialRoomLevels]
  );

  // Build payload
  const currentPayload: UpdateMemberAccessPayload = useMemo(() => {
    const roomPayload = Object.entries(roomLevels).map(([roomId, level]) => ({
      roomId,
      level,
    }));

    const devicePayload = Object.entries(deviceOverrides)
      .filter(([_, level]) => level !== 'INHERIT')
      .map(([deviceId, level]) => ({
        deviceId,
        level: level as AccessLevel,
      }));

    return {
      scope,
      version,
      rooms: roomPayload,
      devices: devicePayload,
    };
  }, [scope, version, roomLevels, deviceOverrides]);

  // Notify parent on change
  useEffect(() => {
    onChange?.(currentPayload);
  }, [currentPayload, onChange]);

  // Check dirty state
  const isDirty = useMemo(() => {
    if (scope !== initialScope) return true;
    if (scope === 'ALL') return false;

    for (const r of rooms) {
      if ((roomLevels[r.id] || 'NONE') !== (initialRoomLevels[r.id] || 'NONE')) return true;
    }

    for (const d of devices) {
      if ((deviceOverrides[d.deviceId] || 'INHERIT') !== (initialDeviceOverrides[d.deviceId] || 'INHERIT')) {
        return true;
      }
    }

    return false;
  }, [scope, initialScope, rooms, roomLevels, initialRoomLevels, devices, deviceOverrides, initialDeviceOverrides]);

  // Check if lowering access
  const isReducingAccess = useCallback((): boolean => {
    if (initialScope === 'ALL' && scope === 'CUSTOM') {
      return true;
    }
    if (initialScope === 'CUSTOM' && scope === 'CUSTOM') {
      // Check rooms
      for (const r of rooms) {
        const prev = LEVEL_ORDER[initialRoomLevels[r.id] || 'NONE'];
        const curr = LEVEL_ORDER[roomLevels[r.id] || 'NONE'];
        if (curr < prev) return true;
      }
      // Check devices
      for (const d of devices) {
        const prev = LEVEL_ORDER[getInitialEffectiveDeviceLevel(d)];
        const curr = LEVEL_ORDER[getEffectiveDeviceLevel(d)];
        if (curr < prev) return true;
      }
    }
    return false;
  }, [initialScope, scope, rooms, roomLevels, initialRoomLevels, devices, getInitialEffectiveDeviceLevel, getEffectiveDeviceLevel]);

  const handleSaveClick = () => {
    if (!isDirty || saving) return;

    if (isReducingAccess()) {
      setPendingPayload(currentPayload);
      setShowReductionConfirm(true);
    } else {
      executeSave(currentPayload);
    }
  };

  const executeSave = async (payload: UpdateMemberAccessPayload) => {
    if (!onSave) return;
    try {
      setSaving(true);
      await onSave(payload);
      setInitialScope(payload.scope);
      setInitialRoomLevels({ ...roomLevels });
      setInitialDeviceOverrides({ ...deviceOverrides });
      notify.success('Cập nhật quyền truy cập thành công');
    } catch (err: unknown) {
      notify.error(getErrorMessage(err, 'Không thể cập nhật quyền truy cập'));
    } finally {
      setSaving(false);
      setShowReductionConfirm(false);
      setPendingPayload(null);
    }
  };

  const toggleRoomExpand = (roomId: string) => {
    setExpandedRooms((prev) => ({
      ...prev,
      [roomId]: !prev[roomId],
    }));
  };

  const handleRoomLevelChange = (roomId: string, level: AccessLevel) => {
    setRoomLevels((prev) => ({
      ...prev,
      [roomId]: level,
    }));
  };

  const handleDeviceLevelChange = (deviceId: string, level: AccessLevel | 'INHERIT') => {
    setDeviceOverrides((prev) => ({
      ...prev,
      [deviceId]: level,
    }));
  };

  // Group devices by room
  const devicesByRoom = useMemo(() => {
    const map: Record<string, MemberDeviceAccessDto[]> = {};
    const unassigned: MemberDeviceAccessDto[] = [];

    devices.forEach((d) => {
      if (d.roomId) {
        if (!map[d.roomId]) map[d.roomId] = [];
        map[d.roomId].push(d);
      } else {
        unassigned.push(d);
      }
    });

    return { map, unassigned };
  }, [devices]);

  // Filtered rooms and unassigned devices
  const filteredRooms = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return rooms;

    return rooms.filter((r) => {
      const matchRoom = r.name.toLowerCase().includes(query);
      const roomDevs = devicesByRoom.map[r.id] || [];
      const matchDev = roomDevs.some((d) => (d.deviceName || '').toLowerCase().includes(query));
      return matchRoom || matchDev;
    });
  }, [rooms, searchQuery, devicesByRoom]);

  const filteredUnassignedDevices = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return devicesByRoom.unassigned;
    return devicesByRoom.unassigned.filter((d) => (d.deviceName || '').toLowerCase().includes(query));
  }, [devicesByRoom.unassigned, searchQuery]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center space-y-3">
        <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-[var(--secondary)]">Đang tải thông tin phân quyền…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs text-center space-y-2">
        <p>{error}</p>
        <button
          type="button"
          onClick={() => {
            if (targetUserId && homeId) {
              setLoading(true);
              getMemberAccess(homeId, targetUserId)
                .then(applyLoadedData)
                .catch((err) => setError(getErrorMessage(err, 'Lỗi kết nối')))
                .finally(() => setLoading(false));
            }
          }}
          className="px-3 py-1 text-xs font-semibold rounded-lg bg-rose-500/15 hover:bg-rose-500/25 transition-colors cursor-pointer"
        >
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Scope Switch (Segmented Control) ── */}
      <div className="p-1 rounded-xl bg-[var(--muted)] border border-[var(--border)] grid grid-cols-2 gap-1">
        <button
          type="button"
          onClick={() => setScope('ALL')}
          className={`h-9 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            scope === 'ALL'
              ? 'bg-[var(--solid)] text-[var(--text)] shadow-sm'
              : 'text-[var(--secondary)] hover:text-[var(--text)]'
          }`}
        >
          <Icon name="home" size={14} />
          <span>Toàn bộ nhà</span>
        </button>
        <button
          type="button"
          onClick={() => setScope('CUSTOM')}
          className={`h-9 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            scope === 'CUSTOM'
              ? 'bg-[var(--solid)] text-[var(--text)] shadow-sm'
              : 'text-[var(--secondary)] hover:text-[var(--text)]'
          }`}
        >
          <Icon name="shield" size={14} />
          <span>Tùy chỉnh</span>
        </button>
      </div>

      {scope === 'ALL' ? (
        <div className="p-4 rounded-2xl glass-g1 border border-[var(--border)] text-xs text-[var(--secondary)] leading-relaxed space-y-1.5">
          <p className="font-medium text-[var(--text)]">Toàn quyền truy cập</p>
          <p>
            Thành viên có quyền xem trạng thái và điều khiển toàn bộ thiết bị trong nhà, chạy các kịch bản và theo dõi năng lượng.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Search Bar */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--secondary)] pointer-events-none">
              <Icon name="search" size={14} />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm phòng hoặc thiết bị…"
              className="w-full h-10 pl-9 pr-3 rounded-xl bg-[var(--solid)] border border-[var(--border)] text-xs text-[var(--text)] placeholder:text-[var(--secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--secondary)] hover:text-[var(--text)]"
              >
                <Icon name="x" size={14} />
              </button>
            )}
          </div>

          {/* Rooms List */}
          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {filteredRooms.map((room) => {
              const currentRoomLevel = roomLevels[room.id] || 'NONE';
              const isExpanded = !!expandedRooms[room.id] || !!searchQuery;
              const roomDevices = devicesByRoom.map[room.id] || [];

              return (
                <div
                  key={room.id}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--solid)]/60 overflow-hidden transition-all"
                >
                  {/* Room Row */}
                  <div className="p-3.5 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => toggleRoomExpand(room.id)}
                      className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer group"
                    >
                      <span
                        className={`text-[var(--secondary)] transition-transform duration-200 shrink-0 ${
                          isExpanded ? 'rotate-90' : ''
                        }`}
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                      <strong className="text-xs font-semibold text-[var(--text)] truncate group-hover:text-[var(--accent)] transition-colors">
                        {room.name}
                      </strong>
                      <span className="text-[11px] text-[var(--secondary)] shrink-0">
                        ({roomDevices.length} thiết bị)
                      </span>
                    </button>

                    {/* Room Level Segmented Control: [Không | Xem | Điều khiển] */}
                    <div className="inline-flex rounded-lg p-0.5 bg-[var(--muted)] border border-[var(--border)] shrink-0">
                      {(['NONE', 'VIEW', 'CONTROL'] as AccessLevel[]).map((lvl) => {
                        const isSelected = currentRoomLevel === lvl;
                        const label = lvl === 'NONE' ? 'Không' : lvl === 'VIEW' ? 'Xem' : 'Điều khiển';
                        return (
                          <button
                            key={lvl}
                            type="button"
                            onClick={() => handleRoomLevelChange(room.id, lvl)}
                            className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-[var(--solid)] text-[var(--accent)] font-semibold shadow-xs'
                                : 'text-[var(--secondary)] hover:text-[var(--text)]'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Devices in Room */}
                  {isExpanded && roomDevices.length > 0 && (
                    <div className="border-t border-[var(--border)]/60 bg-[var(--muted)]/40 p-3 space-y-2.5">
                      {roomDevices.map((dev) => {
                        const override = deviceOverrides[dev.deviceId] || 'INHERIT';
                        const effective = getEffectiveDeviceLevel(dev);
                        const effectiveLabel =
                          effective === 'NONE' ? 'Không' : effective === 'VIEW' ? 'Xem' : 'Điều khiển';

                        return (
                          <div
                            key={dev.deviceId}
                            className="flex items-center justify-between gap-3 p-2 rounded-xl bg-[var(--solid)]/80 border border-[var(--border)]/60 text-xs"
                          >
                            <div className="min-w-0 flex-1">
                              <span className="font-medium text-[var(--text)] truncate block">
                                {dev.deviceName || 'Thiết bị'}
                              </span>
                              <span className="text-[10px] text-[var(--secondary)] block mt-0.5">
                                {override === 'INHERIT'
                                  ? `Theo phòng (Hiện tại: ${effectiveLabel})`
                                  : `Ghi đè: ${effectiveLabel}`}
                              </span>
                            </div>

                            {/* Device Segmented Control: [Theo phòng | Không | Xem | ĐK] */}
                            <div className="inline-flex rounded-lg p-0.5 bg-[var(--muted)] border border-[var(--border)] shrink-0">
                              {(['INHERIT', 'NONE', 'VIEW', 'CONTROL'] as const).map((opt) => {
                                const isSelected = override === opt;
                                const label =
                                  opt === 'INHERIT' ? 'Theo phòng' : opt === 'NONE' ? 'Không' : opt === 'VIEW' ? 'Xem' : 'ĐK';
                                return (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => handleDeviceLevelChange(dev.deviceId, opt)}
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-all cursor-pointer ${
                                      isSelected
                                        ? 'bg-[var(--solid)] text-[var(--accent)] font-semibold shadow-xs'
                                        : 'text-[var(--secondary)] hover:text-[var(--text)]'
                                    }`}
                                  >
                                    {label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Unassigned Devices */}
            {filteredUnassignedDevices.length > 0 && (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--solid)]/60 overflow-hidden">
                <div className="p-3.5 flex items-center justify-between">
                  <div>
                    <strong className="text-xs font-semibold text-[var(--text)] block">
                      Thiết bị chưa phân phòng
                    </strong>
                    <span className="text-[11px] text-[var(--secondary)]">
                      Mặc định: Không truy cập
                    </span>
                  </div>
                </div>

                <div className="border-t border-[var(--border)]/60 bg-[var(--muted)]/40 p-3 space-y-2.5">
                  {filteredUnassignedDevices.map((dev) => {
                    const override = deviceOverrides[dev.deviceId] || 'NONE';
                    return (
                      <div
                        key={dev.deviceId}
                        className="flex items-center justify-between gap-3 p-2 rounded-xl bg-[var(--solid)]/80 border border-[var(--border)]/60 text-xs"
                      >
                        <span className="font-medium text-[var(--text)] truncate">
                          {dev.deviceName || 'Thiết bị'}
                        </span>
                        <div className="inline-flex rounded-lg p-0.5 bg-[var(--muted)] border border-[var(--border)] shrink-0">
                          {(['NONE', 'VIEW', 'CONTROL'] as AccessLevel[]).map((lvl) => {
                            const isSelected = override === lvl;
                            const label = lvl === 'NONE' ? 'Không' : lvl === 'VIEW' ? 'Xem' : 'ĐK';
                            return (
                              <button
                                key={lvl}
                                type="button"
                                onClick={() => handleDeviceLevelChange(dev.deviceId, lvl)}
                                className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-[var(--solid)] text-[var(--accent)] font-semibold shadow-xs'
                                    : 'text-[var(--secondary)] hover:text-[var(--text)]'
                                }`}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Save Button for MemberPanel */}
      {showSaveButton && onSave && (
        <div className="pt-2">
          <button
            type="button"
            disabled={!isDirty || saving}
            onClick={handleSaveClick}
            className="w-full h-11 px-4 rounded-xl text-xs font-semibold bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            {saving ? 'Đang lưu…' : 'Lưu quyền'}
          </button>
        </div>
      )}

      {/* Reduction Warning Modal */}
      <ConfirmModal
        isOpen={showReductionConfirm}
        title="Giảm quyền truy cập của thành viên?"
        description="Thành viên sẽ mất quyền xem hoặc điều khiển các thiết bị tương ứng ngay lập tức, và kết nối thời gian thực sẽ được tải lại."
        confirmText="Xác nhận giảm quyền"
        cancelText="Hủy bỏ"
        variant="warning"
        loading={saving}
        onConfirm={() => {
          if (pendingPayload) {
            executeSave(pendingPayload);
          }
        }}
        onCancel={() => {
          setShowReductionConfirm(false);
          setPendingPayload(null);
        }}
      />
    </div>
  );
};
