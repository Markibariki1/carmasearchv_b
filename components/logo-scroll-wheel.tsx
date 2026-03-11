"use client"
/* eslint-disable @next/next/no-img-element */

import { useMemo } from 'react'

interface LogoItem {
  src: string
  alt: string
  href?: string
  /** Tailwind h-* class to override default logo height, e.g. "h-8" or "h-14" */
  heightClass?: string
}

interface LogoScrollWheelProps {
  logos: LogoItem[]
  invert?: boolean
}

// 4 copies ensures the seam is always off-screen regardless of viewport width
const COPIES = 4

export function LogoScrollWheel({ logos, invert = true }: LogoScrollWheelProps) {
  const marqueeItems = useMemo(() => {
    if (!logos || logos.length === 0) return []
    return Array.from({ length: COPIES }, () => logos).flat()
  }, [logos])

  const translateEnd = `-${(100 / COPIES).toFixed(4)}%`

  return (
    <div className="overflow-hidden py-8">
      <div
        className="flex items-center gap-12"
        style={{
          width: 'max-content',
          animation: `carma-marquee 30s linear infinite`,
          ['--translate-end' as string]: translateEnd,
        }}
      >
        {marqueeItems.map((logo, index) => {
          const heightClass = logo.heightClass ?? 'h-10'
          const img = (
            <img
              src={logo.src}
              alt={logo.alt}
              className={`w-auto ${heightClass} object-contain ${invert ? 'filter brightness-0 invert' : ''}`}
            />
          )

          return (
            <div
              key={`${logo.src}-${index}`}
              className="flex-shrink-0 flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity duration-300"
            >
              {logo.href ? (
                <a href={logo.href} target="_blank" rel="noopener noreferrer">
                  {img}
                </a>
              ) : img}
            </div>
          )
        })}
      </div>

      <style jsx global>{`
        @keyframes carma-marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(var(--translate-end)); }
        }
      `}</style>
    </div>
  )
}
