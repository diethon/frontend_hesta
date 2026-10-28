import React from 'react';

export interface AutomationEmptyProps {
  mode: 'empty' | 'search' | 'filter';
  onCreate?: () => void;
  onResetSearch?: () => void;
  onSelectTemplateName?: (name: string) => void;
}

export const AutomationEmpty: React.FC<AutomationEmptyProps> = ({
  mode,
  onCreate,
  onResetSearch,
  onSelectTemplateName,
}) => {
  if (mode === 'search') {
    return (
      <div className="scenes-empty">
        <strong>Không tìm thấy quy tắc</strong>
        <p>Thử từ khóa khác hoặc xóa bộ lọc tìm kiếm.</p>
        {onResetSearch && (
          <button
            type="button"
            className="px-4 py-2 rounded-full border border-[var(--border)] bg-[var(--g1)] text-xs font-semibold text-[var(--secondary)] hover:text-[var(--text)] transition-colors cursor-pointer mt-2"
            onClick={onResetSearch}
          >
            Xóa tìm kiếm
          </button>
        )}
      </div>
    );
  }

  if (mode === 'filter') {
    return (
      <div className="scenes-empty">
        <strong>Chưa có quy tắc phù hợp</strong>
        <p>Thử đổi bộ lọc trạng thái (Đang bật / Đang tắt) hoặc loại kích hoạt.</p>
      </div>
    );
  }

  return (
    <div className="scenes-empty">
      <strong>Chưa có quy tắc nào</strong>
      <p>Quy tắc giúp nhà tự phản ứng với cảm biến, sự kiện hoặc giờ hẹn</p>
      <div>
        {[
          'Bật đèn khi có chuyển động',
          'Tắt điều hòa khi mở cổng',
          'Bật đèn lúc 18:00',
        ].map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onSelectTemplateName?.(item)}
          >
            {item}
          </button>
        ))}
      </div>
      {onCreate && (
        <button type="button" className="add-device mt-2 cursor-pointer" onClick={onCreate}>
          + Tạo quy tắc
        </button>
      )}
    </div>
  );
};

