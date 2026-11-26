import { confirmDialog } from '../ui/confirmDialog';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  Pencil,
  Search,
  Palette,
  Wind,
  Thermometer,
} from 'lucide-react';
import type { DeviceResponse } from '../../types/device';
import type { DeviceGroupResponse, DeviceGroupRequest } from '../../types/deviceGroup';
import {
  getHomeDeviceGroups,
  createDeviceGroup,
  updateDeviceGroup,
  deleteDeviceGroup,
  sendGroupCommand,
} from '../../services/deviceGroupApi';
import {
  getDeviceCapabilityMap,
  isApertureDeviceType,
  isFanDevice,
  isRgbLightDevice,
  isTvDevice,
  isWaterPumpDevice,
} from './deviceHelpers';
import { notify } from '../ui/notify';

const GROUP_RGB_PRESETS = [
  { hex: '#ffe4b5', label: 'Vàng ấm' },
  { hex: '#f59e0b', label: 'Hổ phách' },
  { hex: '#ef4444', label: 'Đỏ' },
  { hex: '#ec4899', label: 'Hồng' },
  { hex: '#8b5cf6', label: 'Tím' },
  { hex: '#3b82f6', label: 'Xanh dương' },
  { hex: '#10b981', label: 'Xanh ngọc' },
] as const;

const GROUP_AC_MODES = [
  { code: 'COOL', label: 'Lạnh' },
  { code: 'DRY', label: 'Hút ẩm' },
  { code: 'HEAT', label: 'Sưởi' },
  { code: 'AUTO', label: 'Tự động' },
] as const;

export interface GroupCapabilitySummary {
  powerCount: number;
  dimmableCount: number;
  colorCount: number;
  fanCount: number;
  acCount: number;
  apertureCount: number;
  onlineCount: number;
  nonControllableCount: number;
  hasPower: boolean;
  hasBrightness: boolean;
  hasColor: boolean;
  hasFanSpeed: boolean;
  hasAcControl: boolean;
  hasAperture: boolean;
}

export const isGroupNonControllable = (d?: Partial<DeviceResponse> | null): boolean => {
  if (!d) return true;
  const upper = (d.deviceType || '').trim().toUpperCase();
  if (upper.includes('SENSOR') || upper === 'CAMERA' || upper === 'CAMERA_AI') {
    return true;
  }
  return d.accessLevel === 'VIEW' || d.accessLevel === 'NONE';
};

export const isGroupApertureDevice = (d?: Partial<DeviceResponse> | null): boolean => {
  if (!d || isGroupNonControllable(d)) return false;
  return isApertureDeviceType(d.deviceType) || getDeviceCapabilityMap(d).hasGate;
};

export const isGroupDimmableDevice = (d?: Partial<DeviceResponse> | null): boolean => {
  if (!d || isGroupNonControllable(d) || isGroupApertureDevice(d)) return false;
  return getDeviceCapabilityMap(d).hasBrightness;
};

export const isGroupColorDevice = (d?: Partial<DeviceResponse> | null): boolean => {
  if (!d || isGroupNonControllable(d) || isGroupApertureDevice(d)) return false;
  return isRgbLightDevice(d);
};

export const isGroupFanDevice = (d?: Partial<DeviceResponse> | null): boolean => {
  if (!d || isGroupNonControllable(d) || isGroupApertureDevice(d)) return false;
  return isFanDevice(d);
};

export const isGroupAcDevice = (d?: Partial<DeviceResponse> | null): boolean => {
  if (!d || isGroupNonControllable(d) || isGroupApertureDevice(d)) return false;
  return getDeviceCapabilityMap(d).isAc;
};

export const isGroupPowerDevice = (d?: Partial<DeviceResponse> | null): boolean => {
  if (!d || isGroupNonControllable(d) || isGroupApertureDevice(d)) return false;
  return true;
};

export type GroupDeviceCategory =
  | 'LIGHT'
  | 'LED_RGB'
  | 'AIR_CONDITIONER'
  | 'FAN'
  | 'TV'
  | 'WATER_PUMP'
  | 'APERTURE'
  | 'SWITCH'
  | 'NONE';

export type SelectableGroupCategory = Exclude<GroupDeviceCategory, 'NONE'>;

export const GROUP_CATEGORY_ORDER: SelectableGroupCategory[] = [
  'LIGHT',
  'LED_RGB',
  'AIR_CONDITIONER',
  'FAN',
  'TV',
  'WATER_PUMP',
  'APERTURE',
  'SWITCH',
];

export const GROUP_CATEGORY_META: Record<
  SelectableGroupCategory,
  {
    label: string;
    shortLabel: string;
    badgeCls: string;
    activePillCls: string;
    hintText: string;
  }
> = {
  LIGHT: {
    label: 'Đèn chiếu sáng',
    shortLabel: 'Đèn',
    badgeCls: 'bg-[#fffbeb] text-[#92400e] border-[#d97706]/45',
    activePillCls: 'bg-[#fffbeb] text-[#92400e] border-[#d97706] shadow-xs',
    hintText: 'Nhóm Đèn chiếu sáng — chỉnh Bật/Tắt & Độ sáng chung (khi mọi đèn cùng hỗ trợ).',
  },
  LED_RGB: {
    label: 'Đèn LED RGB',
    shortLabel: 'Đèn LED RGB',
    badgeCls: 'bg-[#fdf2f8] text-[#be185d] border-[#ec4899]/45',
    activePillCls: 'bg-[#fdf2f8] text-[#be185d] border-[#ec4899] shadow-xs',
    hintText: 'Nhóm Đèn LED RGB — chỉnh Bật/Tắt, Độ sáng & Bảng màu RGB chung.',
  },
  AIR_CONDITIONER: {
    label: 'Điều hòa',
    shortLabel: 'Điều hòa',
    badgeCls: 'bg-[#f0f9ff] text-[#0369a1] border-[#0ea5e9]/45',
    activePillCls: 'bg-[#f0f9ff] text-[#0369a1] border-[#0284c7] shadow-xs',
    hintText: 'Nhóm Điều hòa — chỉnh Bật/Tắt, Nhiệt độ (°C) & Chế độ (Lạnh/Hút ẩm/Sưởi/Tự động) hàng loạt.',
  },
  FAN: {
    label: 'Quạt',
    shortLabel: 'Quạt',
    badgeCls: 'bg-[#ecfeff] text-[#0e7490] border-[#06b6d4]/45',
    activePillCls: 'bg-[#ecfeff] text-[#0e7490] border-[#0891b2] shadow-xs',
    hintText: 'Nhóm Quạt — chỉnh Bật/Tắt & Tốc độ Mức 1 / 2 / 3 hàng loạt.',
  },
  TV: {
    label: 'TV',
    shortLabel: 'TV',
    badgeCls: 'bg-[#eef2ff] text-[#4338ca] border-[#6366f1]/45',
    activePillCls: 'bg-[#eef2ff] text-[#4338ca] border-[#4f46e5] shadow-xs',
    hintText: 'Nhóm TV — Bật/Tắt đồng loạt các TV trong nhóm.',
  },
  WATER_PUMP: {
    label: 'Máy bơm',
    shortLabel: 'Máy bơm',
    badgeCls: 'bg-[#eff6ff] text-[#1d4ed8] border-[#3b82f6]/45',
    activePillCls: 'bg-[#eff6ff] text-[#1d4ed8] border-[#2563eb] shadow-xs',
    hintText: 'Nhóm Máy bơm — Bật/Tắt đồng loạt các máy bơm trong nhóm.',
  },
  APERTURE: {
    label: 'Rèm & Cửa',
    shortLabel: 'Rèm & Cửa',
    badgeCls: 'bg-[#f5f3ff] text-[#6d28d9] border-[#8b5cf6]/45',
    activePillCls: 'bg-[#f5f3ff] text-[#6d28d9] border-[#7c3aed] shadow-xs',
    hintText: 'Nhóm Rèm & Cửa — Mở / Dừng / Đóng đồng loạt theo hệ lệnh Đóng/Mở.',
  },
  SWITCH: {
    label: 'Công tắc / Ổ cắm',
    shortLabel: 'Công tắc',
    badgeCls: 'bg-[#f1f5f9] text-[#334155] border-[#94a3b8]/60',
    activePillCls: 'bg-[#f1f5f9] text-[#0f172a] border-[#475569] shadow-xs',
    hintText: 'Nhóm Công tắc / Ổ cắm — Bật/Tắt đồng loạt.',
  },
};

