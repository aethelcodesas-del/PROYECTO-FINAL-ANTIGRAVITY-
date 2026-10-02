import React from 'react';

/**
 * Non-blocking, zero-skeleton loader system.
 * Eliminates gray placeholder boxes and pulse bars to achieve Instant Load / Zero Layout Shift (CLS = 0).
 * Displays a subtle top-progress indicator during network activity without altering content layout.
 */

export const StatCardsSkeleton: React.FC<{ count?: number }> = () => null;

export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = () => null;

export const CardListSkeleton: React.FC<{ count?: number }> = () => null;

export const ChartSkeleton: React.FC = () => null;

/**
 * Clean Top Loading Bar replacing full-screen skeleton overlays.
 */
export const ModuleSkeleton: React.FC<{ title?: string }> = () => (
  <div className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none">
    <div className="h-[2px] w-full bg-gradient-to-r from-cyan-500 via-emerald-400 to-blue-500 animate-pulse" />
  </div>
);
