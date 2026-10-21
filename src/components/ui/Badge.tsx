import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground shadow-xs',
        secondary:
          'border-border/60 bg-secondary text-secondary-foreground',
        destructive:
          'border-red-200 bg-red-50 text-red-700 dark:bg-red-950/40 dark:border-red-900/50 dark:text-red-400',
        danger:
          'border-red-200 bg-red-50 text-red-700 dark:bg-red-950/40 dark:border-red-900/50 dark:text-red-400',
        success:
          'border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-900/50 dark:text-emerald-400',
        warning:
          'border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:border-amber-900/50 dark:text-amber-400',
        info:
          'border-sky-200 bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:border-sky-900/50 dark:text-sky-400',
        neutral:
          'border-slate-200 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300',
        outline: 'border-border text-foreground',
      },
      size: {
        sm: 'text-[11px] px-2 py-0.5',
        md: 'text-xs px-2.5 py-0.5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export function Badge({
  className,
  variant = 'neutral',
  size = 'md',
  dot = false,
  children,
  ...props
}: BadgeProps) {
  const dotColorMap: Record<string, string> = {
    success: 'bg-emerald-600 dark:bg-emerald-400',
    warning: 'bg-amber-600 dark:bg-amber-400',
    info: 'bg-sky-600 dark:bg-sky-400',
    danger: 'bg-red-600 dark:bg-red-400',
    destructive: 'bg-red-600 dark:bg-red-400',
    neutral: 'bg-slate-500 dark:bg-slate-400',
    default: 'bg-primary-foreground',
    secondary: 'bg-secondary-foreground',
    outline: 'bg-foreground',
  };

  const dotColor = variant ? dotColorMap[variant] || 'bg-slate-500' : 'bg-slate-500';

  return (
    <div
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full shrink-0',
            dotColor,
            variant === 'success' && 'animate-pulse'
          )}
        />
      )}
      <span>{children}</span>
    </div>
  );
}

export function StatusBadge({ status }: { status: 'published' | 'draft' | string }) {
  if (status === 'published') {
    return (
      <Badge variant="success" dot>
        Published
      </Badge>
    );
  }
  return (
    <Badge variant="warning" dot>
      Draft
    </Badge>
  );
}
