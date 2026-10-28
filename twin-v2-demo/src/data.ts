export type RoomId = 'living' | 'bedroom' | 'kitchen' | 'bathroom' | 'office' | 'garden'
export type FloorId = 'floor-1' | 'floor-2' | 'floor-3'
export const floors: { id: FloorId; name: string; description: string }[] = [
  { id: 'floor-1', name: 'Tầng 1', description: 'Không gian chung' },
  { id: 'floor-2', name: 'Tầng 2', description: 'Không gian gia đình' },
  { id: 'floor-3', name: 'Tầng 3', description: 'Làm việc & thư giãn' },
]
export type DeviceKind = 'light' | 'ac' | 'fan' | 'tv' | 'temperature' | 'motion'
export interface Room {
  id: RoomId
  name: string
  english: string
  area: number
  center: [number, number, number]
  size: [number, number]
  temperature: number
  humidity: number
}
export interface Device {
  id: string
  floor: FloorId
  room: RoomId
  name: string
  kind: DeviceKind
  on: boolean
  online: boolean
  brightness?: number
  warmth?: 'warm' | 'neutral' | 'cool'
  temperature?: number
  mode?: 'cool' | 'auto' | 'dry'
  speed?: number
}
// Dimensions are metres. The open cutaway faces positive Z.
export const rooms: Room[] = [
  { id: 'living', name: 'Phòng khách', english: 'Living room', area: 28, center: [-3.1, 0, 2.1], size: [5.8, 4.6], temperature: 26.8, humidity: 62 },
  { id: 'bedroom', name: 'Phòng ngủ', english: 'Bedroom', area: 19, center: [-3.8, 0, -2.7], size: [4.4, 4.6], temperature: 25.6, humidity: 59 },
  { id: 'kitchen', name: 'Phòng bếp', english: 'Kitchen & dining', area: 22, center: [2.9, 0, 2.1], size: [5.8, 4.6], temperature: 27.2, humidity: 64 },
  { id: 'bathroom', name: 'Phòng tắm', english: 'Bathroom', area: 9, center: [-0.1, 0, -2.7], size: [2.6, 4.6], temperature: 26.2, humidity: 68 },
  { id: 'office', name: 'Phòng làm việc', english: 'Home office', area: 16, center: [3.6, 0, -2.7], size: [4.6, 4.6], temperature: 26.5, humidity: 60 },
  { id: 'garden', name: 'Sân vườn & garage', english: 'Garden & garage', area: 24, center: [7.7, 0, 0], size: [3.2, 10], temperature: 28.4, humidity: 66 },
]
const groundDevices: Omit<Device, 'floor'>[] = [
  { id: 'living-light', room: 'living', name: 'Đèn phòng khách', kind: 'light', on: true, online: true, brightness: 75, warmth: 'warm' },
  { id: 'living-ac', room: 'living', name: 'Điều hòa', kind: 'ac', on: true, online: true, temperature: 24, mode: 'cool' },
  { id: 'living-fan', room: 'living', name: 'Quạt trần', kind: 'fan', on: false, online: true, speed: 2 },
  { id: 'living-tv', room: 'living', name: 'Smart TV', kind: 'tv', on: false, online: false },
  { id: 'living-sensor', room: 'living', name: 'Cảm biến nhiệt độ', kind: 'temperature', on: true, online: true },
  { id: 'bedroom-light', room: 'bedroom', name: 'Đèn phòng ngủ', kind: 'light', on: true, online: true, brightness: 50, warmth: 'warm' },
  { id: 'kitchen-light', room: 'kitchen', name: 'Đèn bàn ăn', kind: 'light', on: true, online: true, brightness: 75, warmth: 'neutral' },
  { id: 'bathroom-motion', room: 'bathroom', name: 'Cảm biến chuyển động', kind: 'motion', on: true, online: false },
  { id: 'office-light', room: 'office', name: 'Đèn làm việc', kind: 'light', on: true, online: true, brightness: 100, warmth: 'cool' },
  { id: 'garden-motion', room: 'garden', name: 'Cảm biến sân vườn', kind: 'motion', on: false, online: false },
]
const floorRoomNames: Record<FloorId, string[]> = {
  'floor-1': rooms.map(room => room.name),
  'floor-2': ['Sảnh gia đình', 'Phòng ngủ master', 'Bếp trà', 'Phòng tắm tầng 2', 'Phòng học', 'Ban công xanh'],
  'floor-3': ['Phòng thư giãn', 'Phòng nghỉ', 'Bếp sân thượng', 'Phòng tắm tầng 3', 'Studio làm việc', 'Vườn sân thượng'],
}
export const roomsByFloor: Record<FloorId, Room[]> = Object.fromEntries(floors.map((floor, floorIndex) => [floor.id, rooms.map((room, index) => ({ ...room, name: floorRoomNames[floor.id][index], temperature: Number((room.temperature + floorIndex * .4).toFixed(1)), humidity: room.humidity - floorIndex * 2 }))])) as Record<FloorId, Room[]>
export const initialDevices: Device[] = floors.flatMap((floor, floorIndex) => groundDevices.map(device => ({
  ...device,
  id: floorIndex === 0 ? device.id : `${floor.id}-${device.id}`,
  floor: floor.id,
  name: device.kind === 'light' ? `Đèn ${roomsByFloor[floor.id].find(room => room.id === device.room)!.name.toLocaleLowerCase('vi')}` : device.name,
  brightness: device.brightness === undefined ? undefined : [75, 50, 100][floorIndex],
  temperature: device.temperature === undefined ? undefined : 24 + floorIndex,
  warmth: device.warmth === undefined ? undefined : floorIndex === 1 ? 'neutral' : floorIndex === 2 ? 'cool' : device.warmth,
  on: device.kind === 'fan' ? floorIndex === 1 : device.on,
})))
export type CameraCommand = { type: 'reset' | 'focus' | 'zoomIn' | 'zoomOut'; nonce: number }
export type ToolMode = 'select' | 'pan' | 'rotate'
export interface HouseSceneProps {
  roomView: boolean
  floor: FloorId
  rooms: Room[]
  selectedRoom: RoomId
  selectedDevice: string
  devices: Device[]
  night: boolean
  tool: ToolMode
  command: CameraCommand
  onRoomSelect: (id: RoomId) => void
  onDeviceSelect: (id: string) => void
}
