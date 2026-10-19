import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  headerAction?: React.ReactNode;
  title?: string;
  description?: string;
}

export function Card({
  children,
  className = '',
  headerAction,
  title,
  description,
}: CardProps) {
  return (
    <div
      className={`bg-slate-900/90 border border-slate-800 rounded-xl shadow-sm backdrop-blur-sm transition-all duration-200 hover:border-slate-700/80 ${className}`}
    >
      {(title || description || headerAction) && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80">
          <div>
            {title && <h3 className="text-base font-semibold text-slate-100">{title}</h3>}
            {description && (
              <p className="text-xs text-slate-400 mt-0.5">{description}</p>
            )}
          </div>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  isPositive?: boolean;
  icon: React.ReactNode;
  subtext?: string;
}

export function StatCard({
  title,
  value,
  change,
  isPositive = true,
  icon,
  subtext,
}: StatCardProps) {
  return (
    <div className="bg-slate-900 border border-slate-800/80 hover:border-slate-700 rounded-xl p-5 transition-all duration-200 shadow-sm relative overflow-hidden group">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
            {title}
          </p>
          <p className="text-2xl font-bold text-slate-100 tracking-tight">{value}</p>
        </div>
        <div className="h-10 w-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center group-hover:scale-105 transition-transform">
          {icon}
        </div>
      </div>
      {(change || subtext) && (
        <div className="mt-4 flex items-center gap-2 text-xs">
          {change && (
            <span
              className={`font-semibold inline-flex items-center ${
                isPositive ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {isPositive ? '↑' : '↓'} {change}
            </span>
          )}
          {subtext && <span className="text-slate-400">{subtext}</span>}
        </div>
      )}
    </div>
  );
}
