import React from 'react';

export interface IconProps {
  name: string;
  size?: number | string;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent<HTMLSpanElement>) => void;
}

/**
 * Reusable Remix Icon component
 * 
 * Usage:
 * <Icon name="ri-checkbox-line" />
 * <Icon name="ri-arrow-right-s-line" size={20} />
 * <Icon name="ri-delete-bin-line" className="custom-class" />
 * 
 * Find icons: https://remixicon.com/
 */
export const Icon: React.FC<IconProps> = ({
  name,
  size,
  color,
  className = '',
  style,
  onClick,
}) => {
  const iconStyle: React.CSSProperties = {
    ...(style || {}),
    ...(size ? { fontSize: typeof size === 'number' ? `${size}px` : size } : {}),
    ...(color ? { color } : {}),
  };

  return (
    <span
      className={`ri ${name} ${className}`}
      style={iconStyle}
      onClick={onClick}
      aria-hidden="true"
    />
  );
};