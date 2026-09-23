import React from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export interface NoticeProps {
  variant?: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message?: string;
  children?: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
}

export const Notice: React.FC<NoticeProps> = ({
  variant = 'info',
  title,
  message,
  children,
  onDismiss,
  className = ''
}) => {
  const styles = {
    success: {
      container: 'bg-emerald-50 border-emerald-200 text-emerald-900',
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
    },
    error: {
      container: 'bg-rose-50 border-rose-200 text-rose-900',
      icon: <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
    },
    warning: {
      container: 'bg-amber-50 border-amber-200 text-amber-900',
      icon: <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
    },
    info: {
      container: 'bg-slate-100 border-slate-200 text-slate-800',
      icon: <Info className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
    }
  };

  const current = styles[variant];
  const content = message ?? children;

  return (
    <div
      className={`p-3.5 rounded-md border text-xs flex items-start justify-between gap-3 shadow-2xs ${current.container} ${className}`}
      role="alert"
    >
      <div className="flex items-start gap-2.5">
        {current.icon}
        <div>
          {title && <h5 className="font-semibold mb-0.5 tracking-tight">{title}</h5>}
          <div className="leading-relaxed opacity-95">{content}</div>
        </div>
      </div>

      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors"
          title="Dismiss notice"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
