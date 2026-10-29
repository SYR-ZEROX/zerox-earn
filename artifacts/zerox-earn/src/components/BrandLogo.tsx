type BrandLogoProps = {
  compact?: boolean;
  className?: string;
};

export function BrandLogo({ compact = false, className = "" }: BrandLogoProps) {
  return (
    <div className={`brand-lockup ${compact ? "brand-lockup-compact" : ""} ${className}`}>
      <img 
        src="/logo.jpg" 
        alt="ZEROX EARN" 
        style={{ 
          height: compact ? '32px' : '45px', 
          width: 'auto',
          objectFit: 'contain'
        }} 
      />
    </div>
  );
}
