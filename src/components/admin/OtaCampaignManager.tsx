import { confirmDialog } from '../ui/confirmDialog';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  UploadCloud,
  Play,
  AlertOctagon,
  CheckCircle,
  Activity,
  Layers,
  RotateCw,
  Plus,
  X,
  FileCode,
  ShieldAlert,
  Cpu,
  ChevronDown,
  ChevronRight,
  Download,
  Copy,
  Link2,
  Clock,
  XCircle,
  PackageCheck,
  Rocket,
  Check,
  AlertTriangle,
  Home,
  Trash2,
} from 'lucide-react';
import type { OtaCampaign, FirmwarePackage, NodeDiagnostics } from '../../types/diagnostics';
import {
  getOtaCampaigns,
  getOtaPackages,
  uploadOtaPackage,
  registerOtaPackage,
  deleteOtaPackage,
  createOtaCampaign,
  abortOtaCampaign,
  getNodeDiagnostics,
} from '../../services/diagnosticsApi';
import { notify } from '../ui/notify';
import { getErrorMessage } from '../../utils/errors';

const MAX_FIRMWARE_BYTES = 20 * 1024 * 1024;
const SHA256_REGEX = /^[0-9a-f]{64}$/i;

const OTA_DEVICE_TYPE_GROUPS: Array<{
  group: string;
  options: Array<{ value: string; label: string }>;
}> = [
  {
    group: 'Hệ thống',
    options: [{ value: 'ALL', label: 'Tất cả Edge Node ESP32 (ALL)' }],
  },
  {
    group: 'Chiếu sáng',
    options: [
      { value: 'LIGHT', label: 'Đèn / Công tắc chiếu sáng (LIGHT)' },
      { value: 'LED_RGB', label: 'Đèn LED RGB (LED_RGB)' },
    ],
  },
  {
    group: 'Điều hòa & TV',
    options: [
      { value: 'AIR_CONDITIONER', label: 'Điều hòa nhiệt độ (AIR_CONDITIONER)' },
      { value: 'TV', label: 'Tivi (TV)' },
    ],
  },
  {
    group: 'Động cơ, Quạt, Bơm & Cửa',
    options: [
      { value: 'FAN', label: 'Quạt thông minh (FAN)' },
      { value: 'WATER_PUMP', label: 'Máy bơm nước (WATER_PUMP)' },
      { value: 'DOOR', label: 'Cửa chính (DOOR)' },
      { value: 'ROLLING_DOOR', label: 'Cửa cuốn (ROLLING_DOOR)' },
      { value: 'CURTAIN', label: 'Rèm thông minh (CURTAIN)' },
    ],
  },
  {
    group: 'Cảm biến môi trường & An toàn',
    options: [
      { value: 'TEMP_HUMID_SENSOR', label: 'Cảm biến nhiệt ẩm (TEMP_HUMID_SENSOR)' },
      { value: 'MOTION_SENSOR', label: 'Cảm biến chuyển động (MOTION_SENSOR)' },
      { value: 'LUX_SENSOR', label: 'Cảm biến ánh sáng (LUX_SENSOR)' },
      { value: 'SMOKE_SENSOR', label: 'Cảm biến khói (SMOKE_SENSOR)' },
      { value: 'FLAME_SENSOR', label: 'Cảm biến lửa (FLAME_SENSOR)' },
    ],
  },
];

const DEVICE_TYPE_LABEL_MAP: Record<string, string> = {
  ALL: 'Toàn bộ Node ESP32',
  '*': 'Toàn bộ Node ESP32',
  LIGHT: 'Đèn / Công tắc chiếu sáng (LIGHT)',
  LED_RGB: 'Đèn LED RGB (LED_RGB)',
  AIR_CONDITIONER: 'Điều hòa nhiệt độ (AIR_CONDITIONER)',
  TV: 'Tivi (TV)',
  FAN: 'Quạt thông minh (FAN)',
  WATER_PUMP: 'Máy bơm nước (WATER_PUMP)',
  DOOR: 'Cửa chính (DOOR)',
  ROLLING_DOOR: 'Cửa cuốn (ROLLING_DOOR)',
  CURTAIN: 'Rèm thông minh (CURTAIN)',
  TEMP_HUMID_SENSOR: 'Cảm biến nhiệt ẩm (TEMP_HUMID_SENSOR)',
  MOTION_SENSOR: 'Cảm biến chuyển động (MOTION_SENSOR)',
  LUX_SENSOR: 'Cảm biến ánh sáng (LUX_SENSOR)',
  SMOKE_SENSOR: 'Cảm biến khói (SMOKE_SENSOR)',
  FLAME_SENSOR: 'Cảm biến lửa (FLAME_SENSOR)',
};

const CANARY_STEPS = [
  { wave: 1, label: 'Đợt 1 · Canary', ratio: '10%' },
  { wave: 2, label: 'Đợt 2 · Mở rộng', ratio: '50%' },
  { wave: 3, label: 'Đợt 3 · Toàn bộ', ratio: '100%' },
];

const doesNodeMatchDeviceType = (node: NodeDiagnostics, deviceType: string): boolean => {
  const target = (deviceType || '').trim().toUpperCase();
  if (!target || target === 'ALL' || target === '*') return true;
  if ((node.deviceType || '').trim().toUpperCase() === target) return true;
  return (node.attachedDeviceTypes || []).some((dt) => dt.trim().toUpperCase() === target);
};

interface OtaCampaignManagerProps {
  onCampaignChange?: () => void;
}

