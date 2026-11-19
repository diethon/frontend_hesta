import { confirmDialog } from '../ui/confirmDialog';
import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import type { OtaCampaign, FirmwarePackage } from '../../types/diagnostics';
import {
  getOtaCampaigns,
  getOtaPackages,
  uploadOtaPackage,
  registerOtaPackage,
  createOtaCampaign,
  abortOtaCampaign,
} from '../../services/diagnosticsApi';
import { notify } from '../ui/notify';

const DEVICE_TYPE_OPTIONS = [
  { value: 'ALL', label: 'Tất cả Node ESP32 (ALL)' },
  { value: 'ESP32_RELAY', label: 'Công tắc Relay (ESP32_RELAY)' },
  { value: 'AIR_CONDITIONER', label: 'Điều hòa IR (AIR_CONDITIONER)' },
  { value: 'GATE', label: 'Cổng trượt tự động (GATE)' },
  { value: 'LIGHT', label: 'Đèn thông minh / Dimmer (LIGHT)' },
  { value: 'SENSOR', label: 'Cảm biến môi trường (SENSOR)' },
  { value: 'ESP32_FALL_ALARM', label: 'Còi báo té ngã (ESP32_FALL_ALARM)' },
  { value: 'ESP32_ENERGY', label: 'Đo điện năng (ESP32_ENERGY)' },
];

