import { useId } from 'react'

interface FlagProps {
  size?: number
}

const RING = 'rgb(17 19 17 / 0.12)'

/** Bandera de Argentina en círculo (identifica la moneda/cuenta ARS). Decorativa. */
export function FlagAR({ size = 22 }: FlagProps) {
  const clip = useId()
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="shrink-0">
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
      <circle cx="12" cy="12" r="11.75" fill="none" stroke={RING} strokeWidth="0.5" />
    </svg>
  )
}

/** Bandera de Estados Unidos en círculo (USD). Decorativa. */
export function FlagUS({ size = 22 }: FlagProps) {
  const clip = useId()
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="shrink-0">
      <defs>
        <clipPath id={clip}>
          <circle cx="12" cy="12" r="12" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect width="24" height="24" fill="#ffffff" />
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <rect key={i} y={i * 3.7} width="24" height="1.85" fill="#c8323c" />
        ))}
        <rect width="12" height="12.9" fill="#2b3f86" />
        {[3, 6, 9].flatMap((y) => [3, 6, 9].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="0.6" fill="#ffffff" />))}
      </g>
      <circle cx="12" cy="12" r="11.75" fill="none" stroke={RING} strokeWidth="0.5" />
    </svg>
  )
}

export function Flag({ country, size }: { country: 'AR' | 'US'; size?: number }) {
  return country === 'US' ? <FlagUS {...(size ? { size } : {})} /> : <FlagAR {...(size ? { size } : {})} />
}
