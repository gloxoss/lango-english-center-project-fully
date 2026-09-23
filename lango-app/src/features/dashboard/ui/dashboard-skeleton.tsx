'use client';

import React from 'react';

export function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-3 border-b border-slate-200/80 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 rounded-lg bg-slate-200" />
          <div className="h-4 w-72 rounded-md bg-slate-100" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-36 rounded-xl bg-slate-200" />
          <div className="h-9 w-28 rounded-xl bg-slate-200" />
        </div>
      </div>

      {/* Action Center Skeleton (3 cards) */}
      <div className="space-y-3">
        <div className="h-4 w-44 rounded-md bg-slate-200" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl border border-slate-200/80 bg-white p-4">
              <div className="flex items-start gap-3">
                <div className="size-9 rounded-xl bg-slate-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-16 rounded-md bg-slate-200" />
                  <div className="h-4 w-40 rounded-md bg-slate-300" />
                  <div className="h-3 w-32 rounded-md bg-slate-100" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Daily Pulse KPIs Skeleton (4 cards) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-36 rounded-2xl border border-slate-200/80 bg-white p-5">
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 rounded bg-slate-200" />
              <div className="size-8 rounded-xl bg-slate-100" />
            </div>
            <div className="mt-4 space-y-2">
              <div className="h-8 w-24 rounded-lg bg-slate-300" />
              <div className="h-3 w-36 rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>

      {/* Finance + Attendance Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="h-96 rounded-2xl border border-slate-200/80 bg-white p-5 lg:col-span-7">
          <div className="h-4 w-52 rounded bg-slate-200" />
          <div className="mt-4 grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-slate-100" />
            ))}
          </div>
          <div className="mt-6 h-48 rounded-xl bg-slate-50" />
        </div>
        <div className="h-96 rounded-2xl border border-slate-200/80 bg-white p-5 lg:col-span-5">
          <div className="h-4 w-44 rounded bg-slate-200" />
          <div className="mt-6 grid grid-cols-6 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-44 rounded-xl bg-slate-100" />
            ))}
          </div>
        </div>
      </div>

      {/* Upcoming Events + Recent Payments */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="h-80 rounded-2xl border border-slate-200/80 bg-white p-5 lg:col-span-6">
          <div className="h-4 w-32 rounded bg-slate-200" />
          <div className="mt-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 rounded-xl bg-slate-100" />
            ))}
          </div>
        </div>
        <div className="h-80 rounded-2xl border border-slate-200/80 bg-white p-5 lg:col-span-6">
          <div className="h-4 w-36 rounded bg-slate-200" />
          <div className="mt-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 rounded-xl bg-slate-100" />
            ))}
          </div>
        </div>
      </div>

      {/* Watchlist + Distribution */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="h-80 rounded-2xl border border-slate-200/80 bg-white p-5 lg:col-span-6">
          <div className="h-4 w-40 rounded bg-slate-200" />
          <div className="mt-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 rounded-xl bg-slate-100" />
            ))}
          </div>
        </div>
        <div className="h-80 rounded-2xl border border-slate-200/80 bg-white p-5 lg:col-span-6">
          <div className="h-4 w-40 rounded bg-slate-200" />
          <div className="mt-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 rounded-xl bg-slate-100" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
