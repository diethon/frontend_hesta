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
      notify.error('Lỗi khi tải dữ liệu chiến dịch OTA');
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
      notify.error('Vui lòng chọn Firmware Package');
      return;
    }

    setIsSubmitting(true);
    try {
      await createOtaCampaign({
        name: name.trim() || 'Chiến dịch cập nhật firmware',
        firmwarePackageId: selectedPkgId,
        rolloutStrategy: strategy,
        failureThresholdPercent: threshold,
      });
      notify.success('Khởi tạo chiến dịch thành công', 'Đang bắt đầu cuốn chiếu đợt 1');
      setIsModalOpen(false);
      setName('');
      await fetchData();
    } catch (err: any) {
      notify.error(err?.response?.data?.message || 'Lỗi khi tạo chiến dịch OTA');
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
        releaseNotes: 'Bản vá sửa lỗi dội xung Relay và tối ưu hóa bộ đệm MQTT',
      });
      notify.success('Đã thêm gói firmware mẫu v2.1.0');
      await fetchData();
    } catch {
      notify.error('Lỗi khi thêm gói firmware');
    }
  };

  const handleAbort = async (id: string) => {
    if (!window.confirm('CẢNH BÁO: Bạn có chắc chắn muốn ngắt khẩn cấp chiến dịch OTA này?')) return;
    try {
      await abortOtaCampaign(id, 'Admin hủy khẩn cấp trên giao diện');
      notify.success('Đã ngắt chiến dịch OTA thành công');
      await fetchData();
    } catch {
      notify.error('Lỗi khi hủy chiến dịch');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Actions */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-primary/10 via-surface to-surface border border-line flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-xl bg-primary/20 text-primary">
              <UploadCloud className="w-5 h-5" />
            </span>
            <h3 className="text-lg font-bold text-text">
              OTA Firmware Campaign Orchestrator
            </h3>
          </div>
          <p className="text-xs text-muted max-w-xl">
            Quản trị cập nhật phần mềm không dây cuốn chiếu Canary (10% $\rightarrow$ 50% $\rightarrow$ 100%).
            Tự động kích hoạt <strong>Auto-Abort</strong> nếu tỷ lệ lỗi phần cứng vượt ngưỡng an toàn 20%.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {packages.length === 0 && (
            <button
              onClick={handleSeedPackage}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-line text-xs font-semibold text-text hover:bg-sidebar transition-colors"
            >
              <FileCode className="w-4 h-4 text-primary" />
              Thêm Gói Mẫu v2.1.0
            </button>
          )}

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover transition-all shadow-md"
          >
            <Plus className="w-4 h-4" />
            Khởi Tạo Chiến Dịch Mới
          </button>
        </div>
      </div>

      {/* Campaigns List */}
      <div className="space-y-4">
        <h4 className="text-sm font-bold text-text flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          Các Chiến Dịch Đang Thực Thi ({campaigns.length})
        </h4>

        {campaigns.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-line bg-surface">
            <Layers className="w-12 h-12 text-muted mx-auto mb-3 opacity-40" />
            <p className="text-sm font-semibold text-text">Chưa có chiến dịch OTA nào</p>
            <p className="text-xs text-muted mt-1">
              Bấm &quot;Khởi Tạo Chiến Dịch Mới&quot; để phát lệnh nâng cấp firmware đến các bo mạch ESP32.
            </p>
          </div>
        ) : (
          campaigns.map((camp) => {
            const isAborted = camp.status.includes('ABORTED');
            const isCompleted = camp.status === 'COMPLETED';
            const isCancelled = camp.status === 'CANCELLED';

            // Calculate progress percent
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
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sidebar text-muted">
                        {camp.deviceType}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted mt-0.5">
                      Bắt đầu lúc: {new Date(camp.createdAt || '').toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                        isCompleted
                          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                          : isAborted
                          ? 'bg-red-500/10 text-red-500 border border-red-500/20 animate-pulse'
                          : isCancelled
                          ? 'bg-muted/20 text-muted'
                          : 'bg-primary/10 text-primary border border-primary/20'
                      }`}
                    >
                      {isCompleted && <CheckCircle className="w-3.5 h-3.5" />}
                      {isAborted && <AlertOctagon className="w-3.5 h-3.5" />}
                      {camp.status}
                    </span>

                    {!isCompleted && !isAborted && !isCancelled && (
                      <button
                        onClick={() => handleAbort(camp.id)}
                        className="px-3 py-1 rounded-xl border border-red-500/30 text-red-500 hover:bg-red-500/10 text-xs font-semibold transition-colors"
                      >
                        Hủy Khẩn Cấp
                      </button>
                    )}
                  </div>
                </div>

                {/* Canary Progress Bar */}
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-xs text-muted font-medium">
                    <span>Tiến độ Canary Rollout:</span>
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

                {/* Sub Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-line text-xs">
                  <div>
                    <span className="text-muted block">Tổng số bo mạch:</span>
                    <strong className="text-text font-bold text-sm">{camp.totalNodes} Nodes</strong>
                  </div>
                  <div>
                    <span className="text-muted block">Đã hoàn thành:</span>
                    <strong className="text-emerald-500 font-bold text-sm">{camp.successNodes} Nodes</strong>
                  </div>
                  <div>
                    <span className="text-muted block">Thất bại / Lỗi:</span>
                    <strong className="text-red-500 font-bold text-sm">{camp.failedNodes} Nodes</strong>
                  </div>
                  <div>
                    <span className="text-muted block">Tỷ lệ lỗi (Ngưỡng {camp.failureThresholdPercent}%):</span>
                    <strong
                      className={`font-bold text-sm ${
                        failRate > camp.failureThresholdPercent ? 'text-red-500' : 'text-text'
                      }`}
                    >
                      {failRate}%
                    </strong>
                  </div>
                </div>

                {camp.abortReason && (
                  <div className="mt-3 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-medium flex items-center gap-2">
                    <AlertOctagon className="w-4 h-4 shrink-0" />
                    <span>Lý do dừng: {camp.abortReason}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal Khởi Tạo Chiến Dịch */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-surface border border-line p-6 shadow-2xl relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-xl text-muted hover:text-text hover:bg-sidebar transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h4 className="text-lg font-bold text-text mb-4">
              Khởi Tạo Chiến Dịch OTA Canary
            </h4>

            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Tên Chiến Dịch</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Vd: Nâng cấp firmware chống dội xung"
                  className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-sm text-text focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Gói Firmware</label>
                {packages.length === 0 ? (
                  <p className="text-xs text-amber-500">Chưa có gói nào. Hãy bấm nút &quot;Thêm Gói Mẫu&quot; trước.</p>
                ) : (
                  <select
                    value={selectedPkgId}
                    onChange={(e) => setSelectedPkgId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-sm text-text focus:outline-none focus:border-primary"
                    required
                  >
                    <option value="">-- Chọn Firmware Package --</option>
                    {packages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.deviceType} - {p.version}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Chiến Lược Rollout</label>
                <select
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-sm text-text focus:outline-none focus:border-primary"
                >
                  <option value="CANARY">Canary Cuốn Chiếu (10% $\rightarrow$ 50% $\rightarrow$ 100%) [Khuyến nghị]</option>
                  <option value="IMMEDIATE">Toàn Bộ Ngay Lập Tức (100%)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Ngưỡng Tự Động Ngắt Khẩn Cấp (Auto-Abort Failure Threshold): {threshold}%
                </label>
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="5"
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-line text-xs font-semibold text-muted hover:text-text hover:bg-sidebar transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || packages.length === 0}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover disabled:opacity-50 transition-all shadow-md"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Bắt Đầu Chiến Dịch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
