import React from "react";

export type IconName =
  | "home"
  | "grid"
  | "cube"
  | "energy"
  | "sparkles"
  | "automation"
  | "users"
  | "settings"
  | "search"
  | "mic"
  | "bell"
  | "thermometer"
  | "droplet"
  | "shield"
  | "sun"
  | "briefcase"
  | "sofa"
  | "film"
  | "moon"
  | "power"
  | "lamp"
  | "snowflake"
  | "gauge"
  | "door"
  | "camera"
  | "cameraOff"
  | "maximize"
  | "refresh"
  | "lock"
  | "activity"
  | "chevron"
  | "chevronDown"
  | "plus"
  | "more"
  | "cloud"
  | "car"
  | "coffee"
  | "book"
  | "leaf"
  | "party"
  | "plane"
  | "pencil"
  | "drag"
  | "check"
  | "trash"
  | "copy"
  | "clock";

export const iconPaths: Record<IconName, React.ReactNode> = {
  car: (
    <>
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9C2.1 11 2 11.2 2 11.5V16c0 .6.4 1 1 1h2" />
      <circle cx="7" cy="17" r="2" />
      <path d="M9 17h6" />
      <circle cx="17" cy="17" r="2" />
    </>
  ),
  coffee: (
    <>
      <path d="M17 8h1a4 4 0 1 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
      <line x1="6" x2="6" y1="2" y2="4" />
      <line x1="10" x2="10" y1="2" y2="4" />
      <line x1="14" x2="14" y1="2" y2="4" />
    </>
  ),
  book: (
    <>
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
      <path d="M6 6h10M6 10h10" />
    </>
  ),
  leaf: (
    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c0 3 .5 5.5-1 10-1.5 4.5-3.5 8-7 8ZM2 21c0-3 1.9-5.5 4.2-7" />
  ),
  party: (
    <>
      <path d="M5.8 11.3 2 22l10.7-3.8M4 3h.01M22 8h.01M15 2h.01M22 20h.01M19 14h.01" />
      <path d="m21.5 3.5-3.3 3.3a1 1 0 0 1-1.4 0l-3.3-3.3a1 1 0 0 1 0-1.4l3.3-3.3" />
    </>
  ),
  plane: (
    <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.3c.4-.2.6-.6.5-1.1Z" />
  ),
  pencil: (
    <>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </>
  ),
  drag: (
    <>
      <circle cx="9" cy="5" r="1" />
      <circle cx="9" cy="12" r="1" />
      <circle cx="9" cy="19" r="1" />
      <circle cx="15" cy="5" r="1" />
      <circle cx="15" cy="12" r="1" />
      <circle cx="15" cy="19" r="1" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  trash: (
    <>
      <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </>
  ),
  copy: (
    <>
      <rect width="13" height="13" x="9" y="9" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </>
  ),
  home: (
    <>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10M9 20v-6h6v6" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </>
  ),
  cube: (
    <>
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
    </>
  ),
  energy: <path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z" />,
  sparkles: (
    <>
      <path d="m12 3 1.3 3.7L17 8l-3.7 1.3L12 13l-1.3-3.7L7 8l3.7-1.3L12 3Z" />
      <path d="m18 14 .8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14Z" />
    </>
  ),
  automation: (
    <>
      <path d="M8 6h8M8 12h8M8 18h8" />
      <circle cx="5" cy="6" r="2" />
      <circle cx="19" cy="12" r="2" />
      <circle cx="5" cy="18" r="2" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </>
  ),
  thermometer: (
    <>
      <path d="M14 14.8V5a4 4 0 0 0-8 0v9.8a6 6 0 1 0 8 0Z" />
      <path d="M10 9v8" />
    </>
  ),
  droplet: <path d="M12 2s7 7.1 7 12a7 7 0 0 1-14 0c0-4.9 7-12 7-12Z" />,
  shield: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5h8v2M3 12h18" />
    </>
  ),
  sofa: (
    <>
      <path d="M5 12V9a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3" />
      <path d="M5 11a3 3 0 0 0-3 3v4h20v-4a3 3 0 0 0-3-3M5 18v3M19 18v3" />
    </>
  ),
  film: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 5v14M17 5v14M3 9h4M17 9h4M3 15h4M17 15h4" />
    </>
  ),
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />,
  power: (
    <>
      <path d="M12 2v10" />
      <path d="M18.4 6.6a9 9 0 1 1-12.8 0" />
    </>
  ),
  lamp: (
    <>
      <path d="M8 3h8l3 9H5l3-9ZM12 12v8M8 20h8" />
    </>
  ),
  snowflake: (
    <>
      <path d="M12 2v20M4 7l16 10M20 7 4 17" />
      <path d="m9 4 3 3 3-3M9 20l3-3 3 3" />
    </>
  ),
  gauge: (
    <>
      <path d="M4 15a8 8 0 1 1 16 0" />
      <path d="m12 15 4-5" />
      <path d="M5 19h14" />
    </>
  ),
  door: (
    <>
      <path d="M5 21h14M7 21V4l10-2v19" />
      <circle cx="14" cy="12" r=".7" />
    </>
  ),
  camera: (
    <>
      <path d="M14.5 6 13 4h-3L8.5 6H5a2 2 0 0 0-2 2v10h18V8a2 2 0 0 0-2-2h-4.5Z" />
      <circle cx="12" cy="12" r="4" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  activity: (
    <>
      <path d="M3 12h4l2-7 4 14 2-7h6" />
    </>
  ),
  chevron: <path d="m9 18 6-6-6-6" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  maximize: (
    <>
      <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 7v5h-5" />
      <path d="M4 17v-5h5M6.1 9a7 7 0 0 1 11.6-2.6L20 9M4 15l2.3 2.6A7 7 0 0 0 18 15" />
    </>
  ),
  cameraOff: (
    <>
      <path d="M10.7 4H13l1.5 2H19a2 2 0 0 1 2 2v8.5M18.7 18H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h1" />
      <path d="m3 3 18 18M9.5 9.5A4 4 0 0 0 15 15" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  cloud: (
    <path d="M17.5 19H7a5 5 0 1 1 1.5-9.8A6 6 0 0 1 20 12a3.5 3.5 0 0 1-2.5 7Z" />
  ),
};

export function Icon({
  name,
  size = 22,
  className = "icon",
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {iconPaths[name]}
    </svg>
  );
}

export function IconButton({
  icon,
  label,
  dot,
  onClick,
  className = "icon-button",
}: {
  icon: IconName;
  label: string;
  dot?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <Icon name={icon} />
      {dot && <span className="notification-dot" />}
    </button>
  );
}
