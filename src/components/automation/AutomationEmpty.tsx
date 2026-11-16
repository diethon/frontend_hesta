import React from 'react';
import { Icon } from '../ui/LucideIcon';

export interface AutomationEmptyProps {
  mode: 'empty' | 'search' | 'filter';
  onCreate?: () => void;
  onResetSearch?: () => void;
  onSelectTemplateName?: (name: string) => void;
}

const STARTERS = ['Bật đèn khi có chuyển động', 'Tắt điều hòa khi mở cổng', 'Bật đèn lúc 18:00'];

export const AutomationEmpty: React.FC<AutomationEmptyProps> = ({
  mode,
  onCreate,
  onResetSearch,
  onSelectTemplateName,
}) => {
  if (mode !== 'empty') {
    return (
      <div className="st-empty">
        <div className="st-empty-icon">
          <Icon name="search" />
        </div>
        <h3>{mode === 'search' ? 'Không tìm thấy quy tắc' : 'Chưa có quy tắc phù hợp'}</h3>
        <p>
          {mode === 'search'
            ? 'Thử từ khóa khác hoặc xóa bộ lọc tìm kiếm.'
            : 'Thử đổi bộ lọc trạng thái hoặc loại kích hoạt.'}
        </p>
        {onResetSearch && (
          <button type="button" className="st-btn" onClick={onResetSearch}>
            Xóa bộ lọc
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="st-empty">
      <div className="st-empty-icon">
        <Icon name="automation" />
      </div>
      <h3>Chưa có quy tắc nào</h3>
      <p>Quy tắc giúp ngôi nhà tự phản ứng với cảm biến, sự kiện hoặc giờ hẹn.</p>
      <div className="st-chips">
        {STARTERS.map((item) => (
          <button key={item} type="button" className="st-btn st-btn-sm" onClick={() => onSelectTemplateName?.(item)}>
            {item}
          </button>
        ))}
      </div>
      {onCreate && (
        <button type="button" className="st-btn st-btn-primary" onClick={onCreate}>
          <Icon name="plus" size={18} />
          Tạo quy tắc
        </button>
      )}
    </div>
  );
};