export const OtaCampaignManager: React.FC = () => {
  const [campaigns, setCampaigns] = useState<OtaCampaign[]>([]);
  const [packages, setPackages] = useState<FirmwarePackage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);

  // Campaign form state
  const [name, setName] = useState('');
  const [selectedPkgId, setSelectedPkgId] = useState('');
  const [strategy, setStrategy] = useState('CANARY');
  const [threshold, setThreshold] = useState(20);
  const [isSubmittingCampaign, setIsSubmittingCampaign] = useState(false);

  // Package upload/register form state
  const [pkgMode, setPkgMode] = useState<'UPLOAD' | 'URL'>('UPLOAD');
  const [pkgDeviceType, setPkgDeviceType] = useState('ESP32_RELAY');
  const [pkgVersion, setPkgVersion] = useState('');
  const [pkgReleaseNotes, setPkgReleaseNotes] = useState('');
  const [pkgFile, setPkgFile] = useState<File | null>(null);
  const [pkgUrl, setPkgUrl] = useState('');
  const [pkgSha256, setPkgSha256] = useState('');
  const [isSubmittingPkg, setIsSubmittingPkg] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [cList, pList] = await Promise.all([getOtaCampaigns(), getOtaPackages()]);
      setCampaigns(cList);
      setPackages(pList);
    } catch {
      notify.error('Không thể tải dữ liệu cập nhật phần mềm');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData();
    const timer = setInterval(fetchData, 4000);
    return () => clearInterval(timer);
  }, []);

  const extractErrMsg = (err: unknown, fallback: string): string => {
    if (typeof err === 'object' && err !== null && 'response' in err) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      if (typeof msg === 'string' && msg.trim()) return msg;
    }
    if (err instanceof Error && err.message.trim()) return err.message;
    return fallback;
  };

  const resetPackageForm = () => {
    setPkgVersion('');
    setPkgReleaseNotes('');
    setPkgFile(null);
    setPkgUrl('');
    setPkgSha256('');
  };

  const handleCreatePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pkgDeviceType.trim() || !pkgVersion.trim()) {
      notify.error('Vui lòng nhập loại thiết bị và phiên bản firmware');
      return;
    }

    setIsSubmittingPkg(true);
    try {
      let created: FirmwarePackage;
      if (pkgMode === 'UPLOAD') {
        if (!pkgFile) {
          notify.error('Vui lòng chọn tệp firmware .bin để tải lên');
          setIsSubmittingPkg(false);
          return;
        }
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
      await fetchData();
    } catch (err) {
      notify.error(extractErrMsg(err, 'Không thể nạp gói firmware OTA'));
    } finally {
      setIsSubmittingPkg(false);
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPkgId) {
      notify.error('Vui lòng chọn bản cập nhật phần mềm');
      return;
    }

    setIsSubmittingCampaign(true);
    try {
      await createOtaCampaign({
        name: name.trim() || 'Bản cập nhật phần mềm thiết bị',
        firmwarePackageId: selectedPkgId,
        rolloutStrategy: strategy,
        failureThresholdPercent: threshold,
      });
      notify.success('Đã khởi tạo đợt cập nhật thành công', 'Bắt đầu gửi bản nâng cấp qua MQTT');
      setIsCampaignModalOpen(false);
      setName('');
      await fetchData();
    } catch (err) {
      notify.error(extractErrMsg(err, 'Lỗi khi khởi tạo đợt cập nhật'));
    } finally {
      setIsSubmittingCampaign(false);
    }
  };

  const handleAbort = async (id: string) => {
    if (
      !(await confirmDialog({
        title: 'Dừng khẩn cấp đợt cập nhật?',
        description: 'Hệ thống sẽ phát lệnh hủy qua MQTT; các thiết bị chưa flash sẽ dừng cập nhật an toàn.',
        confirmText: 'Dừng cập nhật',
        variant: 'danger',
      }))
    ) {
      return;
    }
    try {
      await abortOtaCampaign(id, 'Quản trị viên chủ động dừng khẩn cấp trên giao diện');
      notify.success('Đã dừng khẩn cấp đợt cập nhật an toàn');
      await fetchData();
    } catch (err) {
      notify.error(extractErrMsg(err, 'Gặp sự cố khi dừng đợt cập nhật'));
    }
  };

  const formatDeviceType = (type: string) => {
    if (type === 'ALL' || type === '*') return 'Toàn bộ Node ESP32';
    if (type.includes('RELAY')) return 'Công tắc Relay (ESP32)';
    if (type.includes('ENERGY')) return 'Đo điện năng (ESP32)';
    if (type.includes('AIR_CONDITIONER')) return 'Điều hòa IR';
    if (type.includes('GATE')) return 'Cổng trượt L298N';
    if (type.includes('FALL')) return 'Còi báo té ngã';
    return type || 'Thiết bị thông minh';
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
        return { label: 'Đang thử nghiệm đợt 1 (10% thiết bị)', color: 'bg-primary/10 text-primary border-primary/20' };
      case 'RUNNING_CANARY_50':
        return { label: 'Đang mở rộng đợt 2 (50% thiết bị)', color: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' };
      case 'RUNNING_FULL_100':
        return { label: 'Đang triển khai toàn đội (100% thiết bị)', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' };
      case 'COMPLETED':
        return { label: 'Nâng cấp thành công hoàn tất', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' };
      case 'ABORTED_FAILURE_THRESHOLD':
      case 'ABORTED':
      case 'ABORTED_AUTO':
        return { label: 'Đã dừng khẩn cấp (Vượt ngưỡng lỗi)', color: 'bg-rose-500/10 text-rose-500 border-rose-500/20 animate-pulse' };
      case 'CANCELLED':
        return { label: 'Đã hủy bởi quản trị viên', color: 'bg-muted/20 text-muted border-line' };
      default:
        return { label: status, color: 'bg-primary/10 text-primary border-primary/20' };
    }
  };

  const getNodeStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCEEDED':
        return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'FAILED':
        return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
      case 'CANCELLED':
        return 'bg-muted/15 text-muted border-line';
      case 'DOWNLOADING':
      case 'VERIFYING':
      case 'REBOOTING':
      case 'FLASHING':
      case 'DISPATCHED':
        return 'bg-primary/10 text-primary border-primary/20';
      default:
        return 'bg-sidebar text-muted border-line';
    }
  };

  const copyText = (val: string, label: string) => {
    navigator.clipboard.writeText(val);
    notify.success(`Đã sao chép ${label}`);
  };

  return (
    <div className="space-y-6 tabular-nums">
      {/* Header Banner */}
      <div className="rounded-3xl border border-line bg-surface shadow-xs p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="p-2.5 rounded-2xl bg-primary/10 text-primary">
              <UploadCloud className="w-5 h-5" />
            </span>
            <h3 className="text-lg font-bold text-text">
              Cập nhật phần mềm thiết bị từ xa (OTA)
            </h3>
          </div>
          <p className="text-xs text-muted max-w-2xl leading-relaxed">
            Tải lên tệp nhị phân <code>.bin</code> (tự tính SHA-256) và triển khai nâng cấp qua MQTT theo chiến lược
            <strong> Canary 3 đợt (10% &rarr; 50% &rarr; 100%)</strong> kèm tự ngắt an toàn khi tỷ lệ lỗi vượt ngưỡng.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPackageModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-full border border-line text-xs font-semibold text-text hover:bg-surface-hover transition-colors cursor-pointer"
          >
            <FileCode className="w-4 h-4 text-primary" />
            <span>Tải lên Firmware (.bin)</span>
          </button>

          <button
            type="button"
            onClick={fetchData}
            disabled={isLoading}
            className="p-2 rounded-xl border border-line text-xs font-semibold text-text hover:bg-surface-hover transition-colors cursor-pointer"
            title="Làm mới dữ liệu"
          >
            <RotateCw className={`w-4 h-4 text-muted ${isLoading ? 'animate-spin text-primary' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setIsCampaignModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors shadow-2xs cursor-pointer active:scale-98"
          >
            <Plus className="w-4 h-4" />
            <span>Khởi tạo chiến dịch OTA</span>
          </button>
        </div>
      </div>

      {/* Kho Firmware Packages */}
      <div className="rounded-3xl border border-line bg-surface shadow-xs p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-bold text-text flex items-center gap-2">
            <FileCode className="w-4 h-4 text-primary" />
            <span>Kho gói Firmware đã đăng ký ({packages.length})</span>
          </h4>
        </div>

        {packages.length === 0 ? (
          <p className="text-xs text-muted py-3">
            Chưa có bản firmware nào. Bấm &quot;Tải lên Firmware (.bin)&quot; để nạp bản cập nhật thật trước khi tạo chiến dịch.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {packages.map((pkg) => (
              <div key={pkg.id} className="rounded-2xl border border-line bg-sidebar/40 p-3.5 text-xs space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                      {pkg.version}
                    </span>
                    <span className="font-semibold text-text">{formatDeviceType(pkg.deviceType)}</span>
                  </div>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border border-line text-muted">
                    {pkg.uploaded ? formatBytes(pkg.fileSizeBytes) : 'External URL'}
                  </span>
                </div>

                {pkg.releaseNotes && <p className="text-muted line-clamp-2">{pkg.releaseNotes}</p>}

                <div className="flex items-center justify-between gap-2 pt-1 text-[11px] font-mono text-muted">
                  <button
                    type="button"
                    onClick={() => copyText(pkg.checksumSha256, 'SHA-256')}
                    className="inline-flex items-center gap-1 hover:text-text cursor-pointer"
                    title={pkg.checksumSha256}
                  >
                    <Copy className="w-3 h-3" />
                    <span>SHA256: {pkg.checksumSha256.slice(0, 14)}...</span>
                  </button>
                  <a
                    href={pkg.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <Download className="w-3 h-3" />
                    <span>Tải .bin</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Danh Sách Các Đợt Cập Nhật */}
      <div className="space-y-4">
        <h4 className="text-sm font-bold text-text flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <span>Tiến độ các chiến dịch OTA ({campaigns.length})</span>
        </h4>

        {campaigns.length === 0 ? (
          <div className="rounded-3xl border border-line bg-surface shadow-xs p-12 text-center">
            <Layers className="w-12 h-12 text-muted mx-auto mb-3 opacity-40" />
            <p className="text-sm font-semibold text-text">Chưa có chiến dịch OTA nào</p>
            <p className="text-xs text-muted mt-1 max-w-md mx-auto">
              Tải lên bản firmware `.bin` rồi bấm &quot;Khởi tạo chiến dịch OTA&quot; để phát hành an toàn tới các Edge Node trực tuyến.
            </p>
          </div>
        ) : (
          campaigns.map((camp) => {
            const isAborted = camp.status.includes('ABORTED');
            const isCompleted = camp.status === 'COMPLETED';
            const isCancelled = camp.status === 'CANCELLED';
            const statusInfo = getFriendlyStatus(camp.status);
            const isExpanded = expandedCampaignId === camp.id;

            const realPercent =
              camp.totalNodes > 0 ? Math.round((camp.attemptedNodes * 100) / camp.totalNodes) : 0;
            const progressPercent = isCompleted ? 100 : Math.max(realPercent, camp.status === 'RUNNING_CANARY_10' ? 5 : 0);
            const failRate = camp.attemptedNodes > 0 ? Math.round((camp.failedNodes * 100) / camp.attemptedNodes) : 0;

            return (
              <div
                key={camp.id}
                className="rounded-3xl border border-line bg-surface shadow-xs p-5 hover:border-primary/40 transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h5 className="text-base font-bold text-text">{camp.name}</h5>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-primary/10 text-primary">
                        {camp.version}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-sidebar text-muted flex items-center gap-1">
                        <Cpu className="w-3 h-3" />
                        {formatDeviceType(camp.deviceType)}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted mt-1">
                      Bắt đầu: {new Date(camp.createdAt || '').toLocaleString('vi-VN')} &bull; Chiến lược: {camp.rolloutStrategy}
                      {camp.currentWave ? ` (Đợt ${camp.currentWave})` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${statusInfo.color}`}
                    >
                      {isCompleted && <CheckCircle className="w-3.5 h-3.5" />}
                      {isAborted && <AlertOctagon className="w-3.5 h-3.5" />}
                      {isCancelled && <XCircle className="w-3.5 h-3.5" />}
                      {statusInfo.label}
                    </span>

                    {!isCompleted && !isAborted && !isCancelled && (
                      <button
                        type="button"
                        onClick={() => handleAbort(camp.id)}
                        className="px-3 py-1 rounded-xl border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Dừng khẩn cấp
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-xs text-muted font-medium">
                    <span>
                      Tiến độ thực tế ({camp.attemptedNodes}/{camp.totalNodes} node phản hồi):
                    </span>
                    <strong className="text-text">{progressPercent}%</strong>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-sidebar overflow-hidden relative">
                    <div
                      className={`h-full transition-all duration-700 ${
                        isAborted ? 'bg-rose-500' : isCompleted ? 'bg-emerald-500' : 'bg-primary'
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-line text-xs">
                  <div>
                    <span className="text-muted block">Tổng Node mục tiêu:</span>
                    <strong className="text-text font-bold text-sm">{camp.totalNodes} node</strong>
                  </div>
                  <div>
                    <span className="text-muted block">Thành công:</span>
                    <strong className="text-emerald-500 font-bold text-sm">{camp.successNodes} node</strong>
                  </div>
                  <div>
                    <span className="text-muted block">Thất bại / Timeout:</span>
                    <strong className="text-rose-500 font-bold text-sm">{camp.failedNodes} node</strong>
                  </div>
                  <div>
                    <span className="text-muted block">Tỷ lệ lỗi hiện tại:</span>
                    <strong
                      className={`font-bold text-sm ${
                        failRate > camp.failureThresholdPercent ? 'text-rose-500' : 'text-text'
                      }`}
                    >
                      {failRate}% (Tối đa {camp.failureThresholdPercent}%)
                    </strong>
                  </div>
                </div>

                {camp.abortReason && (
                  <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>Lý do dừng: {camp.abortReason}</span>
                  </div>
                )}

                {/* Per-Node Rollout Detail Toggle */}
                {camp.nodeExecutions && camp.nodeExecutions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-line/60">
                    <button
                      type="button"
                      onClick={() => setExpandedCampaignId(isExpanded ? null : camp.id)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline cursor-pointer"
                    >
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      <span>Chi tiết từng Node ({camp.nodeExecutions.length})</span>
                    </button>

                    {isExpanded && (
                      <div className="mt-2.5 space-y-1.5 max-h-64 overflow-y-auto pr-1">
                        {camp.nodeExecutions.map((ne) => (
                          <div
                            key={ne.id || ne.nodeCode}
                            className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-sidebar/50 border border-line/60 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-semibold text-text">{ne.nodeCode}</span>
                              <span className="text-[11px] text-muted">Đợt {ne.wave}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {ne.errorMessage && (
                                <span className="text-[11px] text-rose-500 max-w-xs truncate" title={ne.errorMessage}>
                                  {ne.errorMessage}
                                </span>
                              )}
                              {ne.reportedVersion && (
                                <span className="text-[11px] font-mono text-emerald-600">{ne.reportedVersion}</span>
                              )}
                              <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${getNodeStatusBadge(ne.status)}`}>
                                {ne.status}
                              </span>
                            </div>
                          </div>
                        ))}
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setIsPackageModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-3xl bg-surface border border-line p-6 sm:p-7 shadow-2xl text-text space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line/60 pb-3">
              <div>
                <h4 className="text-base font-bold text-text">Thêm bản Firmware OTA mới</h4>
                <p className="text-xs text-muted mt-0.5">
                  Tải trực tiếp tệp <code>.bin</code> lên server hoặc nhập URL tải ngoài.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPackageModalOpen(false)}
                className="p-1.5 rounded-xl text-muted hover:text-text hover:bg-surface-hover cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-2 p-1 rounded-2xl bg-sidebar border border-line">
              <button
                type="button"
                onClick={() => setPkgMode('UPLOAD')}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                  pkgMode === 'UPLOAD' ? 'bg-primary text-white shadow-2xs' : 'text-muted hover:text-text'
                }`}
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Tải lên tệp .bin</span>
              </button>
              <button
                type="button"
                onClick={() => setPkgMode('URL')}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                  pkgMode === 'URL' ? 'bg-primary text-white shadow-2xs' : 'text-muted hover:text-text'
                }`}
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Đăng ký URL ngoài</span>
              </button>
            </div>

            <form onSubmit={handleCreatePackage} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold">Loại thiết bị (Device Type)</label>
                  <select
                    value={pkgDeviceType}
                    onChange={(e) => setPkgDeviceType(e.target.value)}
                    className="w-full min-h-[42px] px-3 rounded-2xl border border-line bg-sidebar text-xs text-text focus:outline-none focus:border-primary"
                  >
                    {DEVICE_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold">Phiên bản (Version)</label>
                  <input
                    type="text"
                    value={pkgVersion}
                    onChange={(e) => setPkgVersion(e.target.value)}
                    placeholder="VD: v2.2.0"
                    className="w-full min-h-[42px] px-3.5 rounded-2xl border border-line bg-sidebar text-xs text-text focus:outline-none focus:border-primary"
                    required
                  />
                </div>
              </div>

              {pkgMode === 'UPLOAD' ? (
                <div className="space-y-1">
                  <label className="block text-xs font-semibold">Tệp firmware biên dịch (.bin, tối đa 20MB)</label>
                  <input
                    type="file"
                    accept=".bin"
                    onChange={(e) => setPkgFile(e.target.files?.[0] || null)}
                    className="w-full px-3 py-2 rounded-2xl border border-dashed border-line bg-sidebar text-xs text-text file:mr-3 file:px-3 file:py-1.5 file:rounded-xl file:border-0 file:bg-primary/10 file:text-primary file:font-semibold cursor-pointer"
                    required
                  />
                  {pkgFile && (
                    <p className="text-[11px] text-emerald-600 font-medium">
                      Đã chọn: {pkgFile.name} ({formatBytes(pkgFile.size)})
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold">URL tải tệp .bin</label>
                    <input
                      type="url"
                      value={pkgUrl}
                      onChange={(e) => setPkgUrl(e.target.value)}
                      placeholder="https://example.com/firmware_v2.2.0.bin"
                      className="w-full min-h-[42px] px-3.5 rounded-2xl border border-line bg-sidebar text-xs text-text focus:outline-none focus:border-primary"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold">Checksum SHA-256 (64 ký tự hex)</label>
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
                <label className="block text-xs font-semibold">Ghi chú phát hành (Release Notes)</label>
                <textarea
                  rows={2}
                  value={pkgReleaseNotes}
                  onChange={(e) => setPkgReleaseNotes(e.target.value)}
                  placeholder="Mô tả thay đổi trong phiên bản này..."
                  className="w-full px-3.5 py-2 rounded-2xl border border-line bg-sidebar text-xs text-text focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-line/60">
                <button
                  type="button"
                  onClick={() => setIsPackageModalOpen(false)}
                  className="min-h-[40px] px-5 rounded-full border border-line text-xs font-semibold text-muted hover:text-text cursor-pointer"
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

      {/* Modal Khởi Tạo Đợt Cập Nhật */}
      {isCampaignModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setIsCampaignModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-3xl bg-surface border border-line p-6 sm:p-7 shadow-2xl relative text-text space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line/60 pb-3">
              <div>
                <h4 className="text-base font-bold text-text">Khởi tạo chiến dịch OTA mới</h4>
                <p className="text-xs text-muted mt-0.5">
                  Gửi bản nâng cấp tới các Edge Node trực tuyến phù hợp theo quy trình an toàn.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCampaignModalOpen(false)}
                className="p-1.5 rounded-xl text-muted hover:text-text hover:bg-surface-hover cursor-pointer"
                aria-label="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-text">Tên chiến dịch</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: Bản vá v2.2.0 cho cụm Relay tầng 1"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-2xl border border-line bg-sidebar text-xs sm:text-sm text-text focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-text">Chọn gói Firmware</label>
                {packages.length === 0 ? (
                  <p className="text-xs text-rose-500">
                    Chưa có bản firmware nào. Hãy tải lên bản `.bin` trước.
                  </p>
                ) : (
                  <select
                    value={selectedPkgId}
                    onChange={(e) => setSelectedPkgId(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-2xl border border-line bg-sidebar text-xs sm:text-sm text-text focus:outline-none focus:border-primary"
                    required
                  >
                    <option value="">-- Chọn bản firmware triển khai --</option>
                    {packages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {formatDeviceType(p.deviceType)} — {p.version} ({p.uploaded ? formatBytes(p.fileSizeBytes) : 'URL'})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-text">Phương thức cập nhật</label>
                <select
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-2xl border border-line bg-sidebar text-xs sm:text-sm text-text focus:outline-none focus:border-primary"
                >
                  <option value="CANARY">
                    Nâng cấp an toàn 3 đợt (10% → 50% → 100%) [Khuyên dùng]
                  </option>
                  <option value="IMMEDIATE">Cập nhật đồng loạt toàn đội ngay (100%)</option>
                </select>
              </div>

              <div className="space-y-1.5 p-3.5 rounded-2xl bg-sidebar/50 border border-line">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-text flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-primary" />
                    Ngưỡng tự động dừng: <span className="text-primary font-bold">{threshold}% lỗi</span>
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

              <div className="flex justify-end gap-2.5 pt-3 border-t border-line/60">
                <button
                  type="button"
                  onClick={() => setIsCampaignModalOpen(false)}
                  className="min-h-[40px] px-5 rounded-full border border-line text-xs font-semibold text-muted hover:text-text cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCampaign || packages.length === 0}
                  className="min-h-[40px] flex items-center gap-1.5 px-5 rounded-full bg-primary text-white text-xs font-semibold hover:bg-primary-hover disabled:opacity-50 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Bắt đầu cập nhật</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
