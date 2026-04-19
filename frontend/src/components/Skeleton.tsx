'use client';

import clsx from 'clsx';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={clsx('animate-pulse bg-white/10 rounded-lg', className)} />;
}

export function SkeletonCard() {
  return (
    <div className="glass-card p-6">
      <Skeleton className="h-5 w-32 mb-4" />
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-4 w-3/4 mb-2" />
      <Skeleton className="h-4 w-5/6 mb-2" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="glass-card overflow-hidden">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 border-b border-white/5">
          <Skeleton className="w-8 h-4 flex-shrink-0" />
          <div className="flex items-center gap-2 flex-1">
            <Skeleton className="w-7 h-7 rounded-full flex-shrink-0" />
            <Skeleton className="h-4 w-36" />
          </div>
          <Skeleton className="h-4 w-16 flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonProfile() {
  return (
    <div className="glass-card p-6 flex items-center gap-4">
      <Skeleton className="w-14 h-14 rounded-full flex-shrink-0" />
      <div className="flex-1">
        <Skeleton className="h-5 w-36 mb-2" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  );
}

export function SkeletonStats({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass-card p-4 text-center">
          <Skeleton className="h-3 w-20 mx-auto mb-3" />
          <Skeleton className="h-7 w-16 mx-auto" />
        </div>
      ))}
    </div>
  );
}
