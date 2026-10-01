import type { ReactNode, SVGProps } from 'react'

export type IconName =
  | 'home'
  | 'list'
  | 'plus'
  | 'more'
  | 'arrow-up'
  | 'arrow-down'
  | 'chevron-right'
  | 'backspace'
  | 'eye'
  | 'eye-off'
  | 'refresh'
  | 'bell'
  | 'lock'
  | 'close'
  | 'clock'
  | 'trend'
  | 'chevron-left'
  | 'chevron-down'
  | 'arrow-left'
  | 'arrow-right'
  | 'check'
  | 'user'
  | 'filter'
  | 'calculator'
  | 'share'
  | 'download'
  | 'calendar'
  | 'search'
  | 'transport'
  | 'leisure'
  | 'loan'
  | 'jar'
  | 'edit'
  | 'subscription'
  | 'work'
  | 'store'
  | 'bag'
  | 'scholarship'

const PATHS: Record<IconName, ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  list: (
    <>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  more: (
    <>
      <circle cx="5.5" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  'arrow-up': <path d="M12 19V5M5 12l7-7 7 7" />,
  'arrow-down': <path d="M12 5v14M19 12l-7 7-7-7" />,
  'chevron-right': <path d="m9 6 6 6-6 6" />,
  backspace: (
    <>
      <path d="M21 5H9l-6 7 6 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z" />
      <path d="m13 9 5 6M18 9l-5 6" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  'eye-off': (
    <>
      <path d="M3 3l18 18" />
      <path d="M10.6 5.1A9.7 9.7 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.1 4M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 4.4-1" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11a8 8 0 0 0-14.9-3M4 5v4h4" />
      <path d="M4 13a8 8 0 0 0 14.9 3M20 19v-4h-4" />
    </>
  ),
  bell: (
    <>
      <path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="10.5" width="16" height="10" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  trend: <path d="m3 17 6-6 4 4 8-8M15 7h6v6" />,
  'chevron-left': <path d="m15 6-6 6 6 6" />,
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  'arrow-left': <path d="M19 12H5M12 5l-7 7 7 7" />,
  'arrow-right': <path d="M5 12h14M12 5l7 7-7 7" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  calculator: (
    <>
      <rect x="5" y="3.5" width="14" height="17" rx="2.5" />
      <path d="M8.5 7.5h7M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01" />
    </>
  ),
  share: (
    <>
      <path d="M12 15V4M8 7.5 12 3.5l4 4" />
      <path d="M6 11H5.5A1.5 1.5 0 0 0 4 12.5v6A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5v-6a1.5 1.5 0 0 0-1.5-1.5H18" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v11M8 11.5l4 4 4-4" />
      <path d="M5 19.5h14" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  /* Tres líneas horizontales de largo decreciente (ordenar/filtrar). */
  filter: <path d="M4 7h16M7 12h10M10 17h4" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  transport: (
    <>
      <rect x="4.5" y="3.5" width="15" height="14" rx="3" />
      <path d="M4.5 11h15M7.5 17.5v2.5M16.5 17.5v2.5" />
      <path d="M8.5 14h.01M15.5 14h.01" />
    </>
  ),
  leisure: (
    <>
      <path d="M3.5 8.5a1 1 0 0 1 1-1h15a1 1 0 0 1 1 1V10a2 2 0 0 0 0 4v1.5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1V14a2 2 0 0 0 0-4z" />
      <path d="M14.5 7.5v1.5M14.5 11.25v1.5M14.5 15v1.5" />
    </>
  ),
  loan: (
    <>
      <ellipse cx="12" cy="6.5" rx="6.5" ry="2.75" />
      <path d="M5.5 6.5v5c0 1.5 2.9 2.75 6.5 2.75s6.5-1.25 6.5-2.75v-5" />
      <path d="M5.5 11.5v5c0 1.5 2.9 2.75 6.5 2.75s6.5-1.25 6.5-2.75v-5" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z" />
      <path d="m14.5 7.5 3 3" />
    </>
  ),
  jar: (
    <>
      <rect x="8" y="3.5" width="8" height="3" rx="1" />
      <path d="M9 6.5v1.2c0 .8-2.5 1.6-2.5 3.3V19a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5v-8c0-1.7-2.5-2.5-2.5-3.3V6.5" />
      <path d="M6.7 13.5c1.7-.9 3.3.9 5.3 0s3.3.9 5.3 0" />
    </>
  ),
  subscription: (
    <>
      <rect x="3.5" y="5" width="17" height="11.5" rx="2" />
      <path d="M8.5 20h7M12 16.5V20" />
    </>
  ),
  work: (
    <>
      <rect x="3.5" y="7.5" width="17" height="12" rx="2" />
      <path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5M3.5 13h17" />
    </>
  ),
  store: (
    <>
      <path d="m4 9.5 1.2-5h13.6l1.2 5" />
      <path d="M4 9.5a2.67 2.67 0 0 0 5.33 0 2.67 2.67 0 0 0 5.34 0 2.67 2.67 0 0 0 5.33 0" />
      <path d="M5.5 12.5v7h13v-7" />
    </>
  ),
  bag: (
    <>
      <path d="M6 8.5h12l1 11H5z" />
      <path d="M9 8.5V7a3 3 0 0 1 6 0v1.5" />
    </>
  ),
  scholarship: (
    <>
      <path d="m2.5 9.5 9.5-4.5 9.5 4.5-9.5 4.5z" />
      <path d="M6.5 11.5V16c0 1.2 2.5 2.5 5.5 2.5s5.5-1.3 5.5-2.5v-4.5M21.5 9.5V14" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
    </>
  ),
}

export type IconSize = 'sm' | 'md' | 'lg'

/** Tamaños y trazo salen de tokens (--icon-size-*, --icon-stroke). */
interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name' | 'size'> {
  name: IconName
  size?: IconSize
}

/** Íconos monolínea (24×24), un solo trazo, color heredado. Decorativos por defecto. */
export function Icon({ name, size = 'md', className, style, ...rest }: IconProps) {
  const px = `var(--icon-size-${size})`
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="var(--icon-stroke)"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ width: px, height: px, flexShrink: 0, ...style }}
      {...rest}
    >
      {PATHS[name]}
    </svg>
  )
}
