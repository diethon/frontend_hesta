import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { generateRecommendations, getRecommendations, resolveRecommendation } from '../../services/recommendationApi';
import type { Recommendation } from '../../types/recommendation';

export function RecommendationsPage() {
  const { homeId = '' } = useParams();
  const [items, setItems] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let active = true;
    getRecommendations(homeId)
      .then((result) => { if (active) setItems(result); })
      .catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : 'Không thể tải đề xuất.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [homeId]);

  const refresh = async () => setItems(await getRecommendations(homeId));

  const generate = async () => {
    setWorkingId('generate'); setError(''); setSuccess('');
    try {
      const to = new Date();
      const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
      const created = await generateRecommendations(homeId, from.toISOString(), to.toISOString());
      await refresh();
      setSuccess(created.length ? `Đã tạo ${created.length} đề xuất mới.` : 'Chưa tìm thấy mẫu hành vi mới đủ tin cậy.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Không thể phân tích hành vi.'); }
    finally { setWorkingId(null); }
  };

  const resolve = async (item: Recommendation, action: 'approve' | 'reject') => {
    if (action === 'approve' && !window.confirm('Chấp nhận đề xuất và bật quy tắc tự động theo lịch này?')) return;
    setWorkingId(item.id); setError(''); setSuccess('');
    try {
      await resolveRecommendation(homeId, item.id, action);
      await refresh();
      setSuccess(action === 'approve' ? 'Đã tạo quy tắc tự động từ đề xuất.' : 'Đã từ chối đề xuất.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Không thể xử lý đề xuất.'); }
    finally { setWorkingId(null); }
  };

  return <main className="app-shell min-h-screen p-4 text-text sm:p-6"><div className="mx-auto max-w-5xl space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">Gợi ý tự động hóa</h1><p className="text-sm text-muted">Phân tích hành vi 30 ngày gần đây để đề xuất lịch chạy.</p></div><Link to={`/homes/${homeId}/automation-rules`} className="rounded-xl bg-sidebar px-4 py-3 text-sm font-semibold text-text">Về quy tắc</Link></header>
    {error && <p role="alert" className="rounded-xl bg-error-soft p-3">{error}</p>}
    {success && <p role="status" className="rounded-xl bg-success-soft p-3">{success}</p>}
    <button type="button" disabled={workingId !== null} onClick={() => void generate()} className="rounded-xl bg-primary px-4 py-3 font-semibold text-white disabled:opacity-50">{workingId === 'generate' ? 'Đang phân tích...' : 'Phân tích hành vi'}</button>
    {loading ? <p>Đang tải đề xuất...</p> : items.length ? <div className="grid gap-4 md:grid-cols-2">{items.map((item) => <article key={item.id} className="surface-card space-y-3 p-5">
      <div className="flex items-start justify-between gap-2"><h2 className="font-semibold">{item.deviceName ?? 'Thiết bị'} · {item.proposedAction.action}</h2><span className="rounded-full bg-info-soft px-3 py-1 text-xs">{item.status === 'PENDING' ? 'Chờ xử lý' : item.status === 'APPROVED' ? 'Đã chấp nhận' : 'Đã từ chối'}</span></div>
      <p className="text-sm text-muted">{item.explanation}</p>
      <dl className="grid grid-cols-2 gap-2 text-sm"><div><dt className="text-muted">Kích hoạt</dt><dd>Hằng ngày lúc {item.triggerCondition.time.slice(0, 5)}</dd></div><div><dt className="text-muted">Độ tin cậy</dt><dd>{Math.round(item.confidence * 100)}%</dd></div><div><dt className="text-muted">Điều kiện</dt><dd>Theo lịch</dd></div><div><dt className="text-muted">Hành động</dt><dd>{item.proposedAction.action}</dd></div></dl>
      <p className="text-xs text-muted">Tạo: {new Date(item.createdAt).toLocaleString('vi-VN')}{item.resolvedAt ? ` · Xử lý: ${new Date(item.resolvedAt).toLocaleString('vi-VN')}` : ''}</p>
      {item.status === 'PENDING' && <div className="flex gap-2"><button type="button" disabled={workingId !== null} onClick={() => void resolve(item, 'approve')} className="rounded-xl bg-primary px-4 py-2 font-semibold text-white disabled:opacity-50">Chấp nhận</button><button type="button" disabled={workingId !== null} onClick={() => void resolve(item, 'reject')} className="rounded-xl bg-error-soft px-4 py-2 disabled:opacity-50">Từ chối</button></div>}
    </article>)}</div> : <p className="surface-card p-5 text-muted">Chưa có đề xuất. Chọn “Phân tích hành vi” để tìm mẫu lặp lại.</p>}
  </div></main>;
}
