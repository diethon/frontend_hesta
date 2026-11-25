import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  HelpCircle,
  Plus,
  Save,
  Wrench,
} from 'lucide-react';
import type {
  ContractDetail,
  SurveyChecklistItem,
  SurveyFlags,
} from '../../types/contract';
import {
  BUILDING_CONDITION_LABELS,
  CONTRACT_STATUS_META,
  formatDateTime,
  HOME_TYPE_LABELS,
  TIMELINE_LABELS,
} from './contractFormat';

interface SurveyProfileCardProps {
  contract: ContractDetail;
  mode: 'admin' | 'customer';
  locked?: boolean;
  submitting?: boolean;
  onSaveSurvey?: (payload: {
    surveyChecklist: SurveyChecklistItem[];
    surveyFlags: SurveyFlags;
    surveyNotes: string;
  }) => void;
  onPromoteToQuotation?: () => void;
}

const FLAG_DEFS: { key: keyof SurveyFlags; label: string }[] = [
  { key: 'quantityConfirmed', label: 'Đã xác nhận số lượng' },
  { key: 'locationConfirmed', label: 'Đã xác nhận vị trí lắp' },
  { key: 'compatibilityConfirmed', label: 'Đã kiểm tra tương thích hạ tầng' },
  { key: 'quoteReady', label: 'Sẵn sàng lập báo giá & hợp đồng' },
];

