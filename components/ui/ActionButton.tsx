'use client';

import React from 'react';

export type ActionButtonVariant = 'misReportes' | 'reportar';

interface ActionButtonProps {
  children?: React.ReactNode;
  label?: string;
  onClick?: () => void;
  variant?: ActionButtonVariant;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  icon?: string;
  className?: string;
}

const VARIANT_CLASSES: Record<ActionButtonVariant, string> = {
  misReportes:
    'border-2 border-olive-seasoning bg-volcano-snow text-night-sky hover:opacity-90',
  reportar:
    'border-2 border-volcano-snow bg-enphasis-red text-volcano-snow hover:opacity-90',
};

export default function ActionButton({
  children,
  label,
  onClick,
  variant = 'misReportes',
  type = 'button',
  disabled = false,
  icon,
  className = '',
}: ActionButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-l-2xl px-6 py-2 text-sm font-bold tracking-wide shadow-md transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 sm:px-8 sm:text-base ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {icon && (
        <span
          className="material-icons-round text-3xl leading-none select-none"
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
      {children || label}
    </button>
  );
}