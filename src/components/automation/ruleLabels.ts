// Vietnamese labels for rule codes, shared by the rule summary and the rule cards.

export const operatorLabels: Record<string, string> = {
  EQ: '=',
  NE: '≠',
  GT: '>',
  GTE: '≥',
  LT: '<',
  LTE: '≤',
};

export const attributeLabels: Record<string, string> = {
  temperature: 'nhiệt độ',
  humidity: 'độ ẩm',
  motion: 'chuyển động',
  light: 'ánh sáng',
  power: 'công suất',
  state: 'trạng thái',
  eventType: 'sự kiện',
};

export const EVENT_FRIENDLY_NAMES: Record<string, string> = {
  DEVICE_STATE_CHANGED: 'thiết bị thay đổi trạng thái',
  SECURITY_ALERT: 'có cảnh báo an ninh',
  SECURITY_EVENT: 'có sự kiện an ninh',
  GAS_LEAK_DETECTED: 'phát hiện rò rỉ khí gas',
  DOOR_OPENED: 'Cửa mở',
  GATE_OPENED: 'Cổng mở',
  MANUAL_OVERRIDE: 'điều khiển thủ công thiết bị',
  MOTION_DETECTED: 'phát hiện chuyển động',
  // Generic types sent by the MQTT receiver when a device reports without a named event.
  EVENT: 'thiết bị gửi sự kiện',
  SENSOR: 'cảm biến gửi dữ liệu',
};

export const actionLabels: Record<string, string> = {
  TURN_ON: 'Bật',
  TURN_OFF: 'Tắt',
  TOGGLE: 'Đảo trạng thái',
  OPEN: 'Mở',
  CLOSE: 'Đóng',
  STOP: 'Dừng',
  SET_BRIGHTNESS: 'Đặt độ sáng',
  SET_RGB: 'Đổi màu',
  SET_COLOR: 'Đổi màu',
  SET_TEMPERATURE: 'Cài nhiệt độ',
  SET_SPEED: 'Đặt tốc độ',
  SET_MODE: 'Đổi chế độ',
  SET_STATE: 'Cài đặt',
  EXECUTE_SCENE: 'Chạy kịch bản',
};

/** true/false read better as Có/Không in a sentence. */
export function formatExpected(value: unknown): string {
  if (value === true || value === 'true') return 'Có';
  if (value === false || value === 'false') return 'Không';
  return value === undefined || value === null || value === '' ? '…' : String(value);
}

const attributeUnits: Record<string, string> = { temperature: '°C', humidity: '%', light: ' lux', power: ' W' };

/** Comparison in words, e.g. "lớn hơn 30°C", so non-technical users never see "> 30". */
export function describeComparison(attribute: string | undefined, operator: string | undefined, expected: unknown): string {
  const value = `${formatExpected(expected)}${attributeUnits[attribute || ''] || ''}`;
  switch (operator) {
    case 'GT': return `lớn hơn ${value}`;
    case 'GTE': return `lớn hơn hoặc bằng ${value}`;
    case 'LT': return `nhỏ hơn ${value}`;
    case 'LTE': return `nhỏ hơn hoặc bằng ${value}`;
    case 'NE': return `khác ${value}`;
    default: return `bằng ${value}`;
  }
}

/** A whole sensor condition as a sentence fragment, e.g. "nhiệt độ ở Phòng khách lớn hơn 30°C". */
export function describeCondition(attribute: string | undefined, operator: string | undefined, expected: unknown, deviceName = 'cảm biến'): string {
  const yes = expected === true || expected === 'true';
  const no = expected === false || expected === 'false';
  if (attribute === 'motion' && (yes || no)) {
    const detected = operator === 'NE' ? !yes : yes;
    return detected ? `${deviceName} phát hiện có người` : `${deviceName} không còn thấy người`;
  }
  if (attribute === 'state' && (yes || no || expected === 'ON' || expected === 'OFF')) {
    const on = yes || expected === 'ON';
    return `${deviceName} ${(operator === 'NE' ? !on : on) ? 'đang bật' : 'đang tắt'}`;
  }
  const label = attributeLabels[attribute || ''] || attribute || 'giá trị';
  return `${label} ở ${deviceName} ${describeComparison(attribute, operator, expected)}`;
}

/** Event name for a title position: friendly Vietnamese text, first letter capitalised. */
export function eventLabel(code: string): string {
  const text = EVENT_FRIENDLY_NAMES[code] || code;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
