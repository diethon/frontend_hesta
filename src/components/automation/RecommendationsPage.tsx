import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  generateRecommendations,
  getRecommendations,
  resolveRecommendation,
  getModelStatus,
  retrainModel
} from '../../services/recommendationApi';
import type { Recommendation, MlModelStatus } from '../../types/recommendation';
import { useAppSelector } from '../../store/hooks';
import { DashboardNavRail } from '../home/DashboardNavRail';
import { DashboardBottomNav } from '../home/DashboardBottomNav';
import { AutomationTopBar } from './AutomationTopBar';
import { Icon } from '../ui/LucideIcon';
import { formatRepeatDays } from '../scene/SceneScheduleSection';
import { actionLabels } from './ruleLabels';

export function RecommendationsPage() {
  const { homeId = '' } = useParams();
  const navigate = useNavigate();
  const authUser = useAppSelector((state) => state.auth.user);
  const userInitial = authUser?.fullName?.charAt(0) || authUser?.email?.charAt(0) || 'U';
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
        setSuccess(`Đã tìm thấy ${created.length} thói quen mới của gia đình bạn.`);
      } else {
        setSuccess('Chưa thấy thói quen nào lặp lại đủ thường xuyên. Cứ dùng nhà như bình thường, HESTA sẽ tự nhận ra.');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Chưa tìm được thói quen lúc này, bạn thử lại sau nhé.');
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
        setSuccess(`Đã huấn luyện mô hình ${newStatus.version}: F1 bật/tắt ${Math.round((newStatus.f1Score ?? 0) * 100)}%.`);
      } else if (newStatus.status === 'COLD_START') {
        setError(String(newStatus.metrics?.reason ?? 'Chưa đủ dữ liệu thật để huấn luyện (cần 20 lần bật/tắt trong 7 ngày).'));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Huấn luyện lại mô hình thất bại.');
    } finally {
      setWorkingId(null);
      setModelLoading(false);
    }
  };

  const resolve = async (item: Recommendation, action: 'approve' | 'reject' | 'dismiss') => {
    if (action === 'approve' && !window.confirm(`Tạo quy tắc tự động: ${actionText(item)} vào ${item.triggerCondition.time?.slice(0, 5) ?? 'giờ này'}?`)) {
      return;
    }
    setWorkingId(item.id);
    setError('');
    setSuccess('');
    try {
      await resolveRecommendation(homeId, item.id, action);
      await refreshRecs();
      if (action === 'approve') {
        setSuccess('Đã tạo quy tắc tự động từ gợi ý này.');
      } else if (action === 'reject') {
        setSuccess('Đã bỏ qua gợi ý này. HESTA sẽ ghi nhớ để gợi ý đúng ý bạn hơn.');
      } else {
        setSuccess('Đã để gợi ý này lại sau.');
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

  const threshold = Math.round((modelStatus?.confidenceThreshold ?? 0.8) * 100);
  const isReady = modelStatus?.status === 'READY';
  const isColdStart = modelStatus?.status === 'COLD_START';
  const learnedActions = modelStatus?.metrics?.user_actions;
  const learnedDays = modelStatus?.metrics?.train_days;
  const modelDescription = isReady
    ? learnedActions && learnedDays
      ? `HESTA đã học từ ${String(learnedActions)} lần bạn bật/tắt thiết bị trong ${String(learnedDays)} ngày qua.`
      : 'HESTA đã hiểu thói quen của gia đình bạn và sẵn sàng gợi ý.'
    : isColdStart
    ? 'HESTA vẫn đang làm quen với ngôi nhà. Hãy dùng thêm vài ngày để gợi ý chính xác hơn.'
    : loading
    ? 'Đang chuẩn bị…'
    : 'Tính năng gợi ý đang tạm nghỉ. Bạn vẫn dùng mọi thứ khác bình thường.';
  // ML reasons end with stats ("(lệch ±12 phút). Độ tin cậy 82% …"); keep only the plain sentence.
  const plainExplanation = (text?: string) => {
    if (!text) return '';
    const cut = text.search(/\s*\(lệch|[.,]?\s*(với )?độ tin cậy/i);
    const head = (cut > 0 ? text.slice(0, cut) : text).trim().replace(/^AI phát hiện bạn/, 'Bạn');
    return /[.!?]$/.test(head) ? head : `${head}.`;
  };
  const confidenceLabel = (value: number) =>
    value >= 0.9 ? 'Rất chắc chắn' : value >= 0.75 ? 'Khá chắc chắn' : 'Có thể';
  const actionText = (item: Recommendation) =>
    `${actionLabels[item.proposedAction.action] || item.proposedAction.action} ${item.deviceName ?? 'thiết bị'}`;

  return (
    <div className="app-shell scenes-page studio st-theme st-pro">
      <DashboardNavRail
        homeId={homeId}
        activeItem="automations"
        user={authUser ?? undefined}
        onSelectOverview={() => navigate('/home')}
        onOpenSettings={() => {}}
        onOpenProfile={() => {}}
      />
      <main>
        <AutomationTopBar
          caption="Gợi ý thông minh"
          title="Gợi ý cho bạn"
          subtitle="HESTA để ý những việc bạn hay làm vào cùng một giờ và gợi ý tự động hóa chúng giúp bạn."
          userInitial={userInitial}
        />

        {error && (
          <div role="alert" className="st-alert error">
            <Icon name="alert" size={18} />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div role="status" className="st-alert ok">
            <Icon name="check" size={18} />
            <span>{success}</span>
          </div>
        )}

        <section className="st-model" aria-label="HESTA đang học thói quen">
          <div className="st-model-head">
            <span className="st-model-badge">
              <Icon name="sparkles" />
            </span>
            <div>
              <h3>
                {isReady || isColdStart || loading ? 'HESTA đang học thói quen của bạn' : 'Gợi ý thông minh'}
                <i className={`st-dot ${isReady ? 'on' : isColdStart || loading ? '' : 'err'}`} />
              </h3>
              <p>{modelDescription}</p>
            </div>
          </div>

          <div className="st-model-actions">
            <button
              type="button"
              className="st-btn st-btn-primary"
              disabled={workingId !== null}
              onClick={() => void generate()}
            >
              <Icon name="sparkles" size={16} />
              {workingId === 'generate' ? 'Đang tìm…' : 'Tìm thói quen mới'}
            </button>
          </div>

          {/* Technical details stay available for admins/demo but collapsed by default. */}
          <details className="st-tech">
            <summary>Chi tiết kỹ thuật</summary>
            {isReady && modelStatus && (
              <dl className="st-metrics">
                <div>
                  <dt>F1 bật/tắt</dt>
                  <dd>
                    {Math.round((modelStatus.f1Score ?? 0) * 100)}%
                    <small>luật đơn giản {Math.round((modelStatus.baselineF1 ?? 0) * 100)}%</small>
                  </dd>
                </div>
                <div>
                  <dt>Ngưỡng hiển thị</dt>
                  <dd>≥ {threshold}%</dd>
                </div>
                <div>
                  <dt>Dữ liệu học</dt>
                  <dd>
                    {String(learnedActions ?? '—')}
                    <small>thao tác · {String(learnedDays ?? '—')} ngày</small>
                  </dd>
                </div>
                <div>
                  <dt>Phiên bản</dt>
                  <dd>{modelStatus.version}</dd>
                </div>
              </dl>
            )}
            <button
              type="button"
              className="st-btn st-btn-sm"
              disabled={workingId !== null || modelLoading}
              onClick={() => void handleRetrain()}
            >
              <Icon name="refresh" size={15} className={`icon ${modelLoading ? 'animate-spin' : ''}`} />
              {modelLoading ? 'Đang huấn luyện…' : 'Huấn luyện lại mô hình'}
            </button>
          </details>
        </section>

        <div className="st-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'pending'}
            className={activeTab === 'pending' ? 'active' : ''}
            onClick={() => setActiveTab('pending')}
          >
            Gợi ý mới <span className="st-count">{pendingItems.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'history'}
            className={activeTab === 'history' ? 'active' : ''}
            onClick={() => setActiveTab('history')}
          >
            Đã xem <span className="st-count">{historyItems.length}</span>
          </button>
        </div>

        {loading ? (
          <div className="st-insights" aria-busy="true">
            {[0, 1].map((i) => (
              <div key={i} className="st-skeleton" style={{ height: 112 }} />
            ))}
          </div>
        ) : activeTab === 'pending' ? (
          pendingItems.length > 0 ? (
            <div className="st-insights">
              {pendingItems.map((item) => (
                <article key={item.id} className="st-insight">
                  <div className="st-when">
                    <strong>{item.triggerCondition.time?.slice(0, 5) ?? '--:--'}</strong>
                    <small>{formatRepeatDays(item.triggerCondition.repeatDays || [])}</small>
                  </div>

                  <div className="st-insight-body">
                    <h4>
                      {actionText(item)}
                      {item.roomName && <span className="st-tag">{item.roomName}</span>}
                    </h4>
                    <p>{plainExplanation(item.explanation)}</p>
                    <div className="st-confidence" title={`${Math.round(item.confidence * 100)}%`}>
                      <span className="st-bar">
                        <i style={{ width: `${Math.round(item.confidence * 100)}%` }} />
                      </span>
                      <b>{confidenceLabel(item.confidence)}</b>
                    </div>
                  </div>

                  <div className="st-insight-actions">
                    <button
                      type="button"
                      className="st-icon-btn"
                      disabled={workingId !== null}
                      onClick={() => void resolve(item, 'dismiss')}
                      title="Để sau"
                      aria-label="Để sau"
                    >
                      <Icon name="clock" size={17} />
                    </button>
                    <button
                      type="button"
                      className="st-btn st-btn-sm"
                      disabled={workingId !== null}
                      onClick={() => void resolve(item, 'reject')}
                    >
                      Không cần
                    </button>
                    <button
                      type="button"
                      className="st-btn st-btn-sm st-btn-primary"
                      disabled={workingId !== null}
                      onClick={() => void resolve(item, 'approve')}
                    >
                      <Icon name="check" size={15} />
                      Tạo quy tắc
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="st-empty">
              <div className="st-empty-icon">
                <Icon name="sparkles" />
              </div>
              <h3>Chưa có gợi ý nào</h3>
              <p>Khi bạn làm một việc vào cùng một giờ nhiều ngày liền, HESTA sẽ gợi ý tự động hóa nó tại đây.</p>
              {!loading && (
                <button
                  type="button"
                  className="st-btn st-btn-primary"
                  disabled={workingId !== null}
                  onClick={() => void generate()}
                >
                  <Icon name="sparkles" size={16} />
                  Tìm thói quen ngay
                </button>
              )}
            </div>
          )
        ) : historyItems.length > 0 ? (
          <div className="st-list st-history">
            {historyItems.map((item) => {
              const accepted = item.status === 'ACCEPTED' || item.status === 'APPROVED';
              const rejected = item.status === 'REJECTED';
              return (
                <div key={item.id} className="st-rule">
                  <div className="st-rule-main">
                    <div className="st-rule-title">
                      <h4 title={actionText(item)}>{actionText(item)}</h4>
                      <span className={`st-tag ${rejected ? 'err' : ''}`}>
                        {accepted ? 'Đã tạo quy tắc' : rejected ? 'Không cần' : 'Để sau'}
                      </span>
                    </div>
                    <div className="st-flow">
                      <span>{plainExplanation(item.explanation)}</span>
                    </div>
                  </div>
                  <span className="st-rule-meta">
                    {new Date(item.resolvedAt ?? item.createdAt).toLocaleDateString('vi-VN')}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="st-empty">
            <h3>Chưa có phản hồi nào</h3>
            <p>Những gợi ý bạn đã tạo quy tắc, bỏ qua hoặc để sau sẽ hiện ở đây.</p>
          </div>
        )}
      </main>
      <DashboardBottomNav activeItem="more" homeId={homeId} />
    </div>
  );
}
