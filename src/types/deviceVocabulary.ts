// ---------------------------------------------------------
// TỪ ĐIỂN ĐỒNG BỘ GIAO TIẾP (FRONTEND <-> IOT FIRMWARE)
// ---------------------------------------------------------

export type DeviceCapability = 
  | 'POWER'            // Bật/Tắt (Đèn, Ổ cắm)
  | 'COLOR'            // Đổi màu (LED RGB)
  | 'BRIGHTNESS'       // Chỉnh độ sáng (LED)
  | 'IR_TRANSMIT'      // Phát tín hiệu hồng ngoại (Tivi, Điều hòa)
  | 'TEMPERATURE_READ' // Đọc nhiệt độ (DHT22)
  | 'HUMIDITY_READ'    // Đọc độ ẩm (DHT22)
  | 'MOTION_DETECT'    // Phát hiện chuyển động (PIR HC-SR501)
  | 'SMOKE_DETECT'     // Phát hiện khói/khí gas (MQ-2)
  | 'AI_FALL_DETECT'      // Phát hiện người té ngã
  | 'AI_INTRUSION_DETECT';// Phát hiện đột nhập trái phép

export type DeviceAction = 
  | 'TURN_ON'
  | 'TURN_OFF'
  | 'TOGGLE'
  | 'SET_COLOR'
  | 'SET_BRIGHTNESS'
  | 'SET_TEMPERATURE'
  | 'SET_SPEED'
  | 'SEND_IR_CODE'     // Gửi mã hồng ngoại 
  | 'SET_AI_MODE'      // Bật/Tắt chế độ cảnh báo Camera
  | 'SET_STATE';       // Gửi JSON State tổng hợp (Dành cho Scene)

export const DEVICE_TYPES = {
  LIGHT: 'LIGHT',                   // Đèn bình thường (Relay)
  LED_RGB: 'LED_RGB',               // Đèn dải màu
  SMART_PLUG: 'SMART_PLUG',         // Ổ cắm điện (Relay)
  IR_REMOTE: 'IR_REMOTE',           // Cục phát hồng ngoại
  TEMP_HUMID_SENSOR: 'TEMP_HUMID_SENSOR', // Cảm biến DHT22
  MOTION_SENSOR: 'MOTION_SENSOR',   // Cảm biến PIR
  SMOKE_SENSOR: 'SMOKE_SENSOR',     // Cảm biến MQ-2
  CAMERA_AI: 'CAMERA_AI'            // Camera Ugreen qua Orange Pi
} as const;

export type DeviceType = keyof typeof DEVICE_TYPES;
