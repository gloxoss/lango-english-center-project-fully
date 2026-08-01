'use client';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'danger' | 'warning' | 'info' | 'neutral' | 'signal';
  className?: string;
}

export function Badge({ children, variant = 'neutral', className = '' }: BadgeProps) {
  const variantStyles = {
    success: 'bg-[#E4EDFD] text-[#2487B8] border-[#C3DAFB]',
    danger: 'bg-[#FCE4E2] text-[#E5544B] border-[#F8C4C1]',
    warning: 'bg-[#FCF0DC] text-[#E8A33D] border-[#F7DFB6]',
    info: 'bg-[#E4EDFD] text-[#2487B8] border-[#C3DAFB]',
    signal: 'bg-[#0EA5C4]/10 text-[#0EA5C4] border-[#0EA5C4]/30',
    neutral: 'bg-[#EDF3F8] text-[#16212B] border-slate-300',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
