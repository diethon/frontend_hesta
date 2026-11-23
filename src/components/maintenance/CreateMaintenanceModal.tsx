import { useEffect, useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { getDevicesByHome } from '../../services/deviceApi';
import { createMaintenanceTicket } from '../../services/maintenanceApi';
import type { DeviceResponse } from '../../types/device';
import type { MaintenancePriority, MaintenanceTicket } from '../../types/maintenance';
import { getErrorMessage } from '../../utils/errors';
import { notify } from '../ui/notify';
import { MaintenanceModal, btnGhost, btnPrimary, fieldClass, labelClass } from './MaintenanceModal';
import { SlotEditor } from './SlotEditor';
import { PRIORITY_META, draftToSlot, newSlotDraft, slotProblem, type SlotDraft } from './maintenanceFormat';

interface CreateMaintenanceModalProps {
  homeId: string;
  initialDeviceId?: string;
  initialAnomalyId?: string;
  initialNote?: string;
  onClose: () => void;
  onCreated: (ticket: MaintenanceTicket) => void;
}

interface Selected { note: string; anomalyId?: string }

const MAX_DEVICES = 10;

export function CreateMaintenanceModal({ homeId, initialDeviceId, initialAnomalyId, initialNote, onClose, onCreated }: CreateMaintenanceModalProps) {
  const [devices, setDevices] = useState<DeviceResponse[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Record<string, Selected>>(
    initialDeviceId ? { [initialDeviceId]: { note: initialNote ?? '', anomalyId: initialAnomalyId } } : {},
  );
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<MaintenancePriority>('NORMAL');
  const [contactPhone, setContactPhone] = useState('');
  const [slots, setSlots] = useState<SlotDraft[]>([newSlotDraft(1)]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    getDevicesByHome(homeId)
      .then((list) => { if (active) setDevices(list.filter((d) => d.status !== 'UNCLAIMED')); })
      .catch((error: unknown) => notify.error(getErrorMessage(error, 'Không tải được danh sách thiết bị.')))
      .finally(() => { if (active) setLoadingDevices(false); });
    return () => { active = false; };
  }, [homeId]);

  // Pre-fill the title from the first chosen device so the common one-device case needs no typing.
  const selectedIds = Object.keys(selected);
  const firstSelected = devices.find((d) => d.id === selectedIds[0]);
  const effectiveTitle = title || (firstSelected ? `Kiểm tra ${firstSelected.name}${selectedIds.length > 1 ? ` và ${selectedIds.length - 1} thiết bị khác` : ''}` : '');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return devices.filter((d) => !needle
      || `${d.name} ${d.deviceType} ${d.roomName ?? ''} ${d.model ?? ''} ${d.serialNumber ?? ''}`.toLowerCase().includes(needle));
  }, [devices, query]);

  const toggle = (id: string) => setSelected((current) => {
    if (current[id]) {
      const next = { ...current };
      delete next[id];
      return next;
    }
    if (Object.keys(current).length >= MAX_DEVICES) {
      notify.info(`Mỗi yêu cầu tối đa ${MAX_DEVICES} thiết bị.`);
      return current;
    }
    return { ...current, [id]: { note: '' } };
  });

  const problem = selectedIds.length === 0 ? 'Chọn ít nhất 1 thiết bị cần kiểm tra.'
    : !effectiveTitle.trim() ? 'Nhập tiêu đề yêu cầu.'
      : slotProblem(slots);

  const submit = async () => {
    if (problem) { notify.error(problem); return; }
    setSubmitting(true);
    try {
      const ticket = await createMaintenanceTicket(homeId, {
        title: effectiveTitle.trim(),
        description: description.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        priority,
        devices: selectedIds.map((deviceId) => ({
          deviceId,
          issueNote: selected[deviceId].note.trim() || undefined,
          anomalyId: selected[deviceId].anomalyId,
        })),
        slots: slots.map(draftToSlot),
      });
      notify.success(`Đã gửi yêu cầu ${ticket.code}`);
      onCreated(ticket);
    } catch (error) {
      notify.error(getErrorMessage(error, 'Không gửi được yêu cầu bảo trì.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MaintenanceModal wide title="Báo hỏng / yêu cầu kiểm tra" subtitle="Chọn thiết bị gặp sự cố và các khung giờ bạn có thể tiếp kỹ thuật viên."
      onClose={onClose}
      footer={<>
        <button type="button" className={btnGhost} onClick={onClose}>Huỷ</button>
        <button type="button" className={btnPrimary} disabled={submitting || !!problem} onClick={() => void submit()}>
          {submitting ? 'Đang gửi…' : 'Gửi yêu cầu'}
        </button>
      </>}>

      <section className="space-y-2">
        <p className={labelClass}>Thiết bị cần kiểm tra <span className="text-muted font-normal">({selectedIds.length}/{MAX_DEVICES})</span></p>
        <label className="relative block">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input className={`${fieldClass} pl-9`} value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên, phòng, loại, model, serial…" aria-label="Tìm thiết bị" />
        </label>
        <ul className="max-h-56 overflow-y-auto rounded-2xl border border-line divide-y divide-line/60">
          {loadingDevices && <li className="p-3 text-sm text-muted">Đang tải thiết bị…</li>}
          {!loadingDevices && filtered.length === 0 && <li className="p-3 text-sm text-muted">Không tìm thấy thiết bị phù hợp.</li>}
          {filtered.map((device) => {
            const isSelected = !!selected[device.id];
            return (
              <li key={device.id}>
                <button type="button" aria-pressed={isSelected} onClick={() => toggle(device.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-hover ${isSelected ? 'bg-primary/5' : ''}`}>
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${isSelected ? 'bg-primary border-primary text-white' : 'border-line'}`}>
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold truncate">{device.name}</span>
                    <span className="block text-xs text-muted truncate">
                      {[device.roomName, device.deviceType, device.model].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {device.status !== 'ONLINE' && (
                    <span className="text-[11px] font-semibold rounded-full px-2 py-0.5 bg-rose-500/10 text-rose-600">{device.status === 'OFFLINE' ? 'Mất kết nối' : 'Lỗi'}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        {selectedIds.map((id) => {
          const device = devices.find((d) => d.id === id);
          return (
            <label key={id} className="block">
              <span className="text-xs text-muted">Mô tả lỗi của <strong className="text-text">{device?.name ?? 'thiết bị'}</strong></span>
              <input className={fieldClass} maxLength={1000} value={selected[id].note} placeholder="VD: bật không lên, kêu to, mất kết nối…"
                onChange={(e) => setSelected((current) => ({ ...current, [id]: { ...current[id], note: e.target.value } }))} />
            </label>
          );
        })}
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className={labelClass}>Tiêu đề</span>
          <input className={fieldClass} maxLength={150} value={title} placeholder={effectiveTitle || 'VD: Đèn phòng khách không sáng'}
            onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="sm:col-span-2">
          <span className={labelClass}>Mô tả thêm</span>
          <textarea className={`${fieldClass} min-h-[72px]`} maxLength={2000} value={description}
            onChange={(e) => setDescription(e.target.value)} placeholder="Tình trạng, thời điểm xảy ra, lưu ý khi đến nhà…" />
        </label>
        <label>
          <span className={labelClass}>Mức độ ưu tiên</span>
          <select className={fieldClass} value={priority} onChange={(e) => setPriority(e.target.value as MaintenancePriority)}>
            {Object.entries(PRIORITY_META).map(([id, meta]) => <option key={id} value={id}>{meta.label}</option>)}
          </select>
        </label>
        <label>
          <span className={labelClass}>Số điện thoại liên hệ</span>
          <input className={fieldClass} type="tel" maxLength={20} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)}
            placeholder="Mặc định dùng số trong hồ sơ" />
        </label>
      </section>

      <SlotEditor value={slots} onChange={setSlots} />
    </MaintenanceModal>
  );
}
