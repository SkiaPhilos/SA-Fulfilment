import React from 'react';

interface ShipAsaanLogoProps {
  variant?: 'full' | 'icon' | 'mark';
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const ShipAsaanLogo: React.FC<ShipAsaanLogoProps> = ({
  variant = 'full',
  className = '',
  size = 'md'
}) => {
  const heightClasses = {
    sm: 'h-6',
    md: 'h-8',
    lg: 'h-10',
    xl: 'h-14'
  };

  if (variant === 'icon') {
    return (
      <div className={`relative inline-flex items-center justify-center shrink-0 ${heightClasses[size]} aspect-square ${className}`}>
        <img
          src="/favicon.svg"
          alt="Ship Asaan Icon"
          className="w-full h-full object-contain rounded-lg shadow-2xs"
        />
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center shrink-0 ${className}`}>
      <img
        src="/logo.svg"
        alt="Ship Asaan - Fulfillment"
        className={`${heightClasses[size]} w-auto object-contain`}
      />
    </div>
  );
};