export const getGroupDeviceCategory = (
  d?: Partial<DeviceResponse> | null,
): GroupDeviceCategory => {
  if (!d || isGroupNonControllable(d)) return 'NONE';
  if (isGroupApertureDevice(d)) return 'APERTURE';
  if (isGroupColorDevice(d)) return 'LED_RGB';
  if (isGroupAcDevice(d)) return 'AIR_CONDITIONER';
  if (isGroupFanDevice(d)) return 'FAN';
  if (isTvDevice(d)) return 'TV';
  if (isWaterPumpDevice(d)) return 'WATER_PUMP';
  const upper = (d.deviceType || '').trim().toUpperCase();
  if (
    upper.includes('LIGHT') ||
    upper.includes('LAMP') ||
    upper.includes('BULB') ||
    upper.includes('DIMMER') ||
    isGroupDimmableDevice(d)
  ) {
    return 'LIGHT';
  }
  return 'SWITCH';
};

export const getSelectionDeviceCategory = (
  selectedMembers: Array<Partial<DeviceResponse>>,
): {
  lockedCategory: SelectableGroupCategory | null;
  hasMixedCategoryConflict: boolean;
  categoriesPresent: SelectableGroupCategory[];
} => {
  const seen = new Set<SelectableGroupCategory>();
  for (const m of selectedMembers) {
    const cat = getGroupDeviceCategory(m);
    if (cat !== 'NONE') seen.add(cat);
  }
  const categoriesPresent = GROUP_CATEGORY_ORDER.filter((cat) => seen.has(cat));
  if (categoriesPresent.length > 1) {
    return {
      lockedCategory: null,
      hasMixedCategoryConflict: true,
      categoriesPresent,
    };
  }
  if (categoriesPresent.length === 1) {
    return {
      lockedCategory: categoriesPresent[0],
      hasMixedCategoryConflict: false,
      categoriesPresent,
    };
  }
  return {
    lockedCategory: null,
    hasMixedCategoryConflict: false,
    categoriesPresent: [],
  };
};

export const isDeviceCompatibleWithSelection = (
  d: Partial<DeviceResponse>,
  selectedMembers: Array<Partial<DeviceResponse>>,
): boolean => {
  const deviceCategory = getGroupDeviceCategory(d);
  if (deviceCategory === 'NONE') return false;
  const { lockedCategory, hasMixedCategoryConflict } = getSelectionDeviceCategory(selectedMembers);
  if (hasMixedCategoryConflict) return false;
  if (lockedCategory === null) return true;
  return deviceCategory === lockedCategory;
};

