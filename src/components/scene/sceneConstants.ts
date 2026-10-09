import {
  Sun,
  Moon,
  Film,
  Bed,
  Coffee,
  Wind,
  Flame,
  Shield,
  Sparkles,
  PartyPopper,
  Home,
  Tv,
  Power,
  Music,
  BookOpen,
  Briefcase,
  Utensils,
  Lightbulb,
  Thermometer,
  Fan,
  Zap,
  Lock,
  Compass,
  Smile,
  type LucideIcon,
} from 'lucide-react';

export interface SceneThemeOption {
  id: string;
  label: string;
  bgGradient: string;
  badgeBg: string;
  textColor: string;
  borderColor: string;
  ringColor: string;
  glowColor: string;
  iconGradient: string;
  pillGradient: string;
  accentHex: string;
}

export const SCENE_THEMES: Record<string, SceneThemeOption> = {
  amber: {
    id: 'amber',
    label: 'Bình minh (Vàng cam)',
    bgGradient: 'from-amber-500/12 via-orange-500/5 to-transparent',
    badgeBg: 'bg-amber-500/15 text-amber-700 border border-amber-300/60',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200/80 hover:border-amber-400',
    ringColor: 'focus:ring-amber-400',
    glowColor: 'shadow-amber-500/15 hover:shadow-amber-500/25',
    iconGradient: 'from-amber-400 to-orange-500 text-white shadow-amber-500/30',
    pillGradient: 'from-amber-50 to-orange-50/70 border-amber-200 text-amber-800',
    accentHex: '#f59e0b',
  },
  indigo: {
    id: 'indigo',
    label: 'Ban đêm (Xanh tím)',
    bgGradient: 'from-indigo-500/12 via-purple-500/5 to-transparent',
    badgeBg: 'bg-indigo-500/15 text-indigo-700 border border-indigo-300/60',
    textColor: 'text-indigo-700',
    borderColor: 'border-indigo-200/80 hover:border-indigo-400',
    ringColor: 'focus:ring-indigo-400',
    glowColor: 'shadow-indigo-500/15 hover:shadow-indigo-500/25',
    iconGradient: 'from-indigo-500 to-purple-600 text-white shadow-indigo-500/30',
    pillGradient: 'from-indigo-50 to-purple-50/70 border-indigo-200 text-indigo-800',
    accentHex: '#6366f1',
  },
  emerald: {
    id: 'emerald',
    label: 'Chào đón (Xanh ngọc)',
    bgGradient: 'from-emerald-500/12 via-teal-500/5 to-transparent',
    badgeBg: 'bg-emerald-500/15 text-emerald-700 border border-emerald-300/60',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-200/80 hover:border-emerald-400',
    ringColor: 'focus:ring-emerald-400',
    glowColor: 'shadow-emerald-500/15 hover:shadow-emerald-500/25',
    iconGradient: 'from-emerald-400 to-teal-500 text-white shadow-emerald-500/30',
    pillGradient: 'from-emerald-50 to-teal-50/70 border-emerald-200 text-emerald-800',
    accentHex: '#10b981',
  },
  rose: {
    id: 'rose',
    label: 'Rời nhà (Đỏ hồng)',
    bgGradient: 'from-rose-500/12 via-pink-500/5 to-transparent',
    badgeBg: 'bg-rose-500/15 text-rose-700 border border-rose-300/60',
    textColor: 'text-rose-700',
    borderColor: 'border-rose-200/80 hover:border-rose-400',
    ringColor: 'focus:ring-rose-400',
    glowColor: 'shadow-rose-500/15 hover:shadow-rose-500/25',
    iconGradient: 'from-rose-400 to-red-500 text-white shadow-rose-500/30',
    pillGradient: 'from-rose-50 to-pink-50/70 border-rose-200 text-rose-800',
    accentHex: '#f43f5e',
  },
  violet: {
    id: 'violet',
    label: 'Giải trí (Tím đậm)',
    bgGradient: 'from-violet-500/12 via-purple-500/5 to-transparent',
    badgeBg: 'bg-violet-500/15 text-violet-700 border border-violet-300/60',
    textColor: 'text-violet-700',
    borderColor: 'border-violet-200/80 hover:border-violet-400',
    ringColor: 'focus:ring-violet-400',
    glowColor: 'shadow-violet-500/15 hover:shadow-violet-500/25',
    iconGradient: 'from-violet-500 to-fuchsia-600 text-white shadow-violet-500/30',
    pillGradient: 'from-violet-50 to-purple-50/70 border-violet-200 text-violet-800',
    accentHex: '#8b5cf6',
  },
  cyan: {
    id: 'cyan',
    label: 'Thư giãn (Xanh lam)',
    bgGradient: 'from-cyan-500/12 via-sky-500/5 to-transparent',
    badgeBg: 'bg-cyan-500/15 text-cyan-700 border border-cyan-300/60',
    textColor: 'text-cyan-700',
    borderColor: 'border-cyan-200/80 hover:border-cyan-400',
    ringColor: 'focus:ring-cyan-400',
    glowColor: 'shadow-cyan-500/15 hover:shadow-cyan-500/25',
    iconGradient: 'from-cyan-400 to-blue-500 text-white shadow-cyan-500/30',
    pillGradient: 'from-cyan-50 to-sky-50/70 border-cyan-200 text-cyan-800',
    accentHex: '#06b6d4',
  },
  pink: {
    id: 'pink',
    label: 'Tiệc tùng (Hồng rực rỡ)',
    bgGradient: 'from-pink-500/12 via-fuchsia-500/5 to-transparent',
    badgeBg: 'bg-pink-500/15 text-pink-700 border border-pink-300/60',
    textColor: 'text-pink-700',
    borderColor: 'border-pink-200/80 hover:border-pink-400',
    ringColor: 'focus:ring-pink-400',
    glowColor: 'shadow-pink-500/15 hover:shadow-pink-500/25',
    iconGradient: 'from-pink-400 to-rose-500 text-white shadow-pink-500/30',
    pillGradient: 'from-pink-50 to-fuchsia-50/70 border-pink-200 text-pink-800',
    accentHex: '#ec4899',
  },
  blue: {
    id: 'blue',
    label: 'Tiêu chuẩn (Xanh dương)',
    bgGradient: 'from-blue-500/12 via-sky-500/5 to-transparent',
    badgeBg: 'bg-blue-500/15 text-blue-700 border border-blue-300/60',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200/80 hover:border-blue-400',
    ringColor: 'focus:ring-blue-400',
    glowColor: 'shadow-blue-500/15 hover:shadow-blue-500/25',
    iconGradient: 'from-sky-400 to-blue-600 text-white shadow-blue-500/30',
    pillGradient: 'from-sky-50 to-blue-50/70 border-blue-200 text-blue-800',
    accentHex: '#3b82f6',
  },
};