export const SurveyProfileCard: React.FC<SurveyProfileCardProps> = ({
  contract,
  mode,
  locked = false,
  submitting = false,
  onSaveSurvey,
  onPromoteToQuotation,
}) => {
  const [checklist, setChecklist] = useState<SurveyChecklistItem[]>(contract.surveyChecklist ?? []);
  const [flags, setFlags] = useState<SurveyFlags>(contract.surveyFlags ?? {});
  const [notes, setNotes] = useState<string>(contract.surveyNotes ?? '');
  const [newCheckLabel, setNewCheckLabel] = useState('');

  const canEdit = mode === 'admin' && !locked;

  const toggleChecklist = (id: string) => {
    if (!canEdit) return;
    setChecklist((prev) => prev.map((item) => (item.id === id ? { ...item, confirmed: !item.confirmed } : item)));
  };

  const handleAddChecklist = () => {
    if (!canEdit || !newCheckLabel.trim()) return;
    setChecklist((prev) => [
      ...prev,
      {
        id: `chk-${Date.now()}`,
        label: newCheckLabel.trim(),
        category: 'CUSTOM',
        confirmed: false,
      },
    ]);
    setNewCheckLabel('');
  };

  const toggleFlag = (key: keyof SurveyFlags) => {
    if (!canEdit) return;
    setFlags((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const meta = CONTRACT_STATUS_META[contract.status];
  const needs = contract.requestedDevices ?? [];
  const confirmedCount = checklist.filter((c) => c.confirmed).length;

  return (
    <div className="rounded-3xl border border-line bg-surface/95 p-5 sm:p-6 space-y-6">
      {/* Header: Hồ sơ công trình */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line/60 pb-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-primary-hover flex items-center gap-1.5">
            <ClipboardList className="w-3.5 h-3.5" />
            Hồ sơ khảo sát &amp; tư vấn nhu cầu
          </p>
          <h2 className="text-lg font-extrabold text-text mt-1">
            {contract.customerName} · <span className="font-mono text-primary-hover">{contract.code}</span>
          </h2>
          <p className="text-xs text-muted mt-0.5">
            {contract.customerPhone} · {contract.customerEmail} · {contract.installAddress}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${meta.badgeClass}`}>
          {meta.label}
        </span>
      </div>

      {/* Project Specs Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
        {[
          { label: 'Công trình', value: contract.homeName || 'Nhà HESTA' },
          { label: 'Loại hình', value: HOME_TYPE_LABELS[contract.homeType] || contract.homeType },
          { label: 'Số tầng', value: `${contract.floorCount ?? 1} tầng` },
          { label: 'Số phòng / khu vực', value: `${contract.bedroomCount ?? 2} phòng/khu vực` },
          {
            label: 'Tình trạng',
            value:
              BUILDING_CONDITION_LABELS[contract.buildingCondition || 'OCCUPIED'] ||
              contract.buildingCondition ||
              'Nhà đang ở',
          },
          {
            label: 'Tiến độ mong muốn',
            value:
              TIMELINE_LABELS[contract.desiredTimeline || 'WITHIN_1_MONTH'] ||
              contract.desiredTimeline ||
              'Trong 1 tháng tới',
          },
        ].map((spec) => (
          <div key={spec.label} className="rounded-2xl border border-line bg-sidebar/30 p-3">
            <p className="text-[11px] text-muted">{spec.label}</p>
            <p className="font-bold text-text mt-0.5 truncate" title={spec.value}>
              {spec.value}
            </p>
          </div>
        ))}
      </div>

      {/* Structured Table: Danh sách thiết bị quan tâm */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-text">
            Danh sách thiết bị khách hàng quan tâm ({needs.length} nhóm)
          </h3>
          <span className="text-[11px] text-muted italic">
            * Số lượng mang tính dự kiến ban đầu — cần khảo sát thực tế trước khi đưa vào báo giá chính thức
          </span>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-sidebar/60 text-muted border-b border-line">
                <th className="py-2.5 px-3 font-bold">Nhóm thiết bị</th>
                <th className="py-2.5 px-3 font-bold">Vị trí dự kiến</th>
                <th className="py-2.5 px-3 font-bold">Số lượng dự kiến</th>
                <th className="py-2.5 px-3 font-bold">Mục đích sử dụng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {needs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-5 px-3 text-center text-muted italic">
                    Khách hàng chưa chọn nhóm thiết bị cụ thể — cần liên hệ tư vấn trực tiếp.
                  </td>
                </tr>
              ) : (
                needs.map((n, idx) => {
                  const isUnknown =
                    n.needsConsultation ||
                    (n.estimatedQuantity || '').toLowerCase().includes('chưa');
                  return (
                    <tr key={`${n.category}-${idx}`} className="hover:bg-sidebar/20">
                      <td className="py-2.5 px-3 font-bold text-text">{n.label}</td>
                      <td className="py-2.5 px-3 text-text/90">
                        {n.locations && n.locations.length > 0 ? n.locations.join(', ') : 'Chưa xác định'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                            isUnknown
                              ? 'bg-[#fef3c7] text-[#92400e] border-[#f59e0b]'
                              : 'bg-[#e0f2fe] text-[#0369a1] border-[#38bdf8]'
                          }`}
                        >
                          {isUnknown && <HelpCircle className="w-3 h-3" />}
                          {n.estimatedQuantity || 'Chưa rõ – Cần tư vấn'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-muted">
                        {n.purposes && n.purposes.length > 0 ? n.purposes.join(' · ') : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Free-text Expectation */}
      {contract.customerNote && (
        <div className="rounded-2xl border border-line bg-sidebar/25 p-4 space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Nhu cầu tổng quát của khách hàng</p>
          <p className="text-xs sm:text-sm text-text leading-relaxed">{contract.customerNote}</p>
        </div>
      )}

      {/* Checklist: Thông tin cần xác nhận & Trạng thái khảo sát */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-line bg-sidebar/20 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-text">
              Thông tin cần xác nhận ({confirmedCount}/{checklist.length})
            </h3>
            {contract.surveyCompletedAt && (
              <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">
                ✓ Khảo sát xong {formatDateTime(contract.surveyCompletedAt)}
              </span>
            )}
          </div>

          <ul className="space-y-2">
            {checklist.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => toggleChecklist(item.id)}
                  className={`w-full text-left flex items-start gap-2.5 rounded-xl border p-2.5 text-xs transition-colors ${
                    item.confirmed
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-text'
                      : 'border-[#f59e0b] bg-[#fffbeb] text-[#0f172a]'
                  } ${canEdit ? 'cursor-pointer hover:border-primary' : 'cursor-default'}`}
                >
                  <span
                    className={`mt-0.5 shrink-0 px-2 py-0.5 rounded text-[10px] font-bold ${
                      item.confirmed
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[#fef3c7] text-[#92400e] border border-[#f59e0b]'
                    }`}
                  >
                    {item.confirmed ? 'Đã xác nhận' : 'Chưa xác nhận'}
                  </span>
                  <span className="leading-snug">{item.label}</span>
                </button>
              </li>
            ))}
          </ul>

          {canEdit && (
            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={newCheckLabel}
                onChange={(e) => setNewCheckLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddChecklist();
                  }
                }}
                placeholder="Thêm mục cần xác nhận khi khảo sát..."
                className="flex-1 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs text-text focus:border-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddChecklist}
                className="px-3 py-1.5 rounded-xl border border-line bg-surface hover:bg-sidebar text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Thêm
              </button>
            </div>
          )}
        </div>

        {/* Trạng thái phương án & Ghi chú kỹ thuật */}
        <div className="rounded-2xl border border-line bg-sidebar/20 p-4 space-y-3 flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-text flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-primary" />
              Trạng thái khảo sát &amp; Ghi chú kỹ thuật
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {FLAG_DEFS.map((f) => {
                const checked = Boolean(flags[f.key]);
                return (
                  <button
                    key={f.key}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => toggleFlag(f.key)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                      checked
                        ? 'border-emerald-500/40 bg-emerald-500/12 text-emerald-800 dark:text-emerald-300'
                        : 'border-line bg-surface/70 text-muted'
                    } ${canEdit ? 'cursor-pointer hover:border-primary' : 'cursor-default'}`}
                  >
                    <CheckCircle2 className={`w-4 h-4 shrink-0 ${checked ? 'text-emerald-600' : 'text-muted/40'}`} />
                    <span className="truncate">{f.label}</span>
                  </button>
                );
              })}
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1">
                Ghi chú kỹ thuật khảo sát
              </label>
              {canEdit ? (
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="VD: Đã khảo sát nhà 3 tầng đang hoàn thiện: có đủ dây nguội N, cần 2 Camera Vision Pro (phòng khách + sân trước), 6 công tắc thông minh, kéo thêm nguồn 220V ra cổng..."
                  className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs text-text focus:border-primary focus:outline-none"
                />
              ) : (
                <div className="rounded-xl border border-line bg-surface/70 p-3 text-xs text-text min-h-[72px] whitespace-pre-line">
                  {contract.surveyNotes || 'Kỹ thuật viên HESTA sẽ cập nhật ghi chú khảo sát thực tế tại đây.'}
                </div>
              )}
            </div>
          </div>

          {canEdit && (
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-line/60">
              <button
                type="button"
                disabled={submitting}
                onClick={() =>
                  onSaveSurvey?.({
                    surveyChecklist: checklist,
                    surveyFlags: flags,
                    surveyNotes: notes,
                  })
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-line bg-surface text-xs font-bold text-text hover:bg-surface-hover cursor-pointer disabled:opacity-60"
              >
                <Save className="w-3.5 h-3.5 text-primary" />
                {submitting ? 'Đang lưu...' : 'Lưu kết quả khảo sát'}
              </button>
              <button
                type="button"
                onClick={onPromoteToQuotation}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover shadow-xs cursor-pointer"
              >
                Lập phương án &amp; Báo giá
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
