const paths = {
  box: 'M21 8l-9-5-9 5v8l9 5 9-5V8zM3 8l9 5 9-5M12 13v8',
  wallet: 'M3 7a2 2 0 012-2h13v4M3 7v11a2 2 0 002 2h15V9H5a2 2 0 01-2-2zM16 14h2',
  route:
    'M6 19a2 2 0 100-4 2 2 0 000 4zM18 9a2 2 0 100-4 2 2 0 000 4zM8 17h7a3 3 0 000-6H9a3 3 0 010-6h7',
  check: 'M4 12l5 5L20 6',
  plus: 'M12 5v14M5 12h14',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  clock: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2',
  leaf: 'M5 19C5 9 11 4 20 4c0 9-5 15-15 15zM5 19l8-8',
  lock: 'M6 11h12v9H6zM9 11V8a3 3 0 016 0v3',
} as const

export type FarmerOverviewIconName = keyof typeof paths

export function FarmerOverviewIcon({ name }: { name: FarmerOverviewIconName }) {
  return (
    <svg
      className="farmer-overview-icon"
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
