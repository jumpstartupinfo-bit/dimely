interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg'
  variant?: 'full' | 'icon'
  dark?: boolean
}

export function Logo({ size = 'md', variant = 'full', dark = false }: LogoProps) {
  const dims = { xs: 28, sm: 32, md: 40, lg: 52 }
  const textCls = {
    xs: 'text-base',
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-3xl',
  }
  const px = dims[size]

  return (
    <div className="flex items-center gap-2.5 select-none">
      {/* Icon — rounded-square with blue→indigo gradient, white D + play triangle */}
      <svg
        width={px}
        height={px}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        <defs>
          <linearGradient id="dg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7C83F7" />
            <stop offset="100%" stopColor="#5B5FF5" />
          </linearGradient>
        </defs>
        {/* Rounded square background */}
        <rect width="48" height="48" rx="13" fill="url(#dg)" />
        {/* White D shape */}
        <path
          d="M14 11h11.5C31.9 11 37 16.4 37 24s-5.1 13-11.5 13H14V11z"
          fill="white"
        />
        {/* Inner cutout — creates the D counter */}
        <path
          d="M19.5 16.5h5.2C28 16.5 30.5 19.7 30.5 24s-2.5 7.5-5.8 7.5h-5.2V16.5z"
          fill="url(#dg)"
        />
        {/* Play triangle inside the counter */}
        <path
          d="M22 21.2l5 2.8-5 2.8V21.2z"
          fill="white"
          opacity="0.9"
        />
      </svg>

      {variant === 'full' && (
        <span
          className={`font-bold tracking-tight ${textCls[size]} ${dark ? 'text-white' : 'text-[#0F172A]'}`}
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            letterSpacing: '-0.025em',
          }}
        >
          Dimely
        </span>
      )}
    </div>
  )
}
