import * as React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  InformationCircleIcon,
  CheckmarkCircle02Icon,
  Alert02Icon,
  CancelCircleIcon,
  Cancel01Icon,
} from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'info' | 'success' | 'warning' | 'error' | 'destructive';
  title?: string;
  onClose?: () => void;
}

export function Alert({
  variant = 'info',
  title,
  children,
  onClose,
  className = '',
  ...props
}: AlertProps) {
  const styles = {
    info: {
      container:
        'border-sky-200 bg-sky-50 text-sky-900 dark:bg-sky-950/40 dark:border-sky-900 dark:text-sky-200',
      icon: (
        <HugeiconsIcon
          icon={InformationCircleIcon}
          size={18}
          className="text-sky-600 dark:text-sky-400 shrink-0 mt-0.5"
        />
      ),
      titleColor: 'text-sky-950 dark:text-sky-200 font-semibold',
    },
    success: {
      container:
        'border-emerald-200 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-200',
      icon: (
        <HugeiconsIcon
          icon={CheckmarkCircle02Icon}
          size={18}
          className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"
        />
      ),
      titleColor: 'text-emerald-950 dark:text-emerald-200 font-semibold',
    },
    warning: {
      container:
        'border-amber-200 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-200',
      icon: (
        <HugeiconsIcon
          icon={Alert02Icon}
          size={18}
          className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
        />
      ),
      titleColor: 'text-amber-950 dark:text-amber-200 font-semibold',
    },
    error: {
      container:
        'border-red-200 bg-red-50 text-red-900 dark:bg-red-950/40 dark:border-red-900 dark:text-red-200',
      icon: (
        <HugeiconsIcon
          icon={CancelCircleIcon}
          size={18}
          className="text-red-600 dark:text-red-400 shrink-0 mt-0.5"
        />
      ),
      titleColor: 'text-red-950 dark:text-red-200 font-semibold',
    },
    destructive: {
      container:
        'border-red-200 bg-red-50 text-red-900 dark:bg-red-950/40 dark:border-red-900 dark:text-red-200',
      icon: (
        <HugeiconsIcon
          icon={CancelCircleIcon}
          size={18}
          className="text-red-600 dark:text-red-400 shrink-0 mt-0.5"
        />
      ),
      titleColor: 'text-red-950 dark:text-red-200 font-semibold',
    },
  };

  const current = styles[variant] || styles.info;

  return (
    <div
      role="alert"
      className={cn(
        'relative flex items-start gap-3 rounded-xl border p-4 text-sm shadow-2xs transition-all',
        current.container,
        className
      )}
      {...props}
    >
      {current.icon}
      <div className="flex-1 space-y-0.5 min-w-0">
        {title && <h5 className={cn('text-sm font-semibold leading-tight', current.titleColor)}>{title}</h5>}
        <div className="text-xs leading-relaxed opacity-95">{children}</div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          type="button"
          className="text-muted-foreground hover:text-foreground transition-colors p-1 -mr-1 -mt-1 rounded-md"
          aria-label="Close alert"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={16} />
        </button>
      )}
    </div>
  );
}
