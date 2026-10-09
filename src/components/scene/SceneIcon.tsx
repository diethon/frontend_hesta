import React from 'react';
import { getLucideIcon, detectSceneTheme, SCENE_THEMES } from './sceneConstants';

interface SceneIconProps {
  iconKey?: string | null;
  name?: string;
  theme?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'gradient' | 'soft' | 'flat';
  className?: string;
  withBadge?: boolean;
}

const sizeMap = {
  xs: { icon: 14, container: 'w-7 h-7 rounded-lg' },
  sm: { icon: 16, container: 'w-9 h-9 rounded-xl' },
  md: { icon: 20, container: 'w-11 h-11 rounded-2xl' },
  lg: { icon: 24, container: 'w-13 h-13 rounded-2xl' },
  xl: { icon: 30, container: 'w-16 h-16 rounded-3xl' },
};

export const SceneIcon: React.FC<SceneIconProps> = ({
  iconKey,
  name,
  theme,
  size = 'md',
  variant = 'gradient',
  className = '',
  withBadge = true,
}) => {
  const IconComponent = getLucideIcon(iconKey);
  const themeObj = theme && SCENE_THEMES[theme] ? SCENE_THEMES[theme] : detectSceneTheme(name, iconKey);
  const { icon: iconSize, container: containerClasses } = sizeMap[size];

  if (!withBadge || variant === 'flat') {
    return (
      <IconComponent
        size={iconSize}
        className={`${themeObj.textColor} ${className}`}
        aria-hidden="true"
      />
    );
  }

  const badgeStyle =
    variant === 'gradient'
      ? `bg-gradient-to-br ${themeObj.iconGradient}`
      : `${themeObj.badgeBg}`;

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-105 ${containerClasses} ${badgeStyle} ${className}`}
      aria-hidden="true"
    >
      <IconComponent size={iconSize} className="stroke-[2.2] drop-shadow-xs" />
    </div>
  );
};
