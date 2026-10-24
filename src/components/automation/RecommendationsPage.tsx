import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  Sparkles,
  Brain,
  Check,
  X,
  EyeOff,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  Clock
} from 'lucide-react';
import {
  generateRecommendations,
  getRecommendations,
  resolveRecommendation,
  getModelStatus,
  retrainModel
} from '../../services/recommendationApi';
import type { Recommendation, MlModelStatus } from '../../types/recommendation';
import { AppSidebar } from '../ui/AppSidebar';

export function RecommendationsPage() {
  const { homeId = '' } = useParams();
  const [items, setItems] = useState<Recommendation[]>([]);
  const [modelStatus, setModelStatus] = useState<MlModelStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [modelLoading, setModelLoading] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadAll = async () => {
    try {
      const [recs, status] = await Promise.all([
        getRecommendations(homeId).catch(() => [] as Recommendation[]),
        getModelStatus(homeId).catch(() => null)
      ]);
      setItems(recs);
      setModelStatus(status);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể tải dữ liệu đề xuất.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, [homeId]);

  const refreshRecs = async () => {
    const recs = await getRecommendations(homeId);
    setItems(recs);
  };

  const generate = async () => {
    setWorkingId('generate');
    setError('');
    setSuccess('');
    try {
      const to = new Date();
      const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
      const created = await generateRecommendations(homeId, from.toISOString(), to.toISOString());
      await refreshRecs();
      if (created.length > 0) {
        setSuccess(`Mô hình Machine Learning đã phát hiện và tạo ${created.length} đề xuất mới đạt ngưỡng tin cậy >= 80%.`);
      } else {
        setSuccess('Không có hành vi nào đạt ngưỡng tin cậy >= 80% từ mô hình ML vào thời điểm này.');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể phân tích hành vi người dùng.');
    } finally {
      setWorkingId(null);
    }
  };

  const handleRetrain = async () => {
    setWorkingId('retrain');
    setModelLoading(true);
    setError('');
    setSuccess('');
    try {
      const newStatus = await retrainModel(homeId);
      setModelStatus(newStatus);
      if (newStatus.status === 'READY') {
        setSuccess(`Huấn luyện lại mô hình thành công! Phiên bản: ${newStatus.version}, Độ chính xác: ${Math.round((newStatus.accuracy ?? 0) * 100)}%.`);
      } else if (newStatus.status === 'COLD_START') {
        setError('Chưa đủ dữ liệu hành vi thực tế (cần tối thiểu 20 mẫu) để huấn luyện lại.');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Huấn luyện lại mô hình thất bại.');
    } finally {
      setWorkingId(null);
      setModelLoading(false);
    }
  };

  const resolve = async (item: Recommendation, action: 'approve' | 'reject' | 'dismiss') => {
    if (action === 'approve' && !window.confirm(`Chấp nhận đề xuất và tạo quy tắc tự động hóa cho ${item.deviceName ?? 'thiết bị'}?`)) {
      return;
    }
    setWorkingId(item.id);
    setError('');
    setSuccess('');
    try {
      await resolveRecommendation(homeId, item.id, action);
      await refreshRecs();
      if (action === 'approve') {
        setSuccess('Đã chấp nhận đề xuất và tạo quy tắc tự động thành công!');
      } else if (action === 'reject') {
        setSuccess('Đã từ chối đề xuất. Phản hồi đã được ghi nhận để cải thiện mô hình AI.');
      } else {
        setSuccess('Đã tạm thời bỏ qua đề xuất.');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể xử lý đề xuất.');
    } finally {
      setWorkingId(null);
    }
  };

  // Only consider items with eligible !== false as pending recommendations
  const pendingItems = items.filter(
    (item) => item.status === 'PENDING' && (item.eligible === undefined || item.eligible === true)
  );
  const historyItems = items.filter((item) => item.status !== 'PENDING');

  return (
    <div className="app-shell relative min-h-screen text-text">
      <AppSidebar activeItem="automations" homeId={homeId} />
      <main className="min-w-0 flex-1 p-4 text-text sm:p-6 lg:pl-64">
        <div className="mx-auto max-w-5xl space-y-6">
          {/* Header */}
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">Gợi ý hành vi thông minh (AI/ML)</h1>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  Random Forest
                </span>
              </div>
              <p className="text-sm text-muted mt-1">
                Hệ thống Machine Learning phân tích chuỗi thao tác thực tế và chỉ hiển thị gợi ý khi độ tin cậy đạt từ 80% trở lên.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to={`/homes/${homeId}/automation-rules`}
                className="rounded-xl bg-sidebar px-4 py-2.5 text-xs font-semibold text-text shadow-xs hover:bg-sidebar-hover transition-colors"
              >
                Về danh sách quy tắc
              </Link>
            </div>
          </header>

          {/* Feedback Alerts */}
          {error && (
            <div role="alert" className="flex items-center gap-3 rounded-xl bg-error-soft p-4 text-sm text-red-600">
              <AlertCircle size={18} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div role="status" className="flex items-center gap-3 rounded-xl bg-success-soft p-4 text-sm text-emerald-600">
              <ShieldCheck size={18} className="shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Model Status Card */}
          <div className="surface-card rounded-2xl p-5 border border-line shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Brain size={20} />
                </div>
                <div>
                  <h2 className="text-base font-semibold">Trạng thái Mô hình Machine Learning</h2>
                  <p className="text-xs text-muted">
                    {modelStatus?.status === 'READY'
                      ? 'Mô hình học máy đang hoạt động và sẵn sàng suy luận thói quen người dùng.'
                      : modelStatus?.status === 'COLD_START'
                      ? 'Hệ thống đang tích lũy dữ liệu hành vi người dùng (Cold-Start).'
                      : 'Đang kết nối tới dịch vụ Machine Learning...'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={workingId !== null || modelLoading}
                  onClick={() => void handleRetrain()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface hover:bg-sidebar px-3.5 py-2 text-xs font-semibold text-text transition-all disabled:opacity-50"
                  title="Huấn luyện lại mô hình với dữ liệu mới"
                >
                  <RefreshCw size={13} className={modelLoading ? 'animate-spin' : ''} />
                  <span>{modelLoading ? 'Đang huấn luyện...' : 'Huấn luyện lại'}</span>
                </button>

                <button
                  type="button"
                  disabled={workingId !== null || modelStatus?.status === 'COLD_START'}
                  onClick={() => void generate()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary hover:bg-primary/90 px-4 py-2 text-xs font-semibold text-white transition-all disabled:opacity-50 shadow-xs"
                >
                  <Sparkles size={13} />
                  <span>{workingId === 'generate' ? 'Đang phân tích...' : 'Phân tích & Dự đoán ML'}</span>
                </button>
              </div>
            </div>

            {/* Model Metrics Grid */}
            {modelStatus?.status === 'READY' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-line text-xs">
                <div className="p-2.5 rounded-lg bg-surface border border-line/60">
                  <span className="text-muted block">Phiên bản mô hình</span>
                  <span className="font-semibold text-text">{modelStatus.version}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-surface border border-line/60">
                  <span className="text-muted block">Độ chính xác (Accuracy)</span>
                  <span className="font-semibold text-emerald-600">
                    {modelStatus.accuracy ? `${Math.round(modelStatus.accuracy * 100)}%` : 'N/A'}
                  </span>
                  {modelStatus.baselineAccuracy && (
                    <span className="text-[10px] text-muted ml-1">
                      (vs Baseline {Math.round(modelStatus.baselineAccuracy * 100)}%)
                    </span>
                  )}
                </div>
                <div className="p-2.5 rounded-lg bg-surface border border-line/60">
                  <span className="text-muted block">Ngưỡng hiển thị</span>
                  <span className="font-semibold text-amber-500">
                    ≥ {Math.round((modelStatus.confidenceThreshold ?? 0.8) * 100)}%
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-surface border border-line/60">
                  <span className="text-muted block">Số mẫu dữ liệu</span>
                  <span className="font-semibold text-text">
                    {modelStatus.trainSamples ?? 0} train / {modelStatus.testSamples ?? 0} test
                  </span>
                </div>
              </div>
            )}

            {modelStatus?.status === 'COLD_START' && (
              <div className="rounded-xl bg-amber-500/10 p-3.5 text-xs text-amber-600 border border-amber-500/20">
                <strong>Chưa đủ dữ liệu huấn luyện: </strong>
                Mô hình chỉ được kích hoạt khi thu thập đủ tối thiểu 20 sự kiện điều khiển thiết bị thực tế từ người dùng.
                Không sử dụng dữ liệu giả để đảm bảo tính an toàn cho thiết bị trong gia đình.
              </div>
            )}
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-line gap-4 text-sm font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              className={`pb-2.5 border-b-2 transition-colors ${
                activeTab === 'pending'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:text-text'
              }`}
            >
              Gợi ý hợp lệ ({pendingItems.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`pb-2.5 border-b-2 transition-colors ${
                activeTab === 'history'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:text-text'
              }`}
            >
              Lịch sử phản hồi ({historyItems.length})
            </button>
          </div>

          {/* Content Area */}
          {loading ? (
            <div className="surface-card p-8 text-center text-muted">
              <RefreshCw size={24} className="mx-auto mb-2 animate-spin text-primary" />
              <p>Đang tải danh sách gợi ý và kiểm tra độ tin cậy mô hình...</p>
            </div>
          ) : activeTab === 'pending' ? (
            pendingItems.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {pendingItems.map((item) => (
                  <article
                    key={item.id}
                    className="surface-card rounded-2xl border border-line p-5 space-y-4 shadow-xs hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-bold text-text">
                            {item.deviceName ?? 'Thiết bị'}
                          </h2>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              item.proposedAction.action === 'TURN_ON'
                                ? 'bg-emerald-500/10 text-emerald-600'
                                : 'bg-red-500/10 text-red-600'
                            }`}
                          >
                            {item.proposedAction.action === 'TURN_ON' ? 'Bật' : 'Tắt'}
                          </span>
                        </div>
                        <span className="text-xs text-muted">ID: {item.deviceId?.slice(0, 8)}...</span>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                          {item.engineType === 'ML' ? 'Machine Learning' : 'Quy tắc'}
                        </span>
                        <span className="text-[11px] font-semibold text-emerald-600">
                          Độ tin cậy: {Math.round(item.confidence * 100)}%
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-text/80 bg-sidebar/50 p-3 rounded-xl border border-line/60">
                      {item.explanation}
                    </p>

                    <dl className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <dt className="text-muted">Kích hoạt dự kiến</dt>
                        <dd className="font-medium text-text flex items-center gap-1 mt-0.5">
                          <Clock size={12} className="text-primary" />
                          Hằng ngày lúc {item.triggerCondition.time?.slice(0, 5) ?? '00:00'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted">Hành động đề xuất</dt>
                        <dd className="font-medium text-text mt-0.5">
                          {item.proposedAction.action}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted">Mô hình suy luận</dt>
                        <dd className="font-medium text-text mt-0.5">
                          {item.modelVersion ?? 'rf-v1.0.0'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted">Trạng thái xác thực</dt>
                        <dd className="font-medium text-emerald-600 flex items-center gap-1 mt-0.5">
                          <ShieldCheck size={12} />
                          Đạt ngưỡng (≥ 80%)
                        </dd>
                      </div>
                    </dl>

                    {/* Action buttons: Chấp nhận, Từ chối, Bỏ qua */}
                    <div className="pt-2 border-t border-line flex items-center gap-2">
                      <button
                        type="button"
                        disabled={workingId !== null}
                        onClick={() => void resolve(item, 'approve')}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary hover:bg-primary/90 px-3 py-2 text-xs font-semibold text-white transition-all disabled:opacity-50"
                      >
                        <Check size={14} />
                        <span>Chấp nhận</span>
                      </button>

                      <button
                        type="button"
                        disabled={workingId !== null}
                        onClick={() => void resolve(item, 'reject')}
                        className="inline-flex items-center justify-center gap-1 rounded-xl bg-error-soft hover:bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-600 transition-all disabled:opacity-50"
                        title="Từ chối đề xuất này"
                      >
                        <X size={14} />
                        <span>Từ chối</span>
                      </button>

                      <button
                        type="button"
                        disabled={workingId !== null}
                        onClick={() => void resolve(item, 'dismiss')}
                        className="inline-flex items-center justify-center gap-1 rounded-xl bg-sidebar hover:bg-sidebar-hover px-3 py-2 text-xs font-semibold text-muted hover:text-text transition-all disabled:opacity-50"
                        title="Tạm thời bỏ qua"
                      >
                        <EyeOff size={14} />
                        <span>Bỏ qua</span>
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="surface-card rounded-2xl p-8 text-center border border-line space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-sidebar text-muted">
                  <Sparkles size={24} />
                </div>
                <h3 className="text-base font-semibold">Chưa có đề xuất nào đạt ngưỡng hiển thị</h3>
                <p className="text-xs text-muted max-w-md mx-auto">
                  Hệ thống Machine Learning áp dụng cơ chế kiểm soát nghiêm ngặt: chỉ hiển thị gợi ý khi mô hình đạt độ tin cậy từ 80% trở lên và hành động hợp lệ với trạng thái thiết bị.
                </p>
                {modelStatus?.status === 'READY' && (
                  <button
                    type="button"
                    disabled={workingId !== null}
                    onClick={() => void generate()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary/90 transition-all disabled:opacity-50 mt-2"
                  >
                    <Sparkles size={13} />
                    <span>Phân tích & Dự đoán ngay</span>
                  </button>
                )}
              </div>
            )
          ) : (
            /* History Tab */
            historyItems.length > 0 ? (
              <div className="space-y-3">
                {historyItems.map((item) => (
                  <article
                    key={item.id}
                    className="surface-card rounded-xl border border-line p-4 flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-text text-sm">
                          {item.deviceName ?? 'Thiết bị'} · {item.proposedAction.action}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            item.status === 'ACCEPTED' || item.status === 'APPROVED'
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : item.status === 'REJECTED'
                              ? 'bg-red-500/10 text-red-600'
                              : 'bg-muted/10 text-muted'
                          }`}
                        >
                          {item.status === 'ACCEPTED' || item.status === 'APPROVED'
                            ? 'Đã chấp nhận'
                            : item.status === 'REJECTED'
                            ? 'Đã từ chối'
                            : 'Đã bỏ qua'}
                        </span>
                        <span className="text-[10px] text-muted">
                          [{item.engineType ?? 'ML'}]
                        </span>
                      </div>
                      <p className="text-muted">{item.explanation}</p>
                    </div>

                    <div className="text-right text-[11px] text-muted shrink-0">
                      <div>Độ tin cậy: {Math.round(item.confidence * 100)}%</div>
                      <div>
                        {item.resolvedAt
                          ? `Xử lý lúc: ${new Date(item.resolvedAt).toLocaleString('vi-VN')}`
                          : `Tạo lúc: ${new Date(item.createdAt).toLocaleString('vi-VN')}`}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="surface-card rounded-xl p-8 text-center text-muted text-xs">
                Chưa có lịch sử phản hồi đề xuất nào.
              </div>
            )
          )}
        </div>
      </main>
    </div>
  );
}
