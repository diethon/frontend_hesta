import {
  Sofa,
  Bed,
  Utensils,
  Coffee,
  Bath,
  Briefcase,
  Flower2,
  Sun,
  Car,
  Box,
  Home,
  type LucideIcon,
} from 'lucide-react';

export interface RoomIconOption {
  id: string;
  label: string;
  icon: LucideIcon;
}

export const ROOM_ICONS: RoomIconOption[] = [
  { id: 'living', label: 'Khách', icon: Sofa },
  { id: 'bedroom', label: 'Ngủ', icon: Bed },
  { id: 'kitchen', label: 'Bếp', icon: Utensils },
  { id: 'dining', label: 'Ăn', icon: Coffee },
  { id: 'bathroom', label: 'Tắm / WC', icon: Bath },
  { id: 'office', label: 'Làm việc', icon: Briefcase },
  { id: 'balcony', label: 'Ban công', icon: Sun },
  { id: 'garden', label: 'Sân vườn', icon: Flower2 },
  { id: 'garage', label: 'Gara xe', icon: Car },
  { id: 'storage', label: 'Kho', icon: Box },
  { id: 'other', label: 'Phòng khác', icon: Home },
];

export const getRoomIcon = (iconName?: string | null): LucideIcon => {
  if (!iconName) return Home;
  const found = ROOM_ICONS.find((item) => item.id.toLowerCase() === iconName.toLowerCase());
  return found ? found.icon : Home;
};
