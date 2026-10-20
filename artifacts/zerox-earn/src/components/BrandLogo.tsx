type BrandLogoProps = {
  compact?: boolean;
  className?: string;
};

export function BrandLogo({ compact = false, className = "" }: BrandLogoProps) {
  return (
    <div className={`brand-lockup ${compact ? "brand-lockup-compact" : ""} ${className}`}>
      <svg
        aria-hidden="true"
        className="brand-mark"
        viewBox="0 0 52 52"
        fill="none"
      >
        <path
          d="M14 5.5h20L46 17v18L34 46.5H14L3 35V17L14 5.5Z"
          stroke="url(#zx-shell)"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path
          d="m15 15 10.5 10.5L15 36M37 15 26.5 25.5 37 36"
          stroke="#00E676"
          strokeWidth="4"
          strokeLinecap="square"
          strokeLinejoin="round"
        />
        <path
          d="m26 11-4 7m8 16-4 7"
          stroke="#7C3AED"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx="25.5" cy="25.5" r="2.5" fill="#F8FAFC" />
        <defs>
          <linearGradient id="zx-shell" x1="3" y1="5.5" x2="47" y2="46.5" gradientUnits="userSpaceOnUse">
            <stop stopColor="#00E676" />
            <stop offset="1" stopColor="#7C3AED" />
          </linearGradient>
        </defs>
      </svg>
      {!compact && (
        <span className="brand-wordmark">
          <strong>ZEROX</strong>
          <span>EARN</span>
        </span>
      )}
    </div>
  );
}
