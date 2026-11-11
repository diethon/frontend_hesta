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
} from 'lucide-react';
import type { OtaCampaign, FirmwarePackage } from '../../types/diagnostics';
import {
  getOtaCampaigns,
  getOtaPackages,
  registerOtaPackage,
  createOtaCampaign,
  abortOtaCampaign,
} from '../../services/diagnosticsApi';
import { notify } from '../ui/notify';

export const OtaCampaignManager: React.FC = () => {
  const [campaigns, setCampaigns] = useState<OtaCampaign[]>([]);
  const [packages, setPackages] = useState<FirmwarePackage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [selectedPkgId, setSelectedPkgId] = useState('');
  const [strategy, setStrategy] = useState('CANARY');
  const [threshold, setThreshold] = useState(20);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    fetchData();
    const timer = setInterval(fetchData, 4000);
    return () => clearInterval(timer);
  }, []);

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPkgId) {
      notify.error('Vui lòng chọn bản cập nhật phần mềm');
      return;
    }

    setIsSubmitting(true);
    try {
      await createOtaCampaign({
        name: name.trim() || 'Bản cập nhật phần mềm thiết bị',
        firmwarePackageId: selectedPkgId,
        rolloutStrategy: strategy,
        failureThresholdPercent: threshold,
      });
      notify.success('Đã khởi tạo đợt cập nhật thành công', 'Bắt đầu gửi bản nâng cấp đến đợt 1');
      setIsModalOpen(false);
      setName('');
      await fetchData();
    } catch (err: any) {
      notify.error(err?.response?.data?.message || 'Lỗi khi khởi tạo đợt cập nhật');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSeedPackage = async () => {
    try {
      await registerOtaPackage({
        deviceType: 'ESP32_RELAY',
        version: 'v2.1.0',
        fileUrl: 'https://firmware.hesta.vn/releases/esp32_relay_v2.1.0.bin',
        checksumSha256: 'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0',
        fileSizeBytes: 1245184,
        releaseNotes: 'Bản vá sửa lỗi công tắc chập chờn và tối ưu hóa phản hồi mạng',
      });
      notify.success('Đã nạp bản vá mẫu v2.1.0 cho công tắc Relay');
      await fetchData();
    } catch {
      notify.error('Lỗi khi thêm bản vá mẫu');
    }
  };

  const handleAbort = async (id: string) => {
    if (!window.confirm('CẢNH BÁO AN TOÀN: Bạn có chắc chắn muốn ngắt dừng khẩn cấp đợt cập nhật này? Các thiết bị chưa cập nhật sẽ tiếp tục chạy phiên bản hiện tại.')) {
      return;
    }
    try {
      await abortOtaCampaign(id, 'Người dùng chủ động dừng khẩn cấp trên giao diện');
      notify.success('Đã dừng khẩn cấp đợt cập nhật an toàn');
      await fetchData();
    } catch {
      notify.error('Gặp sự cố khi dừng đợt cập nhật');
    }
  };

  const formatDeviceType = (type: string) => {
    if (type.includes('RELAY')) return 'Công Tắc Relay (ESP32)';
    if (type.includes('ENERGY')) return 'Đo Điện Năng (ESP32)';
    return type || 'Thiết bị thông minh';
  };

  const getFriendlyStatus = (status: string) => {
    switch (status) {
      case 'RUNNING_CANARY_10':
        return { label: 'Đang thử nghiệm đợt 1 (10% thiết bị)', color: 'bg-primary/10 text-primary border-primary/20' };
      case 'RUNNING_CANARY_50':
        return { label: 'Đang mở rộng đợt 2 (50% thiết bị)', color: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' };
      case 'RUNNING_FULL_100':
        return { label: 'Đang hoàn tất toàn nhà (100% thiết bị)', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' };
      case 'COMPLETED':
        return { label: 'Nâng cấp thành công hoàn tất', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' };
      case 'ABORTED':
      case 'ABORTED_AUTO':
        return { label: 'Đã dừng khẩn cấp (Bảo vệ an toàn)', color: 'bg-red-500/10 text-red-500 border-red-500/20 animate-pulse' };
      case 'CANCELLED':
        return { label: 'Đã hủy bởi người dùng', color: 'bg-muted/20 text-muted border-line' };
      default:
        return { label: status, color: 'bg-primary/10 text-primary border-primary/20' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner Giới Thiệu Chức Năng Dễ Hiểu */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-primary/10 via-surface to-surface border border-line flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-2xl bg-primary/20 text-primary">
              <UploadCloud className="w-5 h-5" />
            </span>
            <h3 className="text-lg font-bold text-text">
              Cập Nhật Phần Mềm Thiết Bị Từ Xa (Nâng Cấp Thông Minh)
            </h3>
          </div>
          <p className="text-xs text-muted max-w-2xl leading-relaxed">
            Tự động nâng cấp tính năng mới và sửa lỗi cho công tắc, cảm biến trong nhà qua Wi-Fi mà không cần tháo gỡ.
            Chế độ <strong>Nâng cấp an toàn 3 đợt</strong> (Thử 10% $\rightarrow$ Mở rộng 50% $\rightarrow$ Hoàn tất 100%) kèm cơ chế
            <strong> tự ngắt khẩn cấp</strong> nếu tỷ lệ lỗi phần cứng vượt mức an toàn, đảm bảo sinh hoạt gia đình không bị gián đoạn.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {packages.length === 0 && (
            <button
              onClick={handleSeedPackage}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-line text-xs font-semibold text-text hover:bg-sidebar transition-colors"
            >
              <FileCode className="w-4 h-4 text-primary" />
              Thêm Bản Vá Mẫu (v2.1.0)
            </button>
          )}

          <button
            onClick={fetchData}
            disabled={isLoading}
            className="p-2 rounded-xl border border-line text-xs font-semibold text-text hover:bg-sidebar transition-colors"
            title="Làm mới dữ liệu"
          >
            <RotateCw className={`w-4 h-4 text-muted ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover transition-all shadow-md"
          >
            <Plus className="w-4 h-4" />
            Khởi Tạo Đợt Cập Nhật Mới
          </button>
        </div>
      </div>

      {/* Danh Sách Các Đợt Cập Nhật */}
      <div className="space-y-4">
        <h4 className="text-sm font-bold text-text flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          Tiến Độ Các Đợt Cập Nhật ({campaigns.length})
        </h4>

        {campaigns.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-line bg-surface">
            <Layers className="w-12 h-12 text-muted mx-auto mb-3 opacity-40" />
            <p className="text-sm font-semibold text-text">Chưa có đợt cập nhật nào đang diễn ra</p>
            <p className="text-xs text-muted mt-1 max-w-md mx-auto">
              Bấm &quot;Khởi Tạo Đợt Cập Nhật Mới&quot; để gửi bản vá sửa lỗi hoặc tính năng mới đến các công tắc trong nhà một cách an toàn.
            </p>
          </div>
        ) : (
          campaigns.map((camp) => {
            const isAborted = camp.status.includes('ABORTED');
            const isCompleted = camp.status === 'COMPLETED';
            const isCancelled = camp.status === 'CANCELLED';
            const statusInfo = getFriendlyStatus(camp.status);

            // Tính toán thanh phần trăm tiến độ
            let progressPercent = 10;
            if (camp.status === 'RUNNING_CANARY_50') progressPercent = 50;
            if (camp.status === 'RUNNING_FULL_100') progressPercent = 90;
            if (isCompleted) progressPercent = 100;
            if (isAborted || isCancelled) progressPercent = Math.min(progressPercent, 40);

            const failRate = camp.attemptedNodes > 0
              ? Math.round((camp.failedNodes * 100) / camp.attemptedNodes)
              : 0;

            return (
              <div
                key={camp.id}
                className="p-5 rounded-2xl border border-line bg-surface hover:shadow-md transition-shadow"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h5 className="text-base font-bold text-text">{camp.name}</h5>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-primary/10 text-primary">
                        {camp.version}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-sidebar text-muted flex items-center gap-1">
                        <Cpu className="w-3 h-3" />
                        {formatDeviceType(camp.deviceType)}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted mt-1">
                      Bắt đầu lúc: {new Date(camp.createdAt || '').toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${statusInfo.color}`}
                    >
                      {isCompleted && <CheckCircle className="w-3.5 h-3.5" />}
                      {isAborted && <AlertOctagon className="w-3.5 h-3.5" />}
                      {statusInfo.label}
                    </span>

                    {!isCompleted && !isAborted && !isCancelled && (
                      <button
                        onClick={() => handleAbort(camp.id)}
                        className="px-3 py-1 rounded-xl border border-red-500/30 text-red-500 hover:bg-red-500/10 text-xs font-semibold transition-colors"
                      >
                        Dừng Khẩn Cấp
                      </button>
                    )}
                  </div>
                </div>

                {/* Thanh Tiến Độ Rollout */}
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-xs text-muted font-medium">
                    <span>Tiến độ cập nhật các đợt:</span>
                    <strong className="text-text">{progressPercent}%</strong>
                  </div>
                  <div className="w-full h-3 rounded-full bg-sidebar overflow-hidden relative">
                    <div
                      className={`h-full transition-all duration-700 ${
                        isAborted
                          ? 'bg-red-500'
                          : isCompleted
                          ? 'bg-emerald-500'
                          : 'bg-primary'
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Các Chỉ Số Quan Trọng Thân Thiện */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-line text-xs">
                  <div>
                    <span className="text-muted block">Tổng thiết bị tham gia:</span>
                    <strong className="text-text font-bold text-sm">{camp.totalNodes} Thiết bị</strong>
                  </div>
                  <div>
                    <span className="text-muted block">Cập nhật thành công:</span>
                    <strong className="text-emerald-500 font-bold text-sm">{camp.successNodes} Thiết bị</strong>
                  </div>
                  <div>
                    <span className="text-muted block">Gặp sự cố / Lỗi:</span>
                    <strong className="text-red-500 font-bold text-sm">{camp.failedNodes} Thiết bị</strong>
                  </div>
                  <div>
                    <span className="text-muted block">Tỷ lệ lỗi hiện tại:</span>
                    <strong
                      className={`font-bold text-sm ${
                        failRate > camp.failureThresholdPercent ? 'text-red-500' : 'text-text'
                      }`}
                    >
                      {failRate}% (Tối đa {camp.failureThresholdPercent}%)
                    </strong>
                  </div>
                </div>

                {camp.abortReason && (
                  <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-medium flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>Lý do dừng an toàn: {camp.abortReason}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal Khởi Tạo Đợt Cập Nhật */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-surface border border-line p-6 shadow-2xl relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-xl text-muted hover:text-text hover:bg-sidebar transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h4 className="text-lg font-bold text-text mb-1">
              Khởi Tạo Đợt Cập Nhật Phần Mềm Mới
            </h4>
            <p className="text-xs text-muted mb-4">
              Hệ thống sẽ tự động gửi bản nâng cấp đến các công tắc thông minh theo đúng quy trình an toàn.
            </p>

            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text mb-1">
                  Tên Đợt Cập Nhật (Gợi nhớ dễ hiểu)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: Bản vá chống chập chờn công tắc đèn tầng 1"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-surface text-sm text-text focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text mb-1">
                  Chọn Bản Vá Phần Mềm
                </label>
                {packages.length === 0 ? (
                  <p className="text-xs text-amber-500">
                    Chưa có bản cập nhật nào. Hãy bấm nút &quot;Thêm Bản Vá Mẫu&quot; bên ngoài trước.
                  </p>
                ) : (
                  <select
                    value={selectedPkgId}
                    onChange={(e) => setSelectedPkgId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-surface text-sm text-text focus:outline-none focus:border-primary"
                    required
                  >
                    <option value="">-- Chọn bản cập nhật cho thiết bị --</option>
                    {packages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {formatDeviceType(p.deviceType)} — Phiên bản {p.version}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-text mb-1">
                  Phương Thức Cập Nhật
                </label>
                <select
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-surface text-sm text-text focus:outline-none focus:border-primary"
                >
                  <option value="CANARY">
                    Nâng cấp an toàn 3 đợt (Thử 10% → Mở rộng 50% → Hoàn tất 100%) [Khuyên dùng]
                  </option>
                  <option value="IMMEDIATE">
                    Cập nhật đồng loạt toàn bộ thiết bị ngay (100%)
                  </option>
                </select>
                <p className="text-[11px] text-muted mt-1">
                  Chế độ 3 đợt giúp phát hiện sớm sự cố trên số ít thiết bị trước khi cập nhật toàn nhà.
                </p>
              </div>

              <div className="space-y-1.5 p-3.5 rounded-2xl bg-sidebar/50 border border-line">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-text flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-amber-500" />
                    Ngưỡng tự động dừng an toàn: <span className="text-primary font-bold">{threshold}% lỗi</span>
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
                  className="w-full accent-primary"
                />
                <p className="text-[11px] text-muted">
                  Nếu tỷ lệ thiết bị nâng cấp thất bại vượt quá {threshold}%, hệ thống sẽ ngắt ngay đợt cập nhật để bảo vệ các thiết bị còn lại.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-line text-xs font-semibold text-muted hover:text-text hover:bg-sidebar transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || packages.length === 0}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover disabled:opacity-50 transition-all shadow-md"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Bắt Đầu Cập Nhật
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
