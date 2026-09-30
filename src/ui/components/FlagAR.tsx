import { useId } from 'react'

/** Bandera de Argentina en círculo (identifica la moneda/cuenta ARS). Decorativa. */
export function FlagAR({ size = 22 }: { size?: number }) {
  const clip = useId()
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className="shrink-0"
    >
      <defs>
        <clipPath id={clip}>
          <circle cx="12" cy="12" r="12" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect width="24" height="24" fill="#74acdf" />
        <rect y="8" width="24" height="8" fill="#ffffff" />
        <circle cx="12" cy="12" r="2.1" fill="#f6b40e" />
      </g>
      <circle cx="12" cy="12" r="11.75" fill="none" stroke="rgb(255 255 255 / 0.25)" strokeWidth="0.5" />
    </svg>
  )
}