export interface ScenePreset {
  id: string;
  name: string;
  icon: string;
  theme: keyof typeof SCENE_THEMES;
  description: string;
  suggestedActionType?: 'LIGHT_ON' | 'ALL_OFF' | 'CLIMATE' | 'ENTERTAINMENT';
}

export const SCENE_PRESETS: ScenePreset[] = [
  {
    id: 'morning',
    name: 'Chào buổi sáng',
    icon: 'sun',
    theme: 'amber',
    description: 'Bật ánh sáng ấm, mở rèm và sẵn sàng năng lượng khởi đầu ngày mới.',
  },
  {
    id: 'night',
    name: 'Chúc ngủ ngon',
    icon: 'moon',
    theme: 'indigo',
    description: 'Tắt toàn bộ hệ thống đèn, điều hòa về 26°C cho giấc ngủ sâu.',
  },
  {
    id: 'leave',
    name: 'Rời khỏi nhà',
    icon: 'shield',
    theme: 'rose',
    description: 'Tắt toàn bộ thiết bị điện không dùng và kích hoạt an ninh.',
  },
  {
    id: 'welcome',
    name: 'Về đến nhà',
    icon: 'home',
    theme: 'emerald',
    description: 'Bật đèn phòng khách và làm mát nhiệt độ chào đón bạn trở về.',
  },
  {
    id: 'movie',
    name: 'Rạp phim tại gia',
    icon: 'film',
    theme: 'violet',
    description: 'Hạ độ sáng đèn xuống 20%, tạo không gian xem phim đắm chìm.',
  },
  {
    id: 'relax',
    name: 'Thư giãn đọc sách',
    icon: 'coffee',
    theme: 'cyan',
    description: 'Ánh sáng vàng dịu nhẹ, quạt gió thoang thoảng giải tỏa căng thẳng.',
  },
  {
    id: 'party',
    name: 'Tiệc tùng sôi động',
    icon: 'party',
    theme: 'pink',
    description: 'Đèn đổi màu rực rỡ, bật âm nhạc tạo bầu không khí tưng bừng.',
  },
  {
    id: 'focus',
    name: 'Làm việc tập trung',
    icon: 'briefcase',
    theme: 'blue',
    description: 'Ánh sáng trắng rõ nét, nhiệt độ chuẩn 24°C nâng cao hiệu suất.',
  },
];

