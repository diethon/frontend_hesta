import { FlipHorizontal2, FlipVertical2, Grid3X3, ImagePlus, Info, Magnet, PencilRuler, RotateCcw, RotateCw, Ruler, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import type { TwinLayoutSelection } from '../../types/twinLayout';
import {
  blueprintKey,
  changeRoomShape,
  polygonCss,
  roomShapePoints,
  transformRoomDrafting,
  type TwinBlueprintUnderlay,
  type TwinDraftingMetadata,
  type TwinRoomShape,
} from './twinDrafting';

export type TwinDraftingMode = 'quick' | 'precise';

const shapes: { value: TwinRoomShape; label: string; shortLabel: string }[] = [
  { value: 'RECTANGLE', label: 'Phòng chữ nhật', shortLabel: 'Chữ nhật' },
  { value: 'L_SHAPE', label: 'Phòng chữ L', shortLabel: 'Chữ L' },
  { value: 'U_SHAPE', label: 'Phòng chữ U', shortLabel: 'Chữ U' },
  { value: 'CUSTOM', label: 'Hình tùy chỉnh', shortLabel: 'Tự vẽ' },
];

function ShapePreview({ shape }: { shape: TwinRoomShape }) {
  return <span aria-hidden="true" className="relative h-8 w-10 shrink-0">
    <span className="absolute inset-0 bg-primary" style={{ clipPath: polygonCss(roomShapePoints(shape)) }} />
  </span>;
}

export function TwinDraftingToolbar({ metadata, selection, floor, disabled, mode, onModeChange, onChange }: {
  metadata: TwinDraftingMetadata;
  selection: TwinLayoutSelection | null;
  floor: number;
  disabled: boolean;
  mode: TwinDraftingMode;
  onModeChange: (mode: TwinDraftingMode) => void;
  onChange: (metadata: TwinDraftingMetadata) => void;
}) {
  const uploadId = useId();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const selectedRoomId = selection?.kind === 'room' ? selection.id : null;
  const roomShape = selectedRoomId ? metadata.rooms[selectedRoomId]?.shape ?? 'RECTANGLE' : null;
  const key = blueprintKey(floor);
  const blueprint = metadata.blueprints[key];

  const setBlueprint = (next: TwinBlueprintUnderlay | null) => {
    const blueprints = { ...metadata.blueprints };
    if (next) blueprints[key] = next;
    else delete blueprints[key];
    onChange({ ...metadata, blueprints });
  };

  const chooseBlueprint = (file?: File) => {
    setUploadError(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadError('Chỉ chấp nhận tệp ảnh mặt bằng.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError('Ảnh cần nhỏ hơn 2 MB để lưu an toàn trên trình duyệt này.');
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => setUploadError('Không thể đọc ảnh đã chọn.');
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      setBlueprint({ name: file.name, dataUrl: reader.result, opacity: 0.3 });
    };
    reader.readAsDataURL(file);
  };

  return <section aria-label="Công cụ dựng mặt bằng" className="surface-card space-y-4 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="font-semibold text-text">Dựng mặt bằng</h2>
        <p className="mt-1 text-xs text-muted">Vẽ trước, tinh chỉnh số đo khi cần.</p>
      </div>
      <div className="flex rounded-xl border border-line bg-app p-1" aria-label="Phương thức thiết kế">
        <button type="button" aria-pressed={mode === 'quick'} onClick={() => onModeChange('quick')} className={`flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-semibold ${mode === 'quick' ? 'bg-surface text-primary-hover shadow-soft' : 'text-muted'}`}><PencilRuler size={16} aria-hidden="true" />Vẽ nhanh</button>
        <button type="button" aria-pressed={mode === 'precise'} onClick={() => onModeChange('precise')} className={`flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-semibold ${mode === 'precise' ? 'bg-surface text-primary-hover shadow-soft' : 'text-muted'}`}><Ruler size={16} aria-hidden="true" />Nhập kích thước</button>
      </div>
    </div>

    <div>
      <p className="mb-2 text-xs font-semibold text-text">Hình phòng đang chọn</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {shapes.map((shape) => <button key={shape.value} type="button" aria-label={shape.label} aria-pressed={roomShape === shape.value} disabled={disabled || !selectedRoomId} onClick={() => selectedRoomId && onChange(changeRoomShape(metadata, selectedRoomId, shape.value))} className={`flex min-h-14 items-center gap-2 rounded-xl border px-3 text-left text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-45 ${roomShape === shape.value ? 'border-primary bg-info-soft text-primary-hover' : 'border-line bg-surface text-text hover:bg-sidebar-hover'}`}>
          <ShapePreview shape={shape.value} /><span>{shape.shortLabel}</span>
        </button>)}
      </div>
      {!selectedRoomId ? <p className="mt-2 text-xs text-muted">Chọn một phòng trên sơ đồ để đổi hình và kéo từng đỉnh.</p> : null}
      {selectedRoomId && roomShape !== 'RECTANGLE' ? <div className="mt-3 rounded-xl border border-line bg-app p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><p className="text-xs font-semibold text-text">Đổi hướng phòng</p><p className="mt-1 text-xs text-muted">Xoay hoặc lật toàn bộ hình mà không phải kéo lại từng góc.</p></div>
          <div className="grid grid-cols-4 gap-1" aria-label="Xoay và lật hình phòng">
            <button type="button" aria-label="Xoay phòng sang trái 90 độ" title="Xoay trái 90°" disabled={disabled} onClick={() => onChange(transformRoomDrafting(metadata, selectedRoomId, 'ROTATE_LEFT'))} className="flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-surface text-text hover:bg-sidebar-hover disabled:opacity-45"><RotateCcw size={18} aria-hidden="true" /></button>
            <button type="button" aria-label="Xoay phòng sang phải 90 độ" title="Xoay phải 90°" disabled={disabled} onClick={() => onChange(transformRoomDrafting(metadata, selectedRoomId, 'ROTATE_RIGHT'))} className="flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-surface text-text hover:bg-sidebar-hover disabled:opacity-45"><RotateCw size={18} aria-hidden="true" /></button>
            <button type="button" aria-label="Lật phòng theo chiều ngang" title="Lật ngang" disabled={disabled} onClick={() => onChange(transformRoomDrafting(metadata, selectedRoomId, 'FLIP_HORIZONTAL'))} className="flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-surface text-text hover:bg-sidebar-hover disabled:opacity-45"><FlipHorizontal2 size={18} aria-hidden="true" /></button>
            <button type="button" aria-label="Lật phòng theo chiều dọc" title="Lật dọc" disabled={disabled} onClick={() => onChange(transformRoomDrafting(metadata, selectedRoomId, 'FLIP_VERTICAL'))} className="flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-surface text-text hover:bg-sidebar-hover disabled:opacity-45"><FlipVertical2 size={18} aria-hidden="true" /></button>
          </div>
        </div>
      </div> : null}
    </div>

    <div className="grid gap-2 sm:grid-cols-2">
      <button type="button" aria-pressed={metadata.settings.gridSnap} disabled={disabled} onClick={() => onChange({ ...metadata, settings: { ...metadata.settings, gridSnap: !metadata.settings.gridSnap } })} className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 text-left text-sm font-semibold ${metadata.settings.gridSnap ? 'border-primary bg-info-soft text-primary-hover' : 'border-line bg-surface text-muted'}`}><Grid3X3 size={18} aria-hidden="true" /><span>Bắt lưới<small className="block font-normal text-muted">Bước 2,5% mặt bằng</small></span></button>
      <button type="button" aria-pressed={metadata.settings.edgeSnap} disabled={disabled} onClick={() => onChange({ ...metadata, settings: { ...metadata.settings, edgeSnap: !metadata.settings.edgeSnap } })} className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 text-left text-sm font-semibold ${metadata.settings.edgeSnap ? 'border-primary bg-info-soft text-primary-hover' : 'border-line bg-surface text-muted'}`}><Magnet size={18} aria-hidden="true" /><span>Bắt cạnh<small className="block font-normal text-muted">Căn theo tường phòng gần nhất</small></span></button>
    </div>

    <div className="rounded-xl border border-line bg-app p-3">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-info-soft text-primary-hover"><ImagePlus size={19} aria-hidden="true" /></span>
        <div><p className="text-sm font-semibold text-text">Dùng ảnh bản vẽ làm nền <span className="font-normal text-muted">(không bắt buộc)</span></p><p className="mt-1 text-xs leading-5 text-muted">Ảnh sẽ nằm mờ phía dưới sơ đồ tầng {floor}. Bạn kéo các phòng trùng theo đường tường trong ảnh — hệ thống không tự nhận diện hay tự tạo phòng.</p></div>
      </div>

      <ol className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-3">
        <li className="rounded-lg bg-surface px-3 py-2"><strong className="block text-text">1. Chọn ảnh</strong>JPG, PNG hoặc WebP dưới 2 MB.</li>
        <li className="rounded-lg bg-surface px-3 py-2"><strong className="block text-text">2. Chỉnh độ mờ</strong>Để nhìn thấy cả ảnh và phòng.</li>
        <li className="rounded-lg bg-surface px-3 py-2"><strong className="block text-text">3. Vẽ đè</strong>Kéo phòng và các điểm góc theo ảnh.</li>
      </ol>

      <input id={uploadId} type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled} onChange={(event) => { chooseBlueprint(event.currentTarget.files?.[0]); event.currentTarget.value = ''; }} className="sr-only" />
      {blueprint ? <div className="mt-3 rounded-xl border border-line bg-surface p-3">
        <div className="flex items-center gap-3">
          <img src={blueprint.dataUrl} alt="Xem trước ảnh mặt bằng" className="h-14 w-20 shrink-0 rounded-lg border border-line object-cover" />
          <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-text">{blueprint.name}</p><p className="mt-1 text-xs text-success">Đang hiển thị dưới sơ đồ tầng {floor}</p></div>
          <label htmlFor={uploadId} className={`flex min-h-11 cursor-pointer items-center rounded-xl border border-line px-3 text-xs font-semibold text-text hover:bg-sidebar-hover ${disabled ? 'pointer-events-none opacity-45' : ''}`}>Đổi ảnh</label>
          <button type="button" aria-label="Xóa ảnh mặt bằng" disabled={disabled} onClick={() => setBlueprint(null)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line text-error hover:bg-error-soft"><Trash2 size={17} aria-hidden="true" /></button>
        </div>
        <label className="mt-3 block text-xs font-medium text-text">Độ rõ của ảnh nền: {Math.round(blueprint.opacity * 100)}%
          <input type="range" min={0.1} max={0.8} step={0.05} value={blueprint.opacity} disabled={disabled} onChange={(event) => setBlueprint({ ...blueprint, opacity: event.currentTarget.valueAsNumber })} className="mt-2 w-full accent-primary" />
        </label>
      </div> : <label htmlFor={uploadId} className={`mt-3 flex min-h-16 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-primary bg-info-soft px-4 text-sm font-semibold text-primary-hover hover:bg-sidebar-hover ${disabled ? 'pointer-events-none opacity-45' : ''}`}><ImagePlus size={18} aria-hidden="true" />Chọn ảnh bản vẽ từ máy</label>}
      {uploadError ? <p role="alert" className="mt-2 text-xs font-medium text-error">{uploadError}</p> : null}
      <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted"><Info size={15} className="mt-0.5 shrink-0" aria-hidden="true" />Ảnh chỉ là lớp tham chiếu trên trình duyệt này, không được tải lên Backend và không xuất hiện trên thiết bị khác.</p>
    </div>
  </section>;
}
