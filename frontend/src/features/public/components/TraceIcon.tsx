const paths = {
  route:
    'M6 19a2 2 0 100-4 2 2 0 000 4zM18 9a2 2 0 100-4 2 2 0 000 4zM8 17h7a3 3 0 000-6H9a3 3 0 010-6h7',
  thermo: 'M10 14V5a2 2 0 114 0v9a4 4 0 11-4 0z',
  hash: 'M5 9h14M5 15h14M10 4L8 20M16 4l-2 16',
  file: 'M6 3h8l5 5v13H6zM14 3v5h5M9 13h6M9 17h6',
  image: 'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M9 9h.01',
  json: 'M8 4c-2 0-3 1-3 3v2c0 1-1 3-2 3 1 0 2 2 2 3v2c0 2 1 3 3 3M16 4c2 0 3 1 3 3v2c0 1 1 3 2 3-1 0-2 2-2 3v2c0 2-1 3-3 3',
  link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
  leaf: 'M5 19C5 9 11 4 20 4c0 9-5 15-15 15zM5 19l8-8',
  store: 'M3 9l1-5h16l1 5M3 9a3 3 0 006 0 3 3 0 006 0 3 3 0 006 0M5 12v8h14v-8M10 20v-5h4v5',
  flag: 'M5 21V4M5 4h12l-2 4 2 4H5',
  warn: 'M12 9v4M12 17h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  down: 'M6 9l6 6 6-6',
  copy: 'M9 9h11v11H9zM5 15V4h11',
  download: 'M12 4v11M7 11l5 5 5-5M5 20h14',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  info: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 11v6M12 7.5h.01',
  check: 'M4 12l5 5L20 6',
} as const

export type TraceIconName = keyof typeof paths

export function TraceIcon({ name, className = '' }: { name: TraceIconName; className?: string }) {
  return (
    <svg
      className={`trace-icon ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  )
}