export interface IconDefinition {
  key: string;
  label: string;
  icon: LucideIcon;
  emojiFallback: string;
}

export const AVAILABLE_ICONS: IconDefinition[] = [
  { key: 'home', label: 'Ngôi nhà', icon: Home, emojiFallback: '🏠' },
  { key: 'sun', label: 'Buổi sáng', icon: Sun, emojiFallback: '☀️' },
  { key: 'moon', label: 'Ban đêm', icon: Moon, emojiFallback: '🌙' },
  { key: 'lightbulb', label: 'Đèn sáng', icon: Lightbulb, emojiFallback: '💡' },
  { key: 'film', label: 'Xem phim', icon: Film, emojiFallback: '🎬' },
  { key: 'coffee', label: 'Thư giãn', icon: Coffee, emojiFallback: '☕' },
  { key: 'bed', label: 'Phòng ngủ', icon: Bed, emojiFallback: '🛏️' },
  { key: 'shield', label: 'An ninh', icon: Shield, emojiFallback: '🛡️' },
  { key: 'party', label: 'Tiệc tùng', icon: PartyPopper, emojiFallback: '🎉' },
  { key: 'sparkles', label: 'Nổi bật', icon: Sparkles, emojiFallback: '✨' },
  { key: 'tv', label: 'Tivi', icon: Tv, emojiFallback: '📺' },
  { key: 'wind', label: 'Gió mát', icon: Wind, emojiFallback: '💨' },
  { key: 'thermometer', label: 'Nhiệt độ', icon: Thermometer, emojiFallback: '❄️' },
  { key: 'fan', label: 'Quạt', icon: Fan, emojiFallback: '🌀' },
  { key: 'music', label: 'Âm nhạc', icon: Music, emojiFallback: '🎵' },
  { key: 'briefcase', label: 'Làm việc', icon: Briefcase, emojiFallback: '💼' },
  { key: 'book', label: 'Đọc sách', icon: BookOpen, emojiFallback: '📖' },
  { key: 'utensils', label: 'Ăn uống', icon: Utensils, emojiFallback: '🍽️' },
  { key: 'flame', label: 'Ấm áp', icon: Flame, emojiFallback: '🔥' },
  { key: 'power', label: 'Nguồn', icon: Power, emojiFallback: '⚡' },
  { key: 'lock', label: 'Khóa cửa', icon: Lock, emojiFallback: '🔒' },
  { key: 'compass', label: 'Khám phá', icon: Compass, emojiFallback: '🧭' },
  { key: 'smile', label: 'Hạnh phúc', icon: Smile, emojiFallback: '😊' },
];

/**
 * Returns the Lucide Icon or null if string is just an emoji
 */