export const OtaCampaignManager: React.FC<OtaCampaignManagerProps> = ({ onCampaignChange }) => {
  const [campaigns, setCampaigns] = useState<OtaCampaign[]>([]);
  const [packages, setPackages] = useState<FirmwarePackage[]>([]);
  const [allNodes, setAllNodes] = useState<NodeDiagnostics[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);
  const [nodeFilterByCampaign, setNodeFilterByCampaign] = useState<Record<string, string>>({});

  // List filters
  const [pkgTypeFilter, setPkgTypeFilter] = useState('ALL_TYPES');
  const [campaignFilter, setCampaignFilter] = useState<'ALL' | 'RUNNING' | 'COMPLETED' | 'STOPPED'>('ALL');

  // Campaign form state + targeted node selector
  const [name, setName] = useState('');
  const [selectedPkgId, setSelectedPkgId] = useState('');
  const [strategy, setStrategy] = useState('CANARY');
  const [threshold, setThreshold] = useState(20);
  const [modalHomeFilter, setModalHomeFilter] = useState('ALL');
  const [showAllNodesManual, setShowAllNodesManual] = useState(false);
  const [manualNodeIds, setManualNodeIds] = useState<string[] | null>(null);
  const [isSubmittingCampaign, setIsSubmittingCampaign] = useState(false);

  // Package upload/register form state
  const [pkgMode, setPkgMode] = useState<'UPLOAD' | 'URL'>('UPLOAD');
  const [pkgDeviceType, setPkgDeviceType] = useState('LIGHT');
  const [pkgVersion, setPkgVersion] = useState('');
  const [pkgReleaseNotes, setPkgReleaseNotes] = useState('');
  const [pkgFile, setPkgFile] = useState<File | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [pkgUrl, setPkgUrl] = useState('');
  const [pkgSha256, setPkgSha256] = useState('');
  const [isSubmittingPkg, setIsSubmittingPkg] = useState(false);
  const [deletingPkgId, setDeletingPkgId] = useState<string | null>(null);

  const fetchData = useCallback(
    async ({ silent = false, manual = false }: { silent?: boolean; manual?: boolean } = {}) => {
      if (manual) setIsRefreshing(true);
      try {
        const [cList, pList, nList] = await Promise.all([
          getOtaCampaigns(),
          getOtaPackages(),
          getNodeDiagnostics(),
        ]);
        setCampaigns(cList);
        setPackages(pList);
        setAllNodes(nList);
      } catch (err) {
        if (!silent) {
          notify.error(
            'Không thể tải dữ liệu OTA Firmware',
            getErrorMessage(err, 'Vui lòng kiểm tra kết nối backend')
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
    void fetchData();
    const timer = setInterval(() => {
      void fetchData({ silent: true });
    }, 4000);
    return () => clearInterval(timer);
  }, [fetchData]);

  // Escape key handler for modals
  useEffect(() => {
    if (!isPackageModalOpen && !isCampaignModalOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsPackageModalOpen(false);
        setIsCampaignModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isPackageModalOpen, isCampaignModalOpen]);

  const selectedPackage = useMemo(
    () => packages.find((p) => p.id === selectedPkgId) ?? null,
    [packages, selectedPkgId]
  );

  const selectedNodeIds = useMemo(() => {
    if (manualNodeIds !== null) return manualNodeIds;
    if (!selectedPackage) return [];
    return allNodes
      .filter((n) => n.status === 'ONLINE' && doesNodeMatchDeviceType(n, selectedPackage.deviceType))
      .map((n) => n.nodeId);
  }, [manualNodeIds, selectedPackage, allNodes]);

  const resetPackageForm = () => {
    setPkgVersion('');
    setPkgReleaseNotes('');
    setPkgFile(null);
    setPkgUrl('');
    setPkgSha256('');
  };

  const validateAndPickBinFile = (file: File | null) => {
    if (!file) {
      setPkgFile(null);
      return;
    }
    if (!file.name.toLowerCase().endsWith('.bin')) {
      notify.error('Định dạng tệp không hợp lệ', 'Chỉ hỗ trợ tệp firmware nhị phân đuôi .bin');
      return;
    }
    if (file.size <= 0) {
      notify.error('Tệp rỗng', 'Tệp .bin phải có kích thước lớn hơn 0 byte');
      return;
    }
    if (file.size > MAX_FIRMWARE_BYTES) {
      notify.error('Tệp quá dung lượng', 'Kích thước firmware .bin tối đa là 20 MB');
      return;
    }
    setPkgFile(file);
  };

  const handleCreatePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pkgDeviceType.trim() || !pkgVersion.trim()) {
      notify.error('Thiếu thông tin bắt buộc', 'Vui lòng chọn loại thiết bị và nhập phiên bản firmware');
      return;
    }

    if (pkgMode === 'UPLOAD' && !pkgFile) {
      notify.error('Chưa chọn tệp firmware', 'Vui lòng chọn tệp .bin (<= 20 MB) để tải lên');
      return;
    }

    if (pkgMode === 'URL') {
      const cleanUrl = pkgUrl.trim();
      const cleanSha = pkgSha256.trim();
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        notify.error('URL không hợp lệ', 'Đường dẫn firmware phải bắt đầu bằng http:// hoặc https://');
        return;
      }
      if (!SHA256_REGEX.test(cleanSha)) {
        notify.error('Checksum SHA-256 không hợp lệ', 'Checksum phải gồm đúng 64 ký tự hệ thập lục phân (hex)');
        return;
      }
    }

    setIsSubmittingPkg(true);
    try {
      let created: FirmwarePackage;
      if (pkgMode === 'UPLOAD' && pkgFile) {
        created = await uploadOtaPackage({
          file: pkgFile,
          deviceType: pkgDeviceType.trim(),
          version: pkgVersion.trim(),
          releaseNotes: pkgReleaseNotes.trim() || undefined,
        });
      } else {
        created = await registerOtaPackage({
          deviceType: pkgDeviceType.trim(),
          version: pkgVersion.trim(),
          fileUrl: pkgUrl.trim(),
          checksumSha256: pkgSha256.trim(),
          releaseNotes: pkgReleaseNotes.trim() || undefined,
        });
      }
      notify.success('Đã nạp gói Firmware OTA thành công', `${created.deviceType} ${created.version}`);
      setSelectedPkgId(created.id);
      setIsPackageModalOpen(false);
      resetPackageForm();
      await fetchData({ silent: true });
      onCampaignChange?.();
    } catch (err) {
      notify.error('Không thể nạp gói firmware OTA', getErrorMessage(err, 'Vui lòng kiểm tra lại dữ liệu'));
    } finally {
      setIsSubmittingPkg(false);
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPkgId) {
      notify.error('Chưa chọn gói Firmware', 'Vui lòng chọn bản cập nhật phần mềm trước khi phát hành');
      return;
    }
    if (selectedNodeIds.length === 0) {
      notify.error(
        'Chưa có Edge Node trực tuyến được chọn',
        'Vui lòng chọn ít nhất 1 Edge Node đang ONLINE để triển khai cập nhật'
      );
      return;
    }

    setIsSubmittingCampaign(true);
    try {
      await createOtaCampaign({
        name: name.trim() || 'Chiến dịch nâng cấp firmware thiết bị',
        firmwarePackageId: selectedPkgId,
        rolloutStrategy: strategy,
        failureThresholdPercent: threshold,
        targetNodeIds: selectedNodeIds,
      });
      notify.success(
        'Đã khởi tạo chiến dịch OTA',
        `Đang phát lệnh nâng cấp qua MQTT tới ${selectedNodeIds.length} Edge Node`
      );
      setIsCampaignModalOpen(false);
      setName('');
      await fetchData({ silent: true });
      onCampaignChange?.();
    } catch (err) {
      notify.error(
        'Không thể khởi tạo chiến dịch OTA',
        getErrorMessage(err, 'Vui lòng kiểm tra lại Edge Node trực tuyến hoặc xung đột chiến dịch')
      );
    } finally {
      setIsSubmittingCampaign(false);
    }
  };

  const handleAbort = async (id: string) => {
    if (
      !(await confirmDialog({
        title: 'Dừng khẩn cấp chiến dịch OTA?',
        description:
          'Hệ thống sẽ phát bản tin /ota/abort qua MQTT tới các node đang cập nhật; các node chưa flash xong sẽ hủy an toàn.',
        confirmText: 'Dừng khẩn cấp',
        cancelText: 'Tiếp tục theo dõi',
        variant: 'danger',
      }))
    ) {
      return;
    }
    try {
      await abortOtaCampaign(id, 'Quản trị viên chủ động dừng khẩn cấp trên giao diện');
      notify.success('Đã dừng khẩn cấp chiến dịch OTA');
      await fetchData({ silent: true });
      onCampaignChange?.();
    } catch (err) {
      notify.error('Gặp sự cố khi dừng chiến dịch', getErrorMessage(err, 'Vui lòng thử lại'));
    }
  };

  const handleDeletePackage = async (pkg: FirmwarePackage) => {
    if (usedPackageIds.has(pkg.id)) {
      notify.error('Không thể xóa gói firmware', 'Gói này đang được tham chiếu bởi một chiến dịch OTA');
      return;
    }
    if (
      !(await confirmDialog({
        title: `Xóa gói firmware ${pkg.version}?`,
        description: `Hệ thống sẽ xóa gói ${pkg.deviceType} (${pkg.version}) khỏi cơ sở dữ liệu và kho lưu trữ đám mây.`,
        confirmText: 'Xóa gói firmware',
        cancelText: 'Giữ lại',
        variant: 'danger',
      }))
    ) {
      return;
    }
    setDeletingPkgId(pkg.id);
    try {
      await deleteOtaPackage(pkg.id);
      if (selectedPkgId === pkg.id) {
        setSelectedPkgId('');
      }
      notify.success('Đã xóa gói Firmware OTA', `${pkg.deviceType} ${pkg.version}`);
      await fetchData({ silent: true });
      onCampaignChange?.();
    } catch (err) {
      notify.error('Không thể xóa gói firmware', getErrorMessage(err, 'Vui lòng thử lại'));
    } finally {
      setDeletingPkgId(null);
    }
  };

  const openCampaignForPackage = (pkg: FirmwarePackage) => {
    setSelectedPkgId(pkg.id);
    setManualNodeIds(null);
    if (!name.trim()) {
      setName(`Nâng cấp ${pkg.deviceType} lên ${pkg.version}`);
    }
    setIsCampaignModalOpen(true);
  };

  const formatDeviceType = (type: string) => {
    const clean = (type || '').trim().toUpperCase();
    return DEVICE_TYPE_LABEL_MAP[clean] || type || 'Thiết bị thông minh';
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getFriendlyStatus = (status: string) => {
    switch (status) {
      case 'RUNNING_CANARY_10':
        return {
          label: 'Đang chạy Đợt 1 (Canary 10%)',
          color: 'bg-info-soft text-sky-700 border-sky-200',
        };
      case 'RUNNING_CANARY_50':
        return {
          label: 'Đang chạy Đợt 2 (Mở rộng 50%)',
          color: 'bg-info-soft text-sky-700 border-sky-200',
        };
      case 'RUNNING_FULL_100':
        return {
          label: 'Đang triển khai Toàn đội (100%)',
          color: 'bg-info-soft text-sky-700 border-sky-200',
        };
      case 'COMPLETED':
        return {
          label: 'Hoàn tất 100%',
          color: 'bg-success-soft text-emerald-700 border-emerald-200',
        };
      case 'ABORTED_FAILURE_THRESHOLD':
      case 'ABORTED':
      case 'ABORTED_AUTO':
        return {
          label: 'Tự ngắt khẩn cấp (Vượt ngưỡng lỗi)',
          color: 'bg-error-soft text-rose-700 border-rose-200 animate-pulse',
        };
      case 'CANCELLED':
        return {
          label: 'Đã hủy bởi quản trị viên',
          color: 'bg-sidebar text-muted border-line',
        };
      default:
        return {
          label: status,
          color: 'bg-info-soft text-sky-700 border-sky-200',
        };
    }
  };

  const getNodeStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCEEDED':
        return 'bg-success-soft text-emerald-700 border-emerald-200';
      case 'FAILED':
        return 'bg-error-soft text-rose-700 border-rose-200';
      case 'CANCELLED':
        return 'bg-sidebar text-muted border-line';
      case 'DOWNLOADING':
      case 'VERIFYING':
      case 'REBOOTING':
      case 'FLASHING':
      case 'DISPATCHED':
        return 'bg-info-soft text-sky-700 border-sky-200';
      default:
        return 'bg-sidebar text-muted border-line';
    }
  };

  const copyText = (val: string, label: string) => {
    navigator.clipboard.writeText(val);
    notify.success(`Đã sao chép ${label}`);
  };

  const kpiStats = useMemo(() => {
    const running = campaigns.filter((c) => c.status.startsWith('RUNNING')).length;
    const completed = campaigns.filter((c) => c.status === 'COMPLETED').length;
    const stopped = campaigns.filter(
      (c) => c.status.includes('ABORTED') || c.status === 'CANCELLED'
    ).length;
    const uploadedPkgs = packages.filter((p) => p.uploaded).length;
    return { running, completed, stopped, uploadedPkgs };
  }, [campaigns, packages]);

  const usedPackageIds = useMemo(
    () => new Set(campaigns.map((c) => c.firmwarePackageId).filter(Boolean)),
    [campaigns]
  );

  const availablePkgTypes = useMemo(() => {
    return Array.from(new Set(packages.map((p) => p.deviceType)));
  }, [packages]);

  const filteredPackages = useMemo(() => {
    if (pkgTypeFilter === 'ALL_TYPES') return packages;
    return packages.filter((p) => p.deviceType === pkgTypeFilter);
  }, [packages, pkgTypeFilter]);

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      if (campaignFilter === 'ALL') return true;
      if (campaignFilter === 'RUNNING') return c.status.startsWith('RUNNING');
      if (campaignFilter === 'COMPLETED') return c.status === 'COMPLETED';
      return c.status.includes('ABORTED') || c.status === 'CANCELLED';
    });
  }, [campaigns, campaignFilter]);

  // Modal target node filter lists
  const modalHomeOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of allNodes) {
      if (n.homeId) {
        map.set(n.homeId, n.homeName && n.homeName !== 'N/A' ? n.homeName : 'Nhà chưa đặt tên');
      }
    }
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [allNodes]);

  const modalCandidateNodes = useMemo(() => {
    return allNodes
      .filter((n) => {
        if (modalHomeFilter !== 'ALL' && n.homeId !== modalHomeFilter) return false;
        if (!selectedPackage || showAllNodesManual) return true;
        return doesNodeMatchDeviceType(n, selectedPackage.deviceType);
      })
      .sort((a, b) => {
        if (a.status === 'ONLINE' && b.status !== 'ONLINE') return -1;
        if (a.status !== 'ONLINE' && b.status === 'ONLINE') return 1;
        return (a.nodeCode || '').localeCompare(b.nodeCode || '');
      });
  }, [allNodes, modalHomeFilter, selectedPackage, showAllNodesManual]);

  const toggleTargetNode = (nodeId: string) => {
    setManualNodeIds((prev) => {
      const current = prev ?? selectedNodeIds;
      return current.includes(nodeId)
        ? current.filter((id) => id !== nodeId)
        : [...current, nodeId];
    });
  };

  return (
    <div className="space-y-6 tabular-nums">
      {/* Header Banner */}
      <div className="rounded-3xl border border-line bg-surface/95 backdrop-blur-sm shadow-soft p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 rounded-2xl bg-info-soft border border-sky-200 text-sky-700">
              <UploadCloud className="w-5 h-5" />
            </span>
            <h2 className="text-base sm:text-lg font-bold text-text">
              Điều phối cập nhật Firmware từ xa (OTA)
            </h2>
          </div>
          <p className="text-xs text-muted max-w-2xl leading-relaxed">
            Lưu trữ gói <code>.bin</code> khớp chuẩn các dòng thiết bị thực tế của HESTA, chọn đích danh Edge Node mục tiêu theo từng ngôi nhà và phát hành qua{' '}
            <strong>Canary 3 đợt (10% &rarr; 50% &rarr; 100%)</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPackageModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-line bg-surface text-xs font-semibold text-text hover:bg-sidebar-hover/70 transition-colors cursor-pointer"
          >
            <FileCode className="w-4 h-4 text-sky-700" />
            <span>Tải lên Firmware (.bin)</span>
          </button>

          <button
            type="button"
            onClick={() => void fetchData({ manual: true })}
            disabled={isRefreshing}
            className="p-2 rounded-xl border border-line bg-surface text-xs font-semibold text-text hover:bg-sidebar-hover/70 transition-colors cursor-pointer disabled:opacity-50"
            title="Làm mới dữ liệu OTA"
          >
            <RotateCw
              className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-primary' : 'text-muted'}`}
            />
          </button>

          <button
            type="button"
            onClick={() => {
              setManualNodeIds(null);
              setIsCampaignModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors shadow-2xs cursor-pointer active:scale-98"
          >
            <Plus className="w-4 h-4" />
            <span>Khởi tạo chiến dịch OTA</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Cards OTA */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-3xl border border-line bg-surface/95 shadow-soft p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted font-medium">Kho gói Firmware</p>
            <div className="text-2xl font-extrabold text-text mt-1">{packages.length}</div>
            <p className="text-[11px] text-muted mt-0.5">{kpiStats.uploadedPkgs} tệp .bin nội bộ</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-info-soft border border-sky-200 text-sky-700 flex items-center justify-center">
            <PackageCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-3xl border border-line bg-surface/95 shadow-soft p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted font-medium">Chiến dịch đang chạy</p>
            <div className="text-2xl font-extrabold text-sky-700 mt-1">{kpiStats.running}</div>
            <p className="text-[11px] text-muted mt-0.5">Theo dõi Watchdog 180s</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-info-soft border border-sky-200 text-sky-700 flex items-center justify-center">
            <Rocket className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-3xl border border-line bg-surface/95 shadow-soft p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted font-medium">Hoàn tất thành công</p>
            <div className="text-2xl font-extrabold text-emerald-700 mt-1">{kpiStats.completed}</div>
            <p className="text-[11px] text-muted mt-0.5">100% node đạt phiên bản mới</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-success-soft border border-emerald-200 text-emerald-700 flex items-center justify-center">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-3xl border border-line bg-surface/95 shadow-soft p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted font-medium">Ngắt khẩn cấp / Hủy</p>
            <div
              className={`text-2xl font-extrabold mt-1 ${
                kpiStats.stopped > 0 ? 'text-rose-700' : 'text-text'
              }`}
            >
              {kpiStats.stopped}
            </div>
            <p className="text-[11px] text-muted mt-0.5">Bảo vệ roll-forward sai</p>
          </div>
          <div
            className={`w-10 h-10 rounded-xl border flex items-center justify-center ${
              kpiStats.stopped > 0
                ? 'bg-error-soft border-rose-200 text-rose-700'
                : 'bg-sidebar border-line text-muted'
            }`}
          >
            <AlertOctagon className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Kho Firmware Packages */}
      <div className="rounded-3xl border border-line bg-surface/95 backdrop-blur-sm shadow-soft p-5 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-text flex items-center gap-2">
            <FileCode className="w-4 h-4 text-primary" />
            <span>Kho gói Firmware đã đăng ký ({filteredPackages.length})</span>
          </h3>

          {availablePkgTypes.length > 1 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setPkgTypeFilter('ALL_TYPES')}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold border cursor-pointer ${
                  pkgTypeFilter === 'ALL_TYPES'
                    ? 'bg-primary text-white border-primary'
                    : 'bg-surface text-muted border-line hover:bg-sidebar-hover/60'
                }`}
              >
                Tất cả loại
              </button>
              {availablePkgTypes.map((dt) => (
                <button
                  key={dt}
                  type="button"
                  onClick={() => setPkgTypeFilter(dt)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold border cursor-pointer ${
                    pkgTypeFilter === dt
                      ? 'bg-primary text-white border-primary'
                      : 'bg-surface text-muted border-line hover:bg-sidebar-hover/60'
                  }`}
                >
                  {dt}
                </button>
              ))}
            </div>
          )}
        </div>

        {initialLoading ? (
          <p className="text-xs text-muted py-4">Đang tải danh sách gói Firmware...</p>
        ) : filteredPackages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-sidebar/40 p-6 text-center">
            <p className="text-xs font-semibold text-text">Chưa có gói firmware nào</p>
            <p className="text-xs text-muted mt-1">
              Nhấn &quot;Tải lên Firmware (.bin)&quot; để nạp tệp nhị phân hoặc đăng ký URL tải ngoài.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredPackages.map((pkg) => (
              <div
                key={pkg.id}
                className="rounded-2xl border border-line bg-sidebar/45 hover:bg-sidebar/70 p-4 text-xs space-y-2 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-sky-700 bg-info-soft border border-sky-200 px-2.5 py-0.5 rounded-lg">
                      {pkg.version}
                    </span>
                    <span className="font-bold text-text">{formatDeviceType(pkg.deviceType)}</span>
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-line bg-surface text-muted">
                    {pkg.uploaded ? formatBytes(pkg.fileSizeBytes) : 'URL ngoài'}
                  </span>
                </div>

                {pkg.releaseNotes && (
                  <p className="text-muted line-clamp-2 leading-relaxed">{pkg.releaseNotes}</p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-line/60 text-[11px]">
                  <button
                    type="button"
                    onClick={() => copyText(pkg.checksumSha256, 'SHA-256')}
                    className="inline-flex items-center gap-1 font-mono text-muted hover:text-text cursor-pointer"
                    title={pkg.checksumSha256}
                  >
                    <Copy className="w-3 h-3" />
                    <span>SHA256: {pkg.checksumSha256.slice(0, 12)}...</span>
                  </button>

                  <div className="flex items-center gap-3">
                    <a
                      href={pkg.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-sky-700 hover:underline"
                    >
                      <Download className="w-3 h-3" />
                      <span>Tải .bin</span>
                    </a>
                    <button
                      type="button"
                      disabled={usedPackageIds.has(pkg.id) || deletingPkgId === pkg.id}
                      onClick={() => void handleDeletePackage(pkg)}
                      title={
                        usedPackageIds.has(pkg.id)
                          ? 'Không thể xóa gói đã được dùng trong chiến dịch OTA'
                          : 'Xóa gói firmware này'
                      }
                      aria-label={`Xóa gói firmware ${pkg.version}`}
                      className="inline-flex items-center justify-center p-1.5 rounded-lg border border-line text-muted hover:text-rose-700 hover:border-rose-200 hover:bg-error-soft transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openCampaignForPackage(pkg)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-primary text-white font-semibold hover:bg-primary-hover transition-colors cursor-pointer"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Phát hành</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Danh Sách Chiến Dịch OTA */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-text flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <span>Tiến độ chiến dịch OTA ({filteredCampaigns.length})</span>
          </h3>

          <div className="flex items-center gap-1.5 flex-wrap">
            {(
              [
                { id: 'ALL', label: `Tất cả (${campaigns.length})` },
                { id: 'RUNNING', label: `Đang chạy (${kpiStats.running})` },
                { id: 'COMPLETED', label: `Hoàn tất (${kpiStats.completed})` },
                { id: 'STOPPED', label: `Đã dừng (${kpiStats.stopped})` },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setCampaignFilter(opt.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                  campaignFilter === opt.id
                    ? 'bg-primary text-white border-primary shadow-2xs'
                    : 'bg-surface text-muted border-line hover:text-text hover:bg-sidebar-hover/60'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {initialLoading ? (
          <div className="rounded-3xl border border-line bg-surface/95 shadow-soft p-10 text-center text-xs text-muted">
            Đang tải danh sách chiến dịch OTA...
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="rounded-3xl border border-line bg-surface/95 shadow-soft p-12 text-center">
            <Layers className="w-12 h-12 text-muted mx-auto mb-3 opacity-40" />
            <p className="text-sm font-semibold text-text">
              {campaigns.length === 0
                ? 'Chưa có chiến dịch OTA nào'
                : 'Không có chiến dịch nào trong bộ lọc này'}
            </p>
            <p className="text-xs text-muted mt-1 max-w-md mx-auto">
              Tải lên bản firmware <code>.bin</code> rồi nhấn &quot;Khởi tạo chiến dịch OTA&quot; để phân phối theo đợt an toàn tới các Edge Node đã chọn.
            </p>
          </div>
        ) : (
          filteredCampaigns.map((camp) => {
            const isAborted = camp.status.includes('ABORTED');
            const isCompleted = camp.status === 'COMPLETED';
            const isCancelled = camp.status === 'CANCELLED';
            const isRunning = !isAborted && !isCompleted && !isCancelled;
            const statusInfo = getFriendlyStatus(camp.status);
            const isExpanded = expandedCampaignId === camp.id;

            const successPct =
              camp.totalNodes > 0 ? Math.round((camp.successNodes * 100) / camp.totalNodes) : 0;
            const failedPct =
              camp.totalNodes > 0 ? Math.round((camp.failedNodes * 100) / camp.totalNodes) : 0;
            const inFlightCount = (camp.nodeExecutions || []).filter((ne) =>
              ['DISPATCHED', 'DOWNLOADING', 'VERIFYING', 'FLASHING', 'REBOOTING'].includes(ne.status)
            ).length;
            const inFlightPct =
              camp.totalNodes > 0 ? Math.round((inFlightCount * 100) / camp.totalNodes) : 0;

            const failRate =
              camp.attemptedNodes > 0 ? Math.round((camp.failedNodes * 100) / camp.attemptedNodes) : 0;

            const activeNodeFilter = nodeFilterByCampaign[camp.id] || 'ALL';
            const filteredNodes = (camp.nodeExecutions || []).filter((ne) => {
              if (activeNodeFilter === 'ALL') return true;
              if (activeNodeFilter === 'FAILED') return ne.status === 'FAILED';
              return String(ne.wave) === activeNodeFilter;
            });

            const currentWave = camp.currentWave || 1;

            return (
              <div
                key={camp.id}
                className="rounded-3xl border border-line bg-surface/95 backdrop-blur-sm shadow-soft p-5 sm:p-6 space-y-4 hover:border-primary/50 transition-colors"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-bold text-text">{camp.name}</span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-info-soft text-sky-700 border border-sky-200">
                        {camp.version}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-semibold bg-sidebar text-muted border border-line flex items-center gap-1">
                        <Cpu className="w-3 h-3" />
                        {formatDeviceType(camp.deviceType)}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted mt-1">
                      Tạo lúc: {camp.createdAt ? new Date(camp.createdAt).toLocaleString('vi-VN') : '--'} &bull;{' '}
                      Chiến lược:{' '}
                      <strong className="text-text">
                        {camp.rolloutStrategy === 'CANARY' ? 'Canary 3 đợt' : 'Đồng loạt 100%'}
                      </strong>
                      {camp.currentWave ? ` (Đang ở Đợt ${camp.currentWave})` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusInfo.color}`}
                    >
                      {isCompleted && <CheckCircle className="w-3.5 h-3.5" />}
                      {isAborted && <AlertOctagon className="w-3.5 h-3.5" />}
                      {isCancelled && <XCircle className="w-3.5 h-3.5" />}
                      {statusInfo.label}
                    </span>

                    {isRunning && (
                      <button
                        type="button"
                        onClick={() => handleAbort(camp.id)}
                        className="px-3 py-1 rounded-xl border border-rose-200 bg-error-soft text-rose-700 hover:brightness-95 text-xs font-bold transition-colors cursor-pointer"
                      >
                        Dừng khẩn cấp
                      </button>
                    )}
                  </div>
                </div>

                {/* Canary Wave Stepper Visual */}
                {camp.rolloutStrategy === 'CANARY' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {CANARY_STEPS.map((step) => {
                      const waveNodes = (camp.nodeExecutions || []).filter(
                        (ne) => ne.wave === step.wave
                      );
                      const waveSucceeded = waveNodes.filter((ne) => ne.status === 'SUCCEEDED').length;
                      const isDone =
                        isCompleted ||
                        (waveNodes.length > 0 && waveSucceeded === waveNodes.length);
                      const isActiveStep = isRunning && currentWave === step.wave && !isDone;
                      const isStoppedStep =
                        (isAborted || isCancelled) && currentWave === step.wave;

                      return (
                        <div
                          key={step.wave}
                          className={`rounded-2xl border px-3 py-2.5 flex items-center justify-between gap-2 text-xs transition-colors ${
                            isStoppedStep
                              ? 'bg-error-soft border-rose-200 text-rose-700'
                              : isDone
                              ? 'bg-success-soft border-emerald-200 text-emerald-700'
                              : isActiveStep
                              ? 'bg-info-soft border-sky-200 text-sky-700'
                              : 'bg-sidebar/60 border-line text-muted'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                                isStoppedStep
                                  ? 'bg-rose-600 text-white'
                                  : isDone
                                  ? 'bg-emerald-600 text-white'
                                  : isActiveStep
                                  ? 'bg-primary text-white animate-pulse'
                                  : 'bg-surface border border-line text-muted'
                              }`}
                            >
                              {isDone ? <Check className="w-3.5 h-3.5" /> : step.wave}
                            </span>
                            <div className="min-w-0">
                              <div className="font-bold truncate">{step.label}</div>
                              <div className="text-[10px] opacity-80">
                                {waveNodes.length} node ({step.ratio})
                              </div>
                            </div>
                          </div>
                          {waveNodes.length > 0 && (
                            <span className="font-mono text-[11px] font-bold shrink-0">
                              {waveSucceeded}/{waveNodes.length}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-line bg-sidebar/60 px-3.5 py-2 text-xs font-semibold text-text flex items-center justify-between">
                    <span>Chiến lược IMMEDIATE — Triển khai đồng loạt 100% thiết bị đã chọn</span>
                    <span className="font-mono text-sky-700">
                      {camp.attemptedNodes}/{camp.totalNodes} node phản hồi
                    </span>
                  </div>
                )}

                {/* Multi-Segment Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-muted font-medium">
                    <span>
                      Tiến độ thực tế ({camp.attemptedNodes}/{camp.totalNodes} node hoàn tất phản hồi)
                    </span>
                    <span className="font-bold text-text">{successPct}% thành công</span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-sidebar overflow-hidden flex border border-line/60">
                    {successPct > 0 && (
                      <div
                        className="h-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${successPct}%` }}
                        title={`Thành công: ${camp.successNodes}`}
                      />
                    )}
                    {inFlightPct > 0 && (
                      <div
                        className="h-full bg-primary animate-pulse transition-all duration-500"
                        style={{ width: `${inFlightPct}%` }}
                        title={`Đang nạp: ${inFlightCount}`}
                      />
                    )}
                    {failedPct > 0 && (
                      <div
                        className="h-full bg-rose-500 transition-all duration-500"
                        style={{ width: `${failedPct}%` }}
                        title={`Thất bại: ${camp.failedNodes}`}
                      />
                    )}
                  </div>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-line text-xs">
                  <div>
                    <span className="text-muted block">Tổng Node mục tiêu</span>
                    <strong className="text-text font-bold text-sm">{camp.totalNodes} node</strong>
                  </div>
                  <div>
                    <span className="text-muted block">Cập nhật thành công</span>
                    <strong className="text-emerald-700 font-bold text-sm">
                      {camp.successNodes} node
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted block">Thất bại / Timeout</span>
                    <strong className="text-rose-700 font-bold text-sm">
                      {camp.failedNodes} node
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted block">Tỷ lệ lỗi / Ngưỡng ngắt</span>
                    <strong
                      className={`font-bold text-sm ${
                        failRate > camp.failureThresholdPercent ? 'text-rose-700' : 'text-text'
                      }`}
                    >
                      {failRate}% / {camp.failureThresholdPercent}%
                    </strong>
                  </div>
                </div>

                {camp.abortReason && (
                  <div className="p-3.5 rounded-2xl bg-error-soft border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>Lý do dừng: {camp.abortReason}</span>
                  </div>
                )}

                {/* Per-Node Rollout Detail Toggle */}
                {camp.nodeExecutions && camp.nodeExecutions.length > 0 && (
                  <div className="pt-3 border-t border-line/70">
                    <button
                      type="button"
                      onClick={() => setExpandedCampaignId(isExpanded ? null : camp.id)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-700 hover:underline cursor-pointer"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                      <span>Chi tiết thực thi từng Node ({camp.nodeExecutions.length})</span>
                    </button>

                    {isExpanded && (
                      <div className="mt-3 space-y-2.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {[
                            { id: 'ALL', label: 'Tất cả' },
                            { id: '1', label: 'Đợt 1' },
                            { id: '2', label: 'Đợt 2' },
                            { id: '3', label: 'Đợt 3' },
                            { id: 'FAILED', label: 'Chỉ hiện Lỗi' },
                          ].map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() =>
                                setNodeFilterByCampaign((prev) => ({
                                  ...prev,
                                  [camp.id]: f.id,
                                }))
                              }
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer ${
                                activeNodeFilter === f.id
                                  ? 'bg-primary text-white border-primary'
                                  : 'bg-sidebar text-muted border-line hover:text-text'
                              }`}
                            >
                              {f.label}
                            </button>
                          ))}
                        </div>

                        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                          {filteredNodes.length === 0 ? (
                            <p className="text-xs text-muted py-2">
                              Không có Node nào thuộc nhóm lọc này.
                            </p>
                          ) : (
                            filteredNodes.map((ne) => (
                              <div
                                key={ne.id || ne.nodeCode}
                                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-sidebar/55 border border-line/70 text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-text">{ne.nodeCode}</span>
                                  <span className="px-1.5 py-0.5 rounded bg-surface border border-line text-[10px] font-semibold text-muted">
                                    Đợt {ne.wave}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {ne.errorMessage && (
                                    <span
                                      className="text-[11px] text-rose-700 font-medium max-w-xs truncate"
                                      title={ne.errorMessage}
                                    >
                                      {ne.errorMessage}
                                    </span>
                                  )}
                                  {ne.reportedVersion && (
                                    <span className="text-[11px] font-mono font-semibold text-emerald-700">
                                      {ne.reportedVersion}
                                    </span>
                                  )}
                                  <span
                                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getNodeStatusBadge(
                                      ne.status
                                    )}`}
                                  >
                                    {ne.status}
                                  </span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal Tải Lên / Đăng Ký Gói Firmware */}
      {isPackageModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-text/30 backdrop-blur-md"
          onClick={() => setIsPackageModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-3xl bg-surface border border-line p-6 sm:p-7 shadow-float text-text space-y-4 max-h-[92vh] overflow-y-auto custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line/70 pb-3">
              <div>
                <h4 className="text-base font-bold text-text">Thêm bản Firmware OTA mới</h4>
                <p className="text-xs text-muted mt-0.5">
                  Danh mục thiết bị khớp chuẩn 100% với bảng thiết bị HESTA &amp; IoT firmware.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPackageModalOpen(false)}
                aria-label="Đóng"
                className="p-1.5 rounded-xl text-muted hover:text-text hover:bg-sidebar-hover/70 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-2 p-1 rounded-2xl bg-sidebar border border-line">
              <button
                type="button"
                onClick={() => setPkgMode('UPLOAD')}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                  pkgMode === 'UPLOAD'
                    ? 'bg-primary text-white shadow-2xs'
                    : 'text-muted hover:text-text'
                }`}
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Tải lên tệp .bin</span>
              </button>
              <button
                type="button"
                onClick={() => setPkgMode('URL')}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                  pkgMode === 'URL'
                    ? 'bg-primary text-white shadow-2xs'
                    : 'text-muted hover:text-text'
                }`}
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Đăng ký URL ngoài</span>
              </button>
            </div>

            <form onSubmit={handleCreatePackage} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-text">
                    Loại thiết bị (Device Type)
                  </label>
                  <select
                    aria-label="Loại thiết bị Firmware"
                    value={pkgDeviceType}
                    onChange={(e) => setPkgDeviceType(e.target.value)}
                    className="w-full min-h-[42px] px-3 rounded-2xl border border-line bg-sidebar text-xs text-text focus:outline-none focus:border-primary"
                  >
                    {OTA_DEVICE_TYPE_GROUPS.map((grp) => (
                      <optgroup key={grp.group} label={grp.group}>
                        {grp.options.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-text">
                    Phiên bản (Version)
                  </label>
                  <input
                    type="text"
                    value={pkgVersion}
                    onChange={(e) => setPkgVersion(e.target.value)}
                    placeholder="VD: v2.4.0"
                    className="w-full min-h-[42px] px-3.5 rounded-2xl border border-line bg-sidebar text-xs text-text focus:outline-none focus:border-primary"
                    required
                  />
                </div>
              </div>

              {pkgMode === 'UPLOAD' ? (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-text">
                    Tệp firmware biên dịch (.bin, tối đa 20 MB)
                  </label>
                  <label
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingFile(true);
                    }}
                    onDragLeave={() => setIsDraggingFile(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingFile(false);
                      validateAndPickBinFile(e.dataTransfer.files?.[0] || null);
                    }}
                    className={`flex flex-col items-center justify-center gap-1.5 px-4 py-5 rounded-2xl border-2 border-dashed transition-colors cursor-pointer text-center ${
                      isDraggingFile
                        ? 'border-primary bg-info-soft'
                        : 'border-line bg-sidebar/70 hover:border-primary/60 hover:bg-sidebar'
                    }`}
                  >
                    <UploadCloud className="w-6 h-6 text-sky-700" />
                    <span className="text-xs font-semibold text-text">
                      {pkgFile ? pkgFile.name : 'Chọn hoặc kéo thả tệp .bin vào đây'}
                    </span>
                    <span className="text-[11px] text-muted">
                      {pkgFile
                        ? `Dung lượng: ${formatBytes(pkgFile.size)} • Server sẽ tự tính SHA-256`
                        : 'Định dạng .bin hợp lệ, giới hạn <= 20 MB'}
                    </span>
                    <input
                      type="file"
                      accept=".bin"
                      onChange={(e) => validateAndPickBinFile(e.target.files?.[0] || null)}
                      className="sr-only"
                    />
                  </label>
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-text">URL tải tệp .bin</label>
                    <input
                      type="url"
                      value={pkgUrl}
                      onChange={(e) => setPkgUrl(e.target.value)}
                      placeholder="https://example.com/firmware_v2.4.0.bin"
                      className="w-full min-h-[42px] px-3.5 rounded-2xl border border-line bg-sidebar text-xs text-text focus:outline-none focus:border-primary"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-text">
                      Checksum SHA-256 (64 ký tự hex)
                    </label>
                    <input
                      type="text"
                      value={pkgSha256}
                      onChange={(e) => setPkgSha256(e.target.value)}
                      placeholder="64 hex chars"
                      className="w-full min-h-[42px] px-3.5 rounded-2xl border border-line bg-sidebar text-xs font-mono text-text focus:outline-none focus:border-primary"
                      required
                    />
                  </div>
                </>
              )}

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-text">
                  Ghi chú phát hành (Release Notes)
                </label>
                <textarea
                  rows={2}
                  value={pkgReleaseNotes}
                  onChange={(e) => setPkgReleaseNotes(e.target.value)}
                  placeholder="Mô tả thay đổi trong phiên bản này..."
                  className="w-full px-3.5 py-2 rounded-2xl border border-line bg-sidebar text-xs text-text focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-line/70">
                <button
                  type="button"
                  onClick={() => setIsPackageModalOpen(false)}
                  className="min-h-[40px] px-5 rounded-full border border-line text-xs font-semibold text-muted hover:text-text hover:bg-sidebar-hover/60 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPkg}
                  className="min-h-[40px] px-5 rounded-full bg-primary text-white text-xs font-semibold hover:bg-primary-hover disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmittingPkg && <Clock className="w-3.5 h-3.5 animate-spin" />}
                  <span>Lưu gói Firmware</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Khởi Tạo Chiến Dịch OTA + Chọn Đích Danh Edge Nodes */}
      {isCampaignModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-text/30 backdrop-blur-md"
          onClick={() => setIsCampaignModalOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-3xl bg-surface border border-line p-6 sm:p-7 shadow-float relative text-text space-y-4 max-h-[92vh] overflow-y-auto custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line/70 pb-3">
              <div>
                <h4 className="text-base font-bold text-text">Khởi tạo chiến dịch OTA mới</h4>
                <p className="text-xs text-muted mt-0.5">
                  Xem trước thiết bị con trên từng mạch và chọn chính xác Edge Node nhận bản nâng cấp.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCampaignModalOpen(false)}
                className="p-1.5 rounded-xl text-muted hover:text-text hover:bg-sidebar-hover/70 cursor-pointer"
                aria-label="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-text">Tên chiến dịch</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="VD: Vá firmware v2.4.0 cho Nhà Việt Đức"
                    className="w-full min-h-[42px] px-3.5 py-2 rounded-2xl border border-line bg-sidebar text-xs sm:text-sm text-text focus:outline-none focus:border-primary"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-text">Chọn gói Firmware</label>
                  {packages.length === 0 ? (
                    <p className="text-xs text-rose-700 font-medium pt-2">
                      Chưa có gói firmware. Hãy tải lên bản <code>.bin</code> trước.
                    </p>
                  ) : (
                    <select
                      aria-label="Chọn gói Firmware triển khai"
                      value={selectedPkgId}
                      onChange={(e) => {
                        setSelectedPkgId(e.target.value);
                        setManualNodeIds(null);
                      }}
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-2xl border border-line bg-sidebar text-xs text-text focus:outline-none focus:border-primary"
                      required
                    >
                      <option value="">-- Chọn bản firmware --</option>
                      {packages.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.deviceType} — {p.version} (
                          {p.uploaded ? formatBytes(p.fileSizeBytes) : 'URL'})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Target Node Preview & Picker */}
              <div className="rounded-2xl border border-line bg-sidebar/50 p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-text flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-sky-700" />
                      <span>
                        Chọn đích danh Edge Node mục tiêu ({selectedNodeIds.length} node đang ONLINE được chọn)
                      </span>
                    </div>
                    <p className="text-[11px] text-muted mt-0.5">
                      Với mạch ESP32 đa năng gánh nhiều thiết bị trên cùng GPIO, kiểm tra kỹ danh sách thiết bị con trước khi nạp.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() =>
                        setManualNodeIds(
                          modalCandidateNodes
                            .filter((n) => n.status === 'ONLINE')
                            .map((n) => n.nodeId)
                        )
                      }
                      className="font-semibold text-sky-700 hover:underline cursor-pointer"
                    >
                      Chọn tất cả Online
                    </button>
                    <span className="text-line">|</span>
                    <button
                      type="button"
                      onClick={() => setManualNodeIds([])}
                      className="font-semibold text-muted hover:text-text cursor-pointer"
                    >
                      Bỏ chọn hết
                    </button>
                  </div>
                </div>

                {/* Filters inside target node list */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <select
                    aria-label="Lọc Edge Node theo ngôi nhà"
                    value={modalHomeFilter}
                    onChange={(e) => setModalHomeFilter(e.target.value)}
                    className="min-h-[36px] px-3 py-1 rounded-xl border border-line bg-surface text-xs text-text focus:outline-none focus:border-primary"
                  >
                    <option value="ALL">Tất cả ngôi nhà ({modalHomeOptions.length} nhà)</option>
                    {modalHomeOptions.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.label}
                      </option>
                    ))}
                  </select>

                  <label className="inline-flex items-center gap-1.5 text-[11px] font-medium text-text cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showAllNodesManual}
                      onChange={(e) => setShowAllNodesManual(e.target.checked)}
                      className="rounded accent-primary"
                    />
                    <span>Hiện tất cả Node để chọn thủ công</span>
                  </label>
                </div>

                {/* Node List */}
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                  {modalCandidateNodes.length === 0 ? (
                    <div className="py-5 text-center text-xs text-muted bg-surface rounded-xl border border-dashed border-line">
                      Không có Edge Node nào khớp với loại thiết bị của gói Firmware này.
                    </div>
                  ) : (
                    modalCandidateNodes.map((n) => {
                      const isOnline = n.status === 'ONLINE';
                      const checked = selectedNodeIds.includes(n.nodeId);
                      const attachedTypes = n.attachedDeviceTypes || [];
                      const isMultiPurpose = attachedTypes.length > 1;

                      return (
                        <label
                          key={n.nodeId}
                          className={`flex items-start justify-between gap-2.5 p-2.5 rounded-xl border text-xs transition-colors ${
                            !isOnline
                              ? 'bg-surface/50 border-line/60 opacity-60 cursor-not-allowed'
                              : checked
                              ? 'bg-info-soft/70 border-primary/60 cursor-pointer'
                              : 'bg-surface border-line hover:bg-sidebar cursor-pointer'
                          }`}
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              disabled={!isOnline}
                              checked={checked}
                              onChange={() => toggleTargetNode(n.nodeId)}
                              className="mt-0.5 rounded accent-primary"
                            />
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-bold text-text">{n.nodeCode}</span>
                                <span className="inline-flex items-center gap-1 text-[11px] text-muted">
                                  <Home className="w-3 h-3" />
                                  {n.homeName && n.homeName !== 'N/A' ? n.homeName : 'Chưa gán nhà'}
                                </span>
                                {n.firmwareVersion && (
                                  <span className="px-1.5 py-0.5 rounded bg-surface border border-line font-mono text-[10px] text-sky-700">
                                    FW {n.firmwareVersion}
                                  </span>
                                )}
                              </div>

                              {attachedTypes.length > 0 && (
                                <div className="flex items-center gap-1 flex-wrap">
                                  {attachedTypes.map((dt) => (
                                    <span
                                      key={dt}
                                      className="px-1.5 py-0.5 rounded bg-sidebar text-[10px] font-mono text-muted border border-line/70"
                                    >
                                      {dt}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {isMultiPurpose && (
                                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-warning-soft border border-amber-200 text-amber-800 text-[10px] font-semibold">
                                  <AlertTriangle className="w-3 h-3 shrink-0" />
                                  <span>
                                    Mạch đa năng ({attachedTypes.length} loại thiết bị) — cần đúng file .bin tổng hợp!
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 border ${
                              isOnline
                                ? 'bg-success-soft text-emerald-700 border-emerald-200'
                                : 'bg-sidebar text-muted border-line'
                            }`}
                          >
                            {n.status}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Strategy Cards */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-text">Chiến lược phân phối</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setStrategy('CANARY')}
                    className={`text-left p-3 rounded-2xl border transition-all cursor-pointer ${
                      strategy === 'CANARY'
                        ? 'bg-info-soft border-primary shadow-2xs'
                        : 'bg-sidebar/60 border-line hover:bg-sidebar'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-text">Canary 3 đợt</span>
                      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-success-soft text-emerald-700">
                        Khuyên dùng
                      </span>
                    </div>
                    <p className="text-[11px] text-muted mt-1">
                      Nâng cấp lần lượt 10% &rarr; 50% &rarr; 100%, tự kiểm tra qua từng đợt.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStrategy('IMMEDIATE')}
                    className={`text-left p-3 rounded-2xl border transition-all cursor-pointer ${
                      strategy === 'IMMEDIATE'
                        ? 'bg-info-soft border-primary shadow-2xs'
                        : 'bg-sidebar/60 border-line hover:bg-sidebar'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-text">Đồng loạt (Immediate)</span>
                    </div>
                    <p className="text-[11px] text-muted mt-1">
                      Gửi đồng thời tới 100% các node bạn đã tick chọn ở trên.
                    </p>
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 p-3.5 rounded-2xl bg-sidebar/60 border border-line">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-text flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-sky-700" />
                    Ngưỡng tự động dừng:{' '}
                    <span className="text-sky-700 font-bold">{threshold}% lỗi</span>
                  </label>
                  <span className="text-[11px] text-muted">Mặc định: 20%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="5"
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="w-full accent-primary cursor-pointer"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-line/70">
                <button
                  type="button"
                  onClick={() => setIsCampaignModalOpen(false)}
                  className="min-h-[40px] px-5 rounded-full border border-line text-xs font-semibold text-muted hover:text-text hover:bg-sidebar-hover/60 cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={
                    isSubmittingCampaign || packages.length === 0 || selectedNodeIds.length === 0
                  }
                  className="min-h-[40px] flex items-center gap-1.5 px-5 rounded-full bg-primary text-white text-xs font-semibold hover:bg-primary-hover disabled:opacity-50 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>
                    {isSubmittingCampaign
                      ? 'Đang khởi tạo...'
                      : `Bắt đầu cập nhật (${selectedNodeIds.length} node)`}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
