const paths = {
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  box: 'M21 8l-9-5-9 5v8l9 5 9-5V8zM3 8l9 5 9-5M12 13v8',
  users:
    'M9 11a4 4 0 100-8 4 4 0 000 8zM2 21v-1a6 6 0 0112 0v1M17 4a4 4 0 010 7M22 21v-1a6 6 0 00-4-5.6',
  map: 'M12 21s7-6 7-12a7 7 0 10-14 0c0 6 7 12 7 12zM12 11a2 2 0 100-4 2 2 0 000 4z',
  flag: 'M5 21V4M5 4h12l-2 4 2 4H5',
  download: 'M12 4v11M7 11l5 5 5-5M5 20h14',
  plus: 'M12 5v14M5 12h14',
  route:
    'M6 19a2 2 0 100-4 2 2 0 000 4zM18 9a2 2 0 100-4 2 2 0 000 4zM8 17h7a3 3 0 000-6H9a3 3 0 010-6h7',
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-5-5',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3zM9 12l2 2 4-4',
  leaf: 'M5 19C5 9 11 4 20 4c0 9-5 15-15 15zM5 19l8-8',
  truck:
    'M2 6h11v10H2zM13 9h4l4 4v3h-8M6 19a2 2 0 100-4 2 2 0 000 4zM17 19a2 2 0 100-4 2 2 0 000 4z',
  store: 'M3 9l1-5h16l1 5M3 9a3 3 0 006 0 3 3 0 006 0 3 3 0 006 0M5 12v8h14v-8M10 20v-5h4v5',
  wallet: 'M3 7a2 2 0 012-2h13v4M3 7v11a2 2 0 002 2h15V9H5a2 2 0 01-2-2zM16 14h2',
  copy: 'M9 9h11v11H9zM5 15V4h11',
  check: 'M4 12l5 5L20 6',
  bell: 'M6 8a6 6 0 1112 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 004 0',
  logout: 'M9 4H5v16h4M16 8l4 4-4 4M20 12H9',
  menu: 'M4 6h16M4 12h16M4 18h16',
} as const

export type DashboardIconName = keyof typeof paths

export function DashboardIcon({
  name,
  className = '',
}: {
  name: DashboardIconName
  className?: string
}) {
  return (
    <svg
      className={`dashboard-icon ${className}`}
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