export function getLucideIcon(iconKey?: string | null): LucideIcon {
  if (!iconKey) return Home;
  const normalized = iconKey.trim().toLowerCase();

  // Check direct key match
  const found = AVAILABLE_ICONS.find(
    (i) => i.key === normalized || i.emojiFallback === iconKey,
  );
  if (found) return found.icon;

  // Keyword associations
  if (normalized.includes('sun') || normalized.includes('sáng') || normalized === '☀️') return Sun;
  if (normalized.includes('moon') || normalized.includes('tối') || normalized.includes('ngủ') || normalized === '🌙') return Moon;
  if (normalized.includes('film') || normalized.includes('phim') || normalized === '🎬') return Film;
  if (normalized.includes('coffee') || normalized.includes('cà phê') || normalized === '☕') return Coffee;
  if (normalized.includes('shield') || normalized.includes('vệ') || normalized === '🛡️') return Shield;
  if (normalized.includes('lock') || normalized.includes('khóa') || normalized === '🔒') return Lock;
  if (normalized.includes('party') || normalized.includes('tiệc') || normalized === '🎉') return PartyPopper;
  if (normalized.includes('bed') || normalized === '🛏️') return Bed;
  if (normalized.includes('light') || normalized.includes('đèn') || normalized === '💡') return Lightbulb;
  if (normalized.includes('cool') || normalized.includes('lạnh') || normalized === '❄️') return Thermometer;
  if (normalized.includes('wind') || normalized.includes('quạt') || normalized === '🌀') return Fan;
  if (normalized.includes('home') || normalized.includes('nhà') || normalized === '🏠') return Home;

  return Sparkles;
}

export function detectSceneTheme(name?: string, icon?: string | null): SceneThemeOption {
  const text = `${name ?? ''} ${icon ?? ''}`.toLowerCase();
  if (text.includes('sáng') || text.includes('morning') || text.includes('sun') || text.includes('☀️')) return SCENE_THEMES.amber;
  if (text.includes('ngủ') || text.includes('tối') || text.includes('night') || text.includes('moon') || text.includes('🌙')) return SCENE_THEMES.indigo;
  if (text.includes('về') || text.includes('welcome') || text.includes('home') || text.includes('nhà') || text.includes('🏠')) return SCENE_THEMES.emerald;
  if (text.includes('rời') || text.includes('ra') || text.includes('away') || text.includes('leave') || text.includes('shield') || text.includes('khóa')) return SCENE_THEMES.rose;
  if (text.includes('phim') || text.includes('movie') || text.includes('cinema') || text.includes('film') || text.includes('🎬')) return SCENE_THEMES.violet;
  if (text.includes('thư giãn') || text.includes('relax') || text.includes('coffee') || text.includes('đọc sách') || text.includes('☕')) return SCENE_THEMES.cyan;
  if (text.includes('tiệc') || text.includes('party') || text.includes('🎉')) return SCENE_THEMES.pink;
  return SCENE_THEMES.blue;
}

/**
 * Returns matching icon for device types
 */
export function getDeviceTypeIcon(deviceType?: string): LucideIcon {
  const t = (deviceType ?? '').toUpperCase();
  if (t.includes('LIGHT') || t.includes('LED') || t.includes('LAMP')) return Lightbulb;
  if (t.includes('AC') || t.includes('CLIMATE') || t.includes('AIR') || t.includes('TEMP')) return Thermometer;
  if (t.includes('FAN')) return Fan;
  if (t.includes('SOCKET') || t.includes('PLUG') || t.includes('SWITCH')) return Power;
  if (t.includes('TV')) return Tv;
  if (t.includes('LOCK') || t.includes('SECURITY')) return Shield;
  return Zap;
}

export function getActionIcon(actionType?: string, deviceName?: string): LucideIcon {
  const a = (actionType ?? '').toUpperCase();
  const n = (deviceName ?? '').toUpperCase();
  if (a === 'SET_TEMPERATURE' || n.includes('ĐIỀU HÒA') || n.includes('LẠNH') || n.includes('AC')) return Thermometer;
  if (a === 'SET_BRIGHTNESS' || n.includes('ĐÈN') || n.includes('LIGHT') || n.includes('LED')) return Lightbulb;
  if (a === 'SET_SPEED' || n.includes('QUẠT') || n.includes('FAN')) return Fan;
  if (n.includes('CẮM') || n.includes('SOCKET') || n.includes('PLUG') || n.includes('CÔNG TẮC')) return Power;
  if (n.includes('KHÓA') || n.includes('CỬA') || n.includes('DOOR') || n.includes('LOCK')) return Shield;
  if (a === 'TURN_ON' || a === 'TURN_OFF') {
    if (n.includes('ĐÈN')) return Lightbulb;
    if (n.includes('QUẠT')) return Fan;
    if (n.includes('ĐIỀU HÒA') || n.includes('LẠNH')) return Thermometer;
    return Power;
  }
  return Zap;
}