export const analyzeGroupCapabilities = (
  members: Array<Partial<DeviceResponse>>,
): GroupCapabilitySummary => {
  let powerCount = 0;
  let dimmableCount = 0;
  let colorCount = 0;
  let fanCount = 0;
  let acCount = 0;
  let apertureCount = 0;
  let onlineCount = 0;
  let nonControllableCount = 0;

  for (const m of members) {
    if ((m.status || '').toUpperCase() === 'ONLINE') {
      onlineCount += 1;
    }
    if (isGroupNonControllable(m)) {
      nonControllableCount += 1;
      continue;
    }
    if (isGroupApertureDevice(m)) {
      apertureCount += 1;
      continue;
    }
    powerCount += 1;
    if (isGroupDimmableDevice(m)) dimmableCount += 1;
    if (isGroupColorDevice(m)) colorCount += 1;
    if (isGroupFanDevice(m)) fanCount += 1;
    if (isGroupAcDevice(m)) acCount += 1;
  }

  return {
    powerCount,
    dimmableCount,
    colorCount,
    fanCount,
    acCount,
    apertureCount,
    onlineCount,
    nonControllableCount,
    hasPower: powerCount > 0,
    hasBrightness: members.length > 0 && dimmableCount === members.length,
    hasColor: members.length > 0 && colorCount === members.length,
    hasFanSpeed: members.length > 0 && fanCount === members.length,
    hasAcControl: members.length > 0 && acCount === members.length,
    hasAperture: apertureCount > 0,
  };
};

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
  const [groupFeedback, setGroupFeedback] = useState<Record<string, { text: string; isError?: boolean }>>({});
  const [groupBrightness, setGroupBrightness] = useState<Record<string, number>>({});
  const [groupColor, setGroupColor] = useState<Record<string, string>>({});
  const [groupFanSpeed, setGroupFanSpeed] = useState<Record<string, 1 | 2 | 3>>({});
  const [groupAcTemp, setGroupAcTemp] = useState<Record<string, number>>({});
  const [groupAcMode, setGroupAcMode] = useState<Record<string, string>>({});
  const debounceTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const feedbackTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Modal create/edit group state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<DeviceGroupResponse | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [modalSearch, setModalSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | SelectableGroupCategory>('ALL');

  // Cleanup ref timers on unmount
  useEffect(() => {
    const debounceTimers = debounceTimersRef.current;
    const feedbackTimers = feedbackTimersRef.current;
    return () => {
      Object.values(debounceTimers).forEach((timer) => clearTimeout(timer));
      Object.values(feedbackTimers).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  // Body scroll lock & Escape key while Create/Edit modal is open
  useEffect(() => {
    if (!isModalOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        setIsModalOpen(false);
        setEditingGroup(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isModalOpen, isSubmitting]);

  const scheduleClearFeedback = useCallback((groupId: string) => {
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
  }, []);

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

  const openCreateModal = () => {
    setEditingGroup(null);
    setNewGroupName('');
    setSelectedDeviceIds([]);
    setModalSearch('');
    setSelectedCategory('ALL');
    setIsModalOpen(true);
  };

  const openEditModal = (group: DeviceGroupResponse) => {
    const memberIds =
      group.deviceIds && group.deviceIds.length > 0
        ? group.deviceIds
        : (group.devices || []).map((d) => d.id);
    const uniqueMemberIds = Array.from(new Set(memberIds));
    const memberSet = new Set(uniqueMemberIds);
    const initialMembers = [
      ...availableDevices.filter((d) => memberSet.has(d.id)),
      ...(group.devices || []).filter((d) => !availableById.has(d.id) && memberSet.has(d.id)),
    ];
    const { lockedCategory, hasMixedCategoryConflict: initialMixed } =
      getSelectionDeviceCategory(initialMembers);

    setEditingGroup(group);
    setNewGroupName(group.name || '');
    setSelectedDeviceIds(uniqueMemberIds);
    setModalSearch('');
    setSelectedCategory(!initialMixed && lockedCategory ? lockedCategory : 'ALL');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isSubmitting) return;
    setIsModalOpen(false);
    setEditingGroup(null);
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) {
      notify('Vui lòng nhập tên nhóm', 'error');
      return;
    }
    if (selectedDeviceIds.length === 0) {
      notify('Vui lòng chọn ít nhất một thiết bị vào nhóm', 'error');
      return;
    }
    if (hasMixedCategoryConflict) {
      const mixedNames = categoriesPresent
        .map((c) => GROUP_CATEGORY_META[c].shortLabel)
        .join(', ');
      notify(
        `Mỗi nhóm chỉ gồm 1 loại thiết bị. Hãy chỉ giữ lại 1 loại (đang chọn: ${mixedNames}).`,
        'error',
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const req: DeviceGroupRequest = {
        name: newGroupName.trim(),
        icon: editingGroup?.icon || 'layers',
        deviceIds: selectedDeviceIds,
      };
      if (editingGroup) {
        await updateDeviceGroup(editingGroup.id, req);
        notify('Đã cập nhật nhóm thiết bị thành công', 'success');
      } else {
        await createDeviceGroup(homeId, req);
        notify('Đã tạo nhóm thiết bị thành công', 'success');
        setIsExpanded(true);
      }
      setIsModalOpen(false);
      setEditingGroup(null);
      setNewGroupName('');
      setSelectedDeviceIds([]);
      setModalSearch('');
      await reloadGroups();
    } catch {
      notify(editingGroup ? 'Lỗi khi cập nhật nhóm thiết bị' : 'Lỗi khi tạo nhóm thiết bị', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteGroup = async (groupId: string, name: string) => {
    if (!await confirmDialog({ title: `Xóa nhóm "${name}"?`, confirmText: 'Xóa nhóm', variant: 'danger' })) return;
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
    if (debounceTimersRef.current[groupId]) {
      clearTimeout(debounceTimersRef.current[groupId]);
      delete debounceTimersRef.current[groupId];
    }

    setExecutingGroupIds((prev) => ({ ...prev, [groupId]: true }));
    setGroupFeedback((prev) => ({ ...prev, [groupId]: { text: 'Đang gửi lệnh đồng thời...' } }));
    try {
      const res = await sendGroupCommand(groupId, powerAction);
      const isSuccess = (res.successCount ?? 0) > 0;
      setGroupFeedback((prev) => ({
        ...prev,
        [groupId]: {
          text: isSuccess
            ? `✓ ${res.successCount}/${res.totalDevices} thiết bị thành công`
            : `⚠ 0/${res.totalDevices} thiết bị phản hồi`,
          isError: !isSuccess,
        },
      }));
      if (isSuccess) {
        notify(
          `Đã ${powerAction === 'TURN_ON' ? 'bật' : 'tắt'} nhóm (${res.successCount}/${res.totalDevices} thiết bị)`,
          'success',
        );
      } else {
        notify(
          `Không có thiết bị nào trong nhóm phản hồi lệnh ${powerAction === 'TURN_ON' ? 'bật' : 'tắt'}`,
          'error',
        );
      }
      onRefreshDevices?.();
    } catch {
      setGroupFeedback((prev) => ({
        ...prev,
        [groupId]: { text: 'Lỗi thực thi lệnh', isError: true },
      }));
      notify('Lỗi khi điều khiển nhóm thiết bị', 'error');
    } finally {
      setExecutingGroupIds((prev) => {
        const next = { ...prev };
        delete next[groupId];
        return next;
      });
      scheduleClearFeedback(groupId);
    }
  };

  const handleGroupAperture = async (
    groupId: string,
    action: 'OPEN' | 'STOP' | 'CLOSE',
    label: string,
  ) => {
    setExecutingGroupIds((prev) => ({ ...prev, [groupId]: true }));
    setGroupFeedback((prev) => ({ ...prev, [groupId]: { text: `Đang gửi lệnh ${label.toLowerCase()}...` } }));
    try {
      const res = await sendGroupCommand(groupId, action);
      const isSuccess = (res.successCount ?? 0) > 0;
      setGroupFeedback((prev) => ({
        ...prev,
        [groupId]: {
          text: isSuccess
            ? `✓ ${label}: ${res.successCount}/${res.totalDevices} thiết bị`
            : `⚠ 0/${res.totalDevices} thiết bị phản hồi`,
          isError: !isSuccess,
        },
      }));
      if (isSuccess) {
        notify(`${label}: ${res.successCount}/${res.totalDevices} thiết bị`, 'success');
      } else {
        notify(`Không có cửa/rèm nào phản hồi lệnh ${label}`, 'error');
      }
      onRefreshDevices?.();
    } catch {
      setGroupFeedback((prev) => ({
        ...prev,
        [groupId]: { text: 'Lỗi điều khiển cửa/rèm', isError: true },
      }));
      notify('Lỗi khi điều khiển nhóm cửa/rèm', 'error');
    } finally {
      setExecutingGroupIds((prev) => {
        const next = { ...prev };
        delete next[groupId];
        return next;
      });
      scheduleClearFeedback(groupId);
    }
  };

  const handleGroupBrightnessChange = async (groupId: string, brightnessVal: number) => {
    setExecutingGroupIds((prev) => ({ ...prev, [groupId]: true }));
    try {
      const res = await sendGroupCommand(groupId, 'SET_BRIGHTNESS', { brightness: brightnessVal });
      const isSuccess = (res.successCount ?? 0) > 0;
      setGroupFeedback((prev) => ({
        ...prev,
        [groupId]: {
          text: isSuccess
            ? `✓ Độ sáng ${brightnessVal}% (${res.successCount}/${res.totalDevices})`
            : `⚠ 0/${res.totalDevices} thiết bị cập nhật`,
          isError: !isSuccess,
        },
      }));
      if (!isSuccess) {
        notify('Không có thiết bị nào trong nhóm áp dụng độ sáng', 'error');
      }
      onRefreshDevices?.();
    } catch {
      setGroupFeedback((prev) => ({
        ...prev,
        [groupId]: { text: 'Lỗi khi chỉnh độ sáng nhóm', isError: true },
      }));
      notify('Lỗi khi chỉnh độ sáng nhóm', 'error');
    } finally {
      setExecutingGroupIds((prev) => {
        const next = { ...prev };
        delete next[groupId];
        return next;
      });
      scheduleClearFeedback(groupId);
    }
  };

  const handleGroupColorChange = async (groupId: string, hex: string, brightnessVal: number) => {
    const clean = hex.replace('#', '');
    if (clean.length !== 6) return;
    const num = Number.parseInt(clean, 16);
    if (Number.isNaN(num)) return;
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;

    setGroupColor((prev) => ({ ...prev, [groupId]: hex }));
    setExecutingGroupIds((prev) => ({ ...prev, [groupId]: true }));
    try {
      const res = await sendGroupCommand(groupId, 'SET_RGB', {
        r,
        g,
        b,
        brightness: brightnessVal || 80,
      });
      const isSuccess = (res.successCount ?? 0) > 0;
      setGroupFeedback((prev) => ({
        ...prev,
        [groupId]: {
          text: isSuccess
            ? `✓ Đổi màu (${res.successCount}/${res.totalDevices} đèn)`
            : `⚠ 0/${res.totalDevices} đèn cập nhật màu`,
          isError: !isSuccess,
        },
      }));
      if (!isSuccess) {
        notify('Không có đèn RGB nào trong nhóm nhận màu mới', 'error');
      }
      onRefreshDevices?.();
    } catch {
      setGroupFeedback((prev) => ({
        ...prev,
        [groupId]: { text: 'Lỗi khi đổi màu đèn nhóm', isError: true },
      }));
      notify('Lỗi khi đổi màu nhóm đèn RGB', 'error');
    } finally {
      setExecutingGroupIds((prev) => {
        const next = { ...prev };
        delete next[groupId];
        return next;
      });
      scheduleClearFeedback(groupId);
    }
  };

  const handleGroupFanSpeed = async (groupId: string, speed: 1 | 2 | 3) => {
    setGroupFanSpeed((prev) => ({ ...prev, [groupId]: speed }));
    setExecutingGroupIds((prev) => ({ ...prev, [groupId]: true }));
    try {
      const res = await sendGroupCommand(groupId, 'SET_SPEED', { speed });
      const isSuccess = (res.successCount ?? 0) > 0;
      setGroupFeedback((prev) => ({
        ...prev,
        [groupId]: {
          text: isSuccess
            ? `✓ Quạt Mức ${speed} (${res.successCount}/${res.totalDevices})`
            : `⚠ 0/${res.totalDevices} quạt cập nhật`,
          isError: !isSuccess,
        },
      }));
      if (isSuccess) {
        notify(`Đã đặt nhóm quạt Mức ${speed}`, 'success');
      } else {
        notify('Không có quạt nào trong nhóm phản hồi', 'error');
      }
      onRefreshDevices?.();
    } catch {
      setGroupFeedback((prev) => ({
        ...prev,
        [groupId]: { text: 'Lỗi khi chỉnh tốc độ quạt nhóm', isError: true },
      }));
      notify('Lỗi khi chỉnh tốc độ quạt nhóm', 'error');
    } finally {
      setExecutingGroupIds((prev) => {
        const next = { ...prev };
        delete next[groupId];
        return next;
      });
      scheduleClearFeedback(groupId);
    }
  };

  const handleGroupAcTemp = async (groupId: string, nextTemp: number) => {
    const clamped = Math.max(16, Math.min(32, Math.round(nextTemp)));
    setGroupAcTemp((prev) => ({ ...prev, [groupId]: clamped }));
    setExecutingGroupIds((prev) => ({ ...prev, [groupId]: true }));
    try {
      const res = await sendGroupCommand(groupId, 'SET_TEMPERATURE', { temperature: clamped });
      const isSuccess = (res.successCount ?? 0) > 0;
      setGroupFeedback((prev) => ({
        ...prev,
        [groupId]: {
          text: isSuccess
            ? `✓ Nhiệt độ ${clamped}°C (${res.successCount}/${res.totalDevices})`
            : `⚠ 0/${res.totalDevices} điều hòa cập nhật`,
          isError: !isSuccess,
        },
      }));
      if (isSuccess) {
        notify(`Đã đặt điều hòa nhóm: ${clamped}°C`, 'success');
      } else {
        notify('Không có điều hòa nào trong nhóm phản hồi', 'error');
      }
      onRefreshDevices?.();
    } catch {
      setGroupFeedback((prev) => ({
        ...prev,
        [groupId]: { text: 'Lỗi khi chỉnh nhiệt độ điều hòa nhóm', isError: true },
      }));
      notify('Lỗi khi chỉnh nhiệt độ điều hòa nhóm', 'error');
    } finally {
      setExecutingGroupIds((prev) => {
        const next = { ...prev };
        delete next[groupId];
        return next;
      });
      scheduleClearFeedback(groupId);
    }
  };

  const handleGroupAcMode = async (
    groupId: string,
    mode: 'COOL' | 'DRY' | 'HEAT' | 'AUTO',
    label: string,
  ) => {
    setGroupAcMode((prev) => ({ ...prev, [groupId]: mode }));
    setExecutingGroupIds((prev) => ({ ...prev, [groupId]: true }));
    try {
      const res = await sendGroupCommand(groupId, 'SET_MODE', { mode });
      const isSuccess = (res.successCount ?? 0) > 0;
      setGroupFeedback((prev) => ({
        ...prev,
        [groupId]: {
          text: isSuccess
            ? `✓ Chế độ ${label} (${res.successCount}/${res.totalDevices})`
            : `⚠ 0/${res.totalDevices} điều hòa cập nhật`,
          isError: !isSuccess,
        },
      }));
      if (isSuccess) {
        notify(`Đã chuyển chế độ điều hòa nhóm: ${label}`, 'success');
      } else {
        notify('Không có điều hòa nào trong nhóm phản hồi', 'error');
      }
      onRefreshDevices?.();
    } catch {
      setGroupFeedback((prev) => ({
        ...prev,
        [groupId]: { text: 'Lỗi khi đổi chế độ điều hòa nhóm', isError: true },
      }));
      notify('Lỗi khi đổi chế độ điều hòa nhóm', 'error');
    } finally {
      setExecutingGroupIds((prev) => {
        const next = { ...prev };
        delete next[groupId];
        return next;
      });
      scheduleClearFeedback(groupId);
    }
  };

  const handleSliderChange = (groupId: string, val: number) => {
    setGroupBrightness((prev) => ({ ...prev, [groupId]: val }));
    if (debounceTimersRef.current[groupId]) {
      clearTimeout(debounceTimersRef.current[groupId]);
    }
    debounceTimersRef.current[groupId] = setTimeout(() => {
      void handleGroupBrightnessChange(groupId, val);
      delete debounceTimersRef.current[groupId];
    }, 250);
  };

  const handleSliderCommit = (groupId: string, val: number) => {
    if (debounceTimersRef.current[groupId]) {
      clearTimeout(debounceTimersRef.current[groupId]);
      delete debounceTimersRef.current[groupId];
    }
    void handleGroupBrightnessChange(groupId, val);
  };

  const handlePresetClick = (groupId: string, b: number) => {
    if (debounceTimersRef.current[groupId]) {
      clearTimeout(debounceTimersRef.current[groupId]);
      delete debounceTimersRef.current[groupId];
    }
    setGroupBrightness((prev) => ({ ...prev, [groupId]: b }));
    void handleGroupBrightnessChange(groupId, b);
  };

  const availableById = useMemo(
    () => new Map(availableDevices.map((d) => [d.id, d])),
    [availableDevices],
  );

  // Controllable picker list (hides sensors/cameras/VIEW-only, preserves legacy members when editing)
  const combinedPickerDevices = useMemo(() => {
    const seen = new Set<string>();
    const combined: DeviceResponse[] = [];
    for (const d of availableDevices) {
      if (!seen.has(d.id)) {
        seen.add(d.id);
        combined.push(d);
      }
    }
    if (editingGroup?.devices) {
      for (const d of editingGroup.devices) {
        if (!seen.has(d.id)) {
          seen.add(d.id);
          combined.push(d);
        }
      }
    }
    return combined;
  }, [availableDevices, editingGroup]);

  const pickerLookup = useMemo(
    () => new Map(combinedPickerDevices.map((d) => [d.id, d])),
    [combinedPickerDevices],
  );

  const availableCategories = useMemo(() => {
    const counts = new Map<SelectableGroupCategory, number>();
    for (const d of combinedPickerDevices) {
      const cat = getGroupDeviceCategory(d);
      if (cat !== 'NONE') {
        counts.set(cat, (counts.get(cat) ?? 0) + 1);
      }
    }
    return GROUP_CATEGORY_ORDER.filter(
      (cat) => (counts.get(cat) ?? 0) > 0 || selectedCategory === cat,
    ).map((cat) => ({
      category: cat,
      label: GROUP_CATEGORY_META[cat].shortLabel,
      count: counts.get(cat) ?? 0,
    }));
  }, [combinedPickerDevices, selectedCategory]);

  const pickerDevices = useMemo(() => {
    const q = modalSearch.trim().toLowerCase();
    return combinedPickerDevices.filter((d) => {
      const isSelected = selectedDeviceIds.includes(d.id);
      if (isGroupNonControllable(d) && !isSelected) return false;
      if (selectedCategory !== 'ALL' && getGroupDeviceCategory(d) !== selectedCategory && !isSelected) {
        return false;
      }
      if (!q) return true;
      const nameMatch = (d.name || '').toLowerCase().includes(q);
      const roomMatch = (d.roomName || '').toLowerCase().includes(q);
      const typeMatch = (d.deviceType || '').toLowerCase().includes(q);
      return nameMatch || roomMatch || typeMatch;
    });
  }, [combinedPickerDevices, modalSearch, selectedCategory, selectedDeviceIds]);

  const selectedMembers = useMemo(() => {
    return selectedDeviceIds
      .map((id) => pickerLookup.get(id))
      .filter((d): d is DeviceResponse => Boolean(d));
  }, [pickerLookup, selectedDeviceIds]);

  const {
    lockedCategory,
    hasMixedCategoryConflict,
    categoriesPresent,
  } = useMemo(() => getSelectionDeviceCategory(selectedMembers), [selectedMembers]);

  const activeCategory: SelectableGroupCategory | null =
    selectedCategory !== 'ALL' ? selectedCategory : lockedCategory;

  const eligibleVisibleDevices = useMemo(() => {
    if (!activeCategory) return [];
    return pickerDevices.filter((d) => getGroupDeviceCategory(d) === activeCategory);
  }, [pickerDevices, activeCategory]);

  const areAllVisibleSelected =
    eligibleVisibleDevices.length > 0 &&
    eligibleVisibleDevices.every((d) => selectedDeviceIds.includes(d.id));

  const handleSelectCategory = (nextCat: 'ALL' | SelectableGroupCategory) => {
    setSelectedCategory(nextCat);
    if (nextCat === 'ALL') return;
    setSelectedDeviceIds((prev) =>
      prev.filter((id) => {
        const dev = pickerLookup.get(id);
        return dev ? getGroupDeviceCategory(dev) === nextCat : false;
      }),
    );
  };

  const handleToggleSelectAll = () => {
    if (hasMixedCategoryConflict || !activeCategory) return;
    const visibleIds = eligibleVisibleDevices.map((d) => d.id);
    if (visibleIds.length === 0) return;
    if (areAllVisibleSelected) {
      const visibleSet = new Set(visibleIds);
      setSelectedDeviceIds((prev) => prev.filter((id) => !visibleSet.has(id)));
    } else {
      setSelectedDeviceIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  // Preview capabilities of currently selected devices in modal
  const modalSelectionCaps = useMemo(
    () => analyzeGroupCapabilities(selectedMembers),
    [selectedMembers],
  );

  return (
    <div className="w-full tabular-nums">
      {/* ── Section Header Row ── */}
      <div className="flex items-center justify-between gap-3 py-1">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          aria-controls="device-groups-collapsible"
          className="flex items-center gap-2 text-left cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] rounded-lg p-1 -m-1 select-none"
        >
          <h2 className="text-base font-bold text-[#0f172a] group-hover:text-[#2563eb] transition-colors">
            Nhóm thiết bị
          </h2>
          <span className="px-2 py-0.5 rounded-full bg-[#f1f5f9] border border-[#cbd5e1] text-[11px] text-[#475569] font-semibold tabular-nums">
            {groups.length} nhóm
          </span>
          <ChevronDown
            className={`w-4 h-4 text-[#475569] transition-transform duration-200 ${
              isExpanded ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          />
        </button>

        <button
          type="button"
          onClick={openCreateModal}
          title="Tạo nhóm thiết bị mới"
          aria-label="Tạo nhóm thiết bị mới"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#94a3b8]/75 bg-white hover:bg-[#f8fafc] hover:border-[#475569] text-xs font-semibold text-[#0f172a] shadow-2xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
        >
          <Plus className="w-3.5 h-3.5 text-[#475569]" />
          <span>Tạo nhóm</span>
        </button>
      </div>

      {/* ── Content: Collapsible List ── */}
      {isExpanded && (
        <div id="device-groups-collapsible" className="mt-3 space-y-3">
          {isLoading ? (
            <div className="text-center py-5 text-xs text-[#475569]">
              Đang tải danh sách nhóm...
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-[#94a3b8]/65 rounded-2xl bg-[#f8fafc] space-y-2.5">
              <p className="text-sm font-bold text-[#0f172a]">Chưa có nhóm thiết bị nào</p>
              <p className="text-xs text-[#475569] max-w-md mx-auto">
                Tạo nhóm (ví dụ: &quot;Toàn bộ đèn tầng 1&quot; hoặc &quot;Quạt &amp; Đèn khách&quot;) để điều khiển nhiều thiết bị cùng lúc.
              </p>
              <button
                type="button"
                onClick={openCreateModal}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#94a3b8]/80 bg-white hover:bg-[#eff6ff] hover:border-[#2563eb] text-xs font-semibold text-[#0f172a] transition-all cursor-pointer shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5 text-[#2563eb]" />
                <span>Tạo nhóm đầu tiên</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {groups.map((group) => {
                const isBusy = !!executingGroupIds[group.id];
                const feedback = groupFeedback[group.id];
                const currentBrightness = groupBrightness[group.id] ?? 80;
                const members: DeviceResponse[] =
                  group.devices && group.devices.length > 0
                    ? group.devices.map((d) => availableById.get(d.id) ?? d)
                    : (group.deviceIds || [])
                        .map((id) => availableById.get(id))
                        .filter((d): d is DeviceResponse => Boolean(d));
                const caps = analyzeGroupCapabilities(members);
                const memberCount = members.length || group.deviceCount;
                const groupCategoryInfo = getSelectionDeviceCategory(members);
                const categoryBadge = groupCategoryInfo.hasMixedCategoryConflict
                  ? {
                      label: 'Hỗn hợp',
                      cls: 'bg-[#fffbeb] text-[#92400e] border-[#d97706]/45',
                      title: 'Nhóm cũ gồm nhiều loại thiết bị — nhấn Sửa để tách theo 1 loại',
                    }
                  : groupCategoryInfo.lockedCategory
                    ? {
                        label: GROUP_CATEGORY_META[groupCategoryInfo.lockedCategory].shortLabel,
                        cls: GROUP_CATEGORY_META[groupCategoryInfo.lockedCategory].badgeCls,
                        title: GROUP_CATEGORY_META[groupCategoryInfo.lockedCategory].label,
                      }
                    : null;

                return (
                  <div
                    key={group.id}
                    className="p-4 rounded-2xl border border-[#cbd5e1] bg-white hover:border-[#3b82f6]/60 transition-all shadow-xs flex flex-col justify-between space-y-3.5"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm text-[#0f172a] truncate">{group.name}</h3>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            {categoryBadge && (
                              <span
                                title={categoryBadge.title}
                                className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${categoryBadge.cls}`}
                              >
                                {categoryBadge.label}
                              </span>
                            )}
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#eff6ff] text-[#1d4ed8] border border-[#3b82f6]/35">
                              {memberCount} thiết bị
                            </span>
                            <span
                              className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${
                                caps.onlineCount > 0
                                  ? 'bg-[#ecfdf5] text-[#047857] border-[#10b981]/35'
                                  : 'bg-[#f1f5f9] text-[#475569] border-[#cbd5e1]'
                              }`}
                            >
                              {caps.onlineCount}/{memberCount} trực tuyến
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => openEditModal(group)}
                            className="p-1.5 rounded-lg border border-[#cbd5e1] bg-white text-[#475569] hover:text-[#2563eb] hover:border-[#3b82f6]/55 hover:bg-[#eff6ff] transition-colors cursor-pointer"
                            title="Sửa tên & thêm/bớt thiết bị"
                            aria-label={`Sửa nhóm ${group.name}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteGroup(group.id, group.name)}
                            className="p-1.5 rounded-lg border border-[#cbd5e1] bg-white text-[#475569] hover:text-[#be123c] hover:border-[#f43f5e]/55 hover:bg-[#fff1f2] transition-colors cursor-pointer"
                            title="Xóa nhóm này"
                            aria-label={`Xóa nhóm ${group.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Members preview badges */}
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {members.slice(0, 5).map((d) => {
                          const isOnline = (d.status || '').toUpperCase() === 'ONLINE';
                          return (
                            <span
                              key={d.id}
                              className="px-2 py-0.5 text-[11px] font-medium rounded-lg bg-[#f8fafc] text-[#0f172a] border border-[#cbd5e1] inline-flex items-center gap-1.5 max-w-[140px]"
                              title={`${d.name} (${isOnline ? 'Trực tuyến' : 'Ngoại tuyến'})`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                  isOnline ? 'bg-[#10b981]' : 'bg-[#94a3b8]'
                                }`}
                                aria-hidden="true"
                              />
                              <span className="truncate">{d.name}</span>
                            </span>
                          );
                        })}
                        {members.length > 5 && (
                          <button
                            type="button"
                            onClick={() => openEditModal(group)}
                            className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-[#eff6ff] text-[#1d4ed8] border border-[#3b82f6]/35 hover:bg-[#dbeafe] cursor-pointer"
                            title="Xem & chỉnh sửa danh sách thành viên"
                          >
                            +{members.length - 5}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Group Actions */}
                    <div className="space-y-2.5 pt-2.5 border-t border-[#cbd5e1]/70">
                      {feedback && (
                        <div
                          className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border ${
                            feedback.isError
                              ? 'bg-[#fff1f2] text-[#be123c] border-[#f43f5e]/40'
                              : 'bg-[#ecfdf5] text-[#047857] border-[#10b981]/40'
                          }`}
                        >
                          {feedback.text}
                        </div>
                      )}

                      {caps.hasPower && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleGroupPower(group.id, 'TURN_ON')}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#ecfdf5] border border-[#10b981]/55 text-[#047857] text-xs font-bold hover:bg-[#d1fae5] transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            <Power className="w-3.5 h-3.5" />
                            Bật tất cả
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleGroupPower(group.id, 'TURN_OFF')}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#fff1f2] border border-[#f43f5e]/50 text-[#be123c] text-xs font-bold hover:bg-[#ffe4e6] transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            <PowerOff className="w-3.5 h-3.5" />
                            Tắt tất cả
                          </button>
                        </div>
                      )}

                      {caps.hasAperture && (
                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleGroupAperture(group.id, 'OPEN', 'Mở tất cả')}
                            className="py-1.5 px-2 rounded-xl bg-[#ecfdf5] border border-[#10b981]/55 text-[#047857] text-[11px] font-bold hover:bg-[#d1fae5] transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            Mở tất cả
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleGroupAperture(group.id, 'STOP', 'Dừng')}
                            className="py-1.5 px-2 rounded-xl bg-[#fffbeb] border border-[#d97706]/50 text-[#92400e] text-[11px] font-bold hover:bg-[#fef3c7] transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            Dừng
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleGroupAperture(group.id, 'CLOSE', 'Đóng tất cả')}
                            className="py-1.5 px-2 rounded-xl bg-[#fff1f2] border border-[#f43f5e]/50 text-[#be123c] text-[11px] font-bold hover:bg-[#ffe4e6] transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            Đóng tất cả
                          </button>
                        </div>
                      )}

                      {/* Group Brightness Slider & Presets — ONLY when ALL members support brightness */}
                      {caps.hasBrightness && (
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="flex items-center gap-1.5 text-[#475569] font-semibold">
                              <SunMedium className="w-3.5 h-3.5 text-[#d97706]" />
                              Độ sáng chung nhóm
                            </span>
                            <span className="font-bold text-[#0f172a] tabular-nums">{currentBrightness}%</span>
                          </div>
                          <input
                            type="range"
                            min="1"
                            max="100"
                            value={currentBrightness}
                            disabled={isBusy}
                            onChange={(e) => handleSliderChange(group.id, Number(e.target.value))}
                            onPointerUp={(e) =>
                              handleSliderCommit(group.id, Number((e.target as HTMLInputElement).value))
                            }
                            onKeyUp={(e) => {
                              if (
                                ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(
                                  e.key,
                                )
                              ) {
                                handleSliderCommit(group.id, Number((e.target as HTMLInputElement).value));
                              }
                            }}
                            className="w-full h-1.5 bg-[#e2e8f0] rounded-lg appearance-none cursor-pointer accent-[#d97706] disabled:opacity-50"
                            title="Kéo hoặc dùng phím mũi tên để điều chỉnh độ sáng đồng loạt cho các đèn trong nhóm"
                          />
                          <div className="flex items-center gap-1.5 pt-0.5">
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
                                      ? 'bg-[#d97706] text-white border-[#b45309] shadow-2xs font-extrabold'
                                      : 'bg-white text-[#78350f] border-[#d97706]/45 hover:bg-[#fef3c7]'
                                  }`}
                                >
                                  {b}%
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Group RGB Color — ONLY when ALL members are LED_RGB */}
                      {caps.hasColor && (() => {
                        const currentColorHex = (groupColor[group.id] ?? '#f59e0b').toLowerCase();
                        return (
                          <div className="space-y-1.5 pt-1.5 border-t border-[#e2e8f0]">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="flex items-center gap-1.5 text-[#475569] font-semibold">
                                <Palette className="w-3.5 h-3.5 text-[#db2777]" />
                                Màu sắc chung nhóm
                              </span>
                              <span className="font-mono font-bold text-[#0f172a] uppercase">{currentColorHex}</span>
                            </div>
                            <div className="flex items-center justify-between gap-1.5">
                              {GROUP_RGB_PRESETS.map((preset) => {
                                const isPresetColor = currentColorHex === preset.hex.toLowerCase();
                                return (
                                  <button
                                    key={preset.hex}
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => void handleGroupColorChange(group.id, preset.hex, currentBrightness)}
                                    title={preset.label}
                                    aria-label={`Chọn màu ${preset.label}`}
                                    className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer disabled:opacity-50 shrink-0 ${
                                      isPresetColor
                                        ? 'border-[#0f172a] scale-110 shadow-xs'
                                        : 'border-white ring-1 ring-[#cbd5e1] hover:scale-105'
                                    }`}
                                    style={{ backgroundColor: preset.hex }}
                                  />
                                );
                              })}
                              <label
                                className="w-7 h-7 rounded-full border border-[#cbd5e1] bg-white flex items-center justify-center cursor-pointer overflow-hidden shadow-2xs shrink-0"
                                title="Chọn màu RGB tùy chỉnh"
                              >
                                <input
                                  type="color"
                                  value={currentColorHex}
                                  disabled={isBusy}
                                  onChange={(e) => {
                                    void handleGroupColorChange(group.id, e.target.value, currentBrightness);
                                  }}
                                  aria-label="Chọn màu RGB tùy chỉnh"
                                  className="w-8 h-8 cursor-pointer border-0 bg-transparent p-0"
                                />
                              </label>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Group Fan Speed — ONLY when ALL members are FAN */}
                      {caps.hasFanSpeed && (
                        <div className="space-y-1.5 pt-1.5 border-t border-[#e2e8f0]">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="flex items-center gap-1.5 text-[#475569] font-semibold">
                              <Wind className="w-3.5 h-3.5 text-[#0284c7]" />
                              Tốc độ quạt chung
                            </span>
                            {groupFanSpeed[group.id] && (
                              <span className="font-bold text-[#0f172a]">Mức {groupFanSpeed[group.id]}</span>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-1.5">
                            {([1, 2, 3] as const).map((lvl) => {
                              const isActiveLvl = groupFanSpeed[group.id] === lvl;
                              return (
                                <button
                                  key={lvl}
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => void handleGroupFanSpeed(group.id, lvl)}
                                  className={`py-1.5 px-2 rounded-xl border text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-50 ${
                                    isActiveLvl
                                      ? 'bg-[#0284c7] text-white border-[#0369a1] shadow-2xs'
                                      : 'bg-white text-[#0f172a] border-[#0ea5e9]/50 hover:bg-[#f0f9ff]'
                                  }`}
                                >
                                  Mức {lvl}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Group AC Controls — ONLY when ALL members are AIR_CONDITIONER */}
                      {caps.hasAcControl && (() => {
                        const firstAcMember = members.find((m) => isGroupAcDevice(m));
                        const rawTemp = Number(firstAcMember?.currentState?.temperature ?? 24);
                        const acTempVal =
                          groupAcTemp[group.id] ??
                          (Number.isFinite(rawTemp) ? Math.max(16, Math.min(32, rawTemp)) : 24);
                        const acModeVal =
                          groupAcMode[group.id] ??
                          String(firstAcMember?.currentState?.mode ?? 'COOL').toUpperCase();
                        return (
                          <div className="space-y-2 pt-1.5 border-t border-[#e2e8f0]">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="flex items-center gap-1.5 text-[#475569] font-semibold">
                                <Thermometer className="w-3.5 h-3.5 text-[#0284c7]" />
                                Điều hòa chung
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={isBusy || acTempVal <= 16}
                                  onClick={() => void handleGroupAcTemp(group.id, acTempVal - 1)}
                                  aria-label="Giảm nhiệt độ nhóm"
                                  className="w-7 h-7 rounded-lg border border-[#0ea5e9]/60 bg-[#f0f9ff] text-[#0f172a] text-xs font-bold flex items-center justify-center hover:bg-[#e0f2fe] disabled:opacity-50 cursor-pointer"
                                >
                                  -
                                </button>
                                <span className="w-10 text-center text-sm font-extrabold text-[#0f172a] tabular-nums">
                                  {acTempVal}°C
                                </span>
                                <button
                                  type="button"
                                  disabled={isBusy || acTempVal >= 32}
                                  onClick={() => void handleGroupAcTemp(group.id, acTempVal + 1)}
                                  aria-label="Tăng nhiệt độ nhóm"
                                  className="w-7 h-7 rounded-lg border border-[#f97316]/60 bg-[#fff7ed] text-[#0f172a] text-xs font-bold flex items-center justify-center hover:bg-[#ffedd5] disabled:opacity-50 cursor-pointer"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                            <div className="grid grid-cols-4 gap-1">
                              {GROUP_AC_MODES.map((m) => {
                                const isActiveMode = acModeVal === m.code;
                                return (
                                  <button
                                    key={m.code}
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => void handleGroupAcMode(group.id, m.code, m.label)}
                                    className={`py-1 px-1 rounded-lg border text-[10px] font-bold transition-colors cursor-pointer disabled:opacity-50 ${
                                      isActiveMode
                                        ? 'bg-[#0284c7] text-white border-[#0369a1] shadow-2xs'
                                        : 'bg-white text-[#0f172a] border-[#cbd5e1] hover:bg-[#f0f9ff] hover:border-[#0ea5e9]/60'
                                    }`}
                                  >
                                    {m.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}

                      {!caps.hasPower && !caps.hasAperture && (
                        <div className="p-2.5 rounded-xl bg-[#fffbeb] border border-[#d97706]/40 text-[11px] text-[#92400e] flex items-center justify-between gap-2">
                          <span>Nhóm chưa có thiết bị điều khiển được.</span>
                          <button
                            type="button"
                            onClick={() => openEditModal(group)}
                            className="font-bold text-[#78350f] underline hover:no-underline shrink-0 cursor-pointer"
                          >
                            Sửa nhóm
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Modal: Tạo / Chỉnh sửa Nhóm Thiết Bị ── */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/55 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={closeModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="device-group-modal-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl max-h-[calc(100vh-20px)] flex flex-col px-6 py-8 rounded-3xl shadow-2xl border border-[#cbd5e1] bg-white space-y-4 animate-in zoom-in-95 duration-200 overscroll-contain"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#e2e8f0] shrink-0">
              <h3 id="device-group-modal-title" className="text-base font-bold text-[#0f172a] flex items-center gap-2">
                {editingGroup ? (
                  <Pencil className="w-4 h-4 text-[#2563eb]" />
                ) : (
                  <Sparkles className="w-4 h-4 text-[#2563eb]" />
                )}
                {editingGroup ? 'Chỉnh sửa nhóm thiết bị' : 'Tạo nhóm thiết bị mới'}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                disabled={isSubmitting}
                className="p-1.5 text-[#475569] hover:text-[#0f172a] rounded-xl hover:bg-[#f1f5f9] transition-colors cursor-pointer disabled:opacity-50"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveGroup} className="space-y-4 overflow-y-auto pr-0.5">
              <div>
                <label className="block text-xs font-bold text-[#0f172a] mb-1.5">Tên nhóm</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Đèn phòng khách & bếp"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#94a3b8]/80 bg-white text-[#0f172a] placeholder:text-[#64748b] focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all"
                  autoFocus
                />
              </div>

              {availableCategories.length > 0 && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#0f172a]">
                    Loại thiết bị của nhóm
                  </label>
                  <div
                    className="flex flex-wrap gap-1.5"
                    role="group"
                    aria-label="Chọn loại thiết bị của nhóm"
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectCategory('ALL')}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors cursor-pointer ${
                        selectedCategory === 'ALL'
                          ? 'bg-[#eff6ff] text-[#1d4ed8] border-[#2563eb] shadow-xs'
                          : 'bg-[#f8fafc] text-[#475569] border-[#cbd5e1] hover:bg-white hover:text-[#0f172a]'
                      }`}
                    >
                      Tất cả
                    </button>
                    {availableCategories.map((cat) => {
                      const isActive = selectedCategory === cat.category;
                      const meta = GROUP_CATEGORY_META[cat.category];
                      return (
                        <button
                          key={cat.category}
                          type="button"
                          onClick={() => handleSelectCategory(cat.category)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors cursor-pointer ${
                            isActive
                              ? meta.activePillCls
                              : 'bg-[#f8fafc] text-[#475569] border-[#cbd5e1] hover:bg-white hover:text-[#0f172a]'
                          }`}
                        >
                          {cat.label} ({cat.count})
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-xs font-bold text-[#0f172a]">
                    Chọn thiết bị thành viên ({selectedDeviceIds.length} đã chọn)
                  </label>
                  {eligibleVisibleDevices.length > 0 && !hasMixedCategoryConflict && activeCategory && (
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="text-[11px] font-bold text-[#2563eb] hover:underline flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      {areAllVisibleSelected ? (
                        <>
                          <Square className="w-3 h-3" />
                          <span>Bỏ chọn tất cả</span>
                        </>
                      ) : (
                        <>
                          <CheckSquare className="w-3 h-3" />
                          <span>
                            Chọn tất cả {GROUP_CATEGORY_META[activeCategory].shortLabel}
                          </span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#475569] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                    placeholder="Tìm nhanh thiết bị theo tên hoặc phòng..."
                    aria-label="Tìm thiết bị trong nhóm"
                    className="w-full h-8 pl-8 pr-3 rounded-xl border border-[#cbd5e1] bg-[#f8fafc] text-xs text-[#0f172a] placeholder:text-[#64748b] focus:outline-none focus:border-[#2563eb] focus:bg-white transition-colors"
                  />
                </div>

                {hasMixedCategoryConflict ? (
                  <p className="px-2.5 py-1.5 rounded-xl bg-[#fffbeb] border border-[#d97706]/45 text-[11px] font-medium text-[#92400e]">
                    Nhóm đang chọn lẫn nhiều loại thiết bị (
                    {categoriesPresent.map((c) => GROUP_CATEGORY_META[c].shortLabel).join(', ')}).
                    Hãy chọn lại 1 loại ở trên hoặc bỏ tick thiết bị khác loại trước khi lưu.
                  </p>
                ) : activeCategory ? (
                  <p className="text-[11px] font-medium text-[#1d4ed8]">
                    {GROUP_CATEGORY_META[activeCategory].hintText}
                  </p>
                ) : (
                  <p className="text-[11px] text-[#475569]">
                    Chọn một loại thiết bị ở trên hoặc tick thiết bị đầu tiên — nhóm chỉ ghép thiết bị cùng 1 loại (đã ẩn cảm biến &amp; camera).
                  </p>
                )}

                <div className="max-h-[420px] overflow-y-auto custom-scrollbar border border-[#cbd5e1] rounded-2xl p-2 space-y-1 bg-[#f8fafc]">
                  {pickerDevices.length === 0 ? (
                    <div className="py-6 text-center text-xs text-[#475569]">
                      {modalSearch.trim()
                        ? 'Không tìm thấy thiết bị khớp với từ khóa'
                        : selectedCategory !== 'ALL'
                          ? `Không có thiết bị loại ${GROUP_CATEGORY_META[selectedCategory].shortLabel}`
                          : 'Không có thiết bị khả dụng để thêm vào nhóm'}
                    </div>
                  ) : (
                    pickerDevices.map((d) => {
                      const isSelected = selectedDeviceIds.includes(d.id);
                      const isOnline = (d.status || '').toUpperCase() === 'ONLINE';
                      const isNonCtrl = isGroupNonControllable(d);
                      const deviceCategory = getGroupDeviceCategory(d);
                      const isIncompatible =
                        !isSelected &&
                        (hasMixedCategoryConflict ||
                          !isDeviceCompatibleWithSelection(d, selectedMembers) ||
                          (selectedCategory !== 'ALL' && deviceCategory !== selectedCategory));
                      const incompatibleTitle = isIncompatible
                        ? activeCategory
                          ? `Nhóm ${GROUP_CATEGORY_META[activeCategory].shortLabel} chỉ ghép cùng loại ${GROUP_CATEGORY_META[activeCategory].shortLabel}`
                          : 'Thiết bị không tương thích với lựa chọn hiện tại'
                        : undefined;
                      const capBadge = isNonCtrl
                        ? {
                            label: 'Không điều khiển',
                            cls: 'bg-[#fff1f2] text-[#be123c] border-[#f43f5e]/40',
                          }
                        : deviceCategory !== 'NONE'
                          ? {
                              label:
                                deviceCategory === 'LIGHT' && isGroupDimmableDevice(d)
                                  ? 'Đèn · Độ sáng'
                                  : GROUP_CATEGORY_META[deviceCategory].shortLabel,
                              cls: GROUP_CATEGORY_META[deviceCategory].badgeCls,
                            }
                          : {
                              label: 'Bật/Tắt',
                              cls: 'bg-[#eff6ff] text-[#1d4ed8] border-[#3b82f6]/35',
                            };

                      return (
                        <label
                          key={d.id}
                          title={incompatibleTitle}
                          className={`flex items-center justify-between gap-2 p-2.5 rounded-xl text-xs font-medium transition-colors ${
                            isIncompatible
                              ? 'opacity-45 cursor-not-allowed bg-[#f1f5f9]/80 text-[#475569] border border-transparent'
                              : isSelected
                                ? 'cursor-pointer bg-[#eff6ff] text-[#0f172a] border border-[#3b82f6]/55 font-semibold'
                                : 'cursor-pointer bg-white/80 hover:bg-white text-[#0f172a] border border-transparent hover:border-[#cbd5e1]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={isIncompatible}
                              onChange={(e) => {
                                if (isIncompatible) return;
                                const isChecked = e.target.checked;
                                if (
                                  isChecked &&
                                  selectedCategory === 'ALL' &&
                                  selectedDeviceIds.length === 0 &&
                                  deviceCategory !== 'NONE'
                                ) {
                                  setSelectedCategory(deviceCategory);
                                }
                                setSelectedDeviceIds((prev) =>
                                  isChecked
                                    ? prev.includes(d.id)
                                      ? prev
                                      : [...prev, d.id]
                                    : prev.filter((id) => id !== d.id),
                                );
                              }}
                              className="rounded border-[#94a3b8] accent-[#2563eb] focus:ring-0 cursor-pointer shrink-0 disabled:cursor-not-allowed"
                            />
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                isOnline ? 'bg-[#10b981]' : 'bg-[#94a3b8]'
                              }`}
                              title={isOnline ? 'Trực tuyến' : 'Ngoại tuyến'}
                            />
                            <div className="min-w-0">
                              <span className="block truncate font-semibold text-[#0f172a]">{d.name}</span>
                              <span className="block text-[10px] text-[#475569] truncate">
                                {d.roomName || d.deviceType}
                              </span>
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border shrink-0 ${capBadge.cls}`}
                          >
                            {capBadge.label}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {selectedDeviceIds.length > 0 && (
                <div className="px-3 py-2 rounded-xl bg-[#f8fafc] border border-[#cbd5e1] text-[11px] text-[#334155] flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold text-[#0f172a]">Điều khiển nhóm sẽ có:</span>
                  {modalSelectionCaps.hasPower && (
                    <span className="px-2 py-0.5 rounded-full bg-[#ecfdf5] text-[#047857] border border-[#10b981]/35 font-semibold">
                      Bật/Tắt ({modalSelectionCaps.powerCount})
                    </span>
                  )}
                  {modalSelectionCaps.hasAperture && (
                    <span className="px-2 py-0.5 rounded-full bg-[#f5f3ff] text-[#6d28d9] border border-[#8b5cf6]/35 font-semibold">
                      Mở/Dừng/Đóng ({modalSelectionCaps.apertureCount})
                    </span>
                  )}
                  {modalSelectionCaps.hasBrightness && (
                    <span className="px-2 py-0.5 rounded-full bg-[#fffbeb] text-[#92400e] border border-[#d97706]/40 font-semibold">
                      Độ sáng chung
                    </span>
                  )}
                  {modalSelectionCaps.hasColor && (
                    <span className="px-2 py-0.5 rounded-full bg-[#fdf2f8] text-[#be185d] border border-[#ec4899]/40 font-semibold">
                      Màu sắc RGB
                    </span>
                  )}
                  {modalSelectionCaps.hasFanSpeed && (
                    <span className="px-2 py-0.5 rounded-full bg-[#ecfeff] text-[#0e7490] border border-[#06b6d4]/40 font-semibold">
                      Tốc độ quạt
                    </span>
                  )}
                  {modalSelectionCaps.hasAcControl && (
                    <span className="px-2 py-0.5 rounded-full bg-[#f0f9ff] text-[#0369a1] border border-[#0ea5e9]/40 font-semibold">
                      Nhiệt độ &amp; Chế độ điều hòa
                    </span>
                  )}
                  {modalSelectionCaps.dimmableCount > 0 && !modalSelectionCaps.hasBrightness && (
                    <span className="text-[10px] text-[#475569]">
                      (Ẩn độ sáng chung vì nhóm có thiết bị không chỉnh được độ sáng)
                    </span>
                  )}
                  {modalSelectionCaps.colorCount > 0 &&
                    modalSelectionCaps.hasBrightness &&
                    !modalSelectionCaps.hasColor && (
                      <span className="text-[10px] text-[#475569]">
                        (Ẩn màu RGB vì nhóm có đèn thường)
                      </span>
                    )}
                  {!modalSelectionCaps.hasPower && !modalSelectionCaps.hasAperture && (
                    <span className="text-[#be123c] font-semibold">
                      Chưa có thiết bị điều khiển được
                    </span>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e2e8f0]">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-[#94a3b8]/75 bg-white text-[#0f172a] hover:bg-[#f8fafc] transition-colors cursor-pointer disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    selectedDeviceIds.length === 0 ||
                    !newGroupName.trim() ||
                    hasMixedCategoryConflict
                  }
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting
                    ? editingGroup
                      ? 'Đang lưu...'
                      : 'Đang tạo...'
                    : editingGroup
                      ? 'Lưu thay đổi'
                      : 'Tạo nhóm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
