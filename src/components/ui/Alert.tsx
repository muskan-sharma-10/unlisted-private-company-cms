import React from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

interface AlertProps {
  variant?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

export function Alert({
  variant = 'info',
  title,
  children,
  onClose,
  className = '',
}: AlertProps) {
  const styles = {
    info: {
      container: 'bg-sky-500/10 border-sky-500/30 text-sky-200',
      icon: <Info className="h-5 w-5 text-sky-400 shrink-0 mt-0.5" />,
      titleColor: 'text-sky-300 font-semibold',
    },
    success: {
      container: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200',
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />,
      titleColor: 'text-emerald-300 font-semibold',
    },
    warning: {
      container: 'bg-amber-500/10 border-amber-500/30 text-amber-200',
      icon: <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />,
      titleColor: 'text-amber-300 font-semibold',
    },
    error: {
      container: 'bg-rose-500/10 border-rose-500/30 text-rose-200',
      icon: <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />,
      titleColor: 'text-rose-300 font-semibold',
    },
  };

  const current = styles[variant];

  return (
    <div
      className={`relative flex items-start gap-3 rounded-xl border p-4 text-sm shadow-sm transition-all ${current.container} ${className}`}
    >
      {current.icon}
      <div className="flex-1 space-y-0.5">
        {title && <p className={current.titleColor}>{title}</p>}
        <div className="text-xs leading-relaxed opacity-95">{children}</div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          type="button"
          className="text-slate-400 hover:text-slate-200 transition-colors p-1 -mr-1 -mt-1 rounded-lg"
          aria-label="Close alert"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
