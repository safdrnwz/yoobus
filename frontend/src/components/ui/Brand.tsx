import type { CSSProperties } from 'react';

const RED = '#E11D2A';

/** The YooBus bus logo mark — a red rounded badge with a friendly bus. */
export function BusMark({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 40 40" className={className} style={style} role="img" aria-label="YooBus" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="11" fill={RED} />
      {/* bus body */}
      <rect x="8" y="11" width="24" height="15" rx="3.5" fill="#ffffff" />
      {/* windscreen + windows */}
      <rect x="10.5" y="13.5" width="6" height="4.5" rx="1.2" fill={RED} opacity="0.9" />
      <rect x="18" y="13.5" width="6" height="4.5" rx="1.2" fill={RED} opacity="0.9" />
      <rect x="25.5" y="13.5" width="4.2" height="4.5" rx="1.2" fill={RED} opacity="0.9" />
      {/* lower trim */}
      <rect x="10.5" y="20.5" width="19" height="2" rx="1" fill={RED} opacity="0.25" />
      {/* headlight */}
      <circle cx="30.4" cy="24" r="1.1" fill="#FFD34E" />
      {/* wheels */}
      <circle cx="14.5" cy="27.5" r="2.7" fill="#15161a" />
      <circle cx="14.5" cy="27.5" r="1.1" fill="#ffffff" />
      <circle cx="25.5" cy="27.5" r="2.7" fill="#15161a" />
      <circle cx="25.5" cy="27.5" r="1.1" fill="#ffffff" />
    </svg>
  );
}

type BrandTone = 'default' | 'onDark' | 'inherit';
type BrandSize = 'sm' | 'md' | 'lg';

const TEXT: Record<BrandSize, string> = { sm: 'text-step-0', md: 'text-step-1', lg: 'text-step-3' };
const ICON: Record<BrandSize, string> = { sm: 'h-6 w-6', md: 'h-8 w-8', lg: 'h-10 w-10' };

/**
 * The YooBus wordmark: "Yoo" in black, "Bus" in red — always, everywhere.
 * `tone="onDark"` lightens "Yoo" for dark surfaces; `tone="inherit"` lets it take the parent colour.
 */
export function Brand({
  size = 'md',
  tone = 'default',
  showMark = true,
  className,
}: {
  size?: BrandSize;
  tone?: BrandTone;
  showMark?: boolean;
  className?: string;
}) {
  const yoo = tone === 'onDark' ? 'text-white' : tone === 'inherit' ? 'text-current' : 'text-ink';
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ''}`}>
      {showMark && <BusMark className={`${ICON[size]} shrink-0`} />}
      <span className={`font-display font-extrabold tracking-tight leading-none ${TEXT[size]}`}>
        <span className={yoo}>Yoo</span>
        <span style={{ color: RED }}>Bus</span>
      </span>
    </span>
  );
}
