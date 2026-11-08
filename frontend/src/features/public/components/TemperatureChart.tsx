import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DemoBatch, DemoReading } from '../mocks/traceDetailFixtures'

const FOREST = '#2d6a4f'
const DANGER = '#b42318'
const MUTED = '#6b5a44'
const LINE = '#e6e1d3'

type Point = DemoReading & { label: string; out: boolean }

const formatTime = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value))

function Dot(props: { cx?: number; cy?: number; payload?: Point }) {
  const { cx, cy, payload } = props
  if (cx === undefined || cy === undefined || !payload) return null
  if (payload.out) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={11} fill={DANGER} opacity={0.15} />
        <circle cx={cx} cy={cy} r={6} fill={DANGER} stroke="#fff" strokeWidth={2} />
      </g>
    )
  }
  return <circle cx={cx} cy={cy} r={5} fill="#fff" stroke={FOREST} strokeWidth={2.5} />
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { payload: Point }[]
}) {
  const point = active ? payload?.[0]?.payload : undefined
  if (!point) return null
  return (
    <div className="trace-chart-tooltip">
      <strong className={point.out ? 'is-out' : undefined}>{point.temperatureC.toFixed(1)}°C</strong>
      <span>Bản ghi {point.label}</span>
      <span>{formatTime(point.observedAt)}</span>
      {point.location && <span>{point.location}</span>}
      {point.out && <em>Ngoài ngưỡng cho phép</em>}
    </div>
  )
}

export default function TemperatureChart({ batch }: { batch: DemoBatch }) {
  const { minTemperatureC: min, maxTemperatureC: max } = batch
  const data: Point[] = batch.readings.map((reading) => ({
    ...reading,
    label: `#${reading.id}`,
    out:
      (min !== undefined && reading.temperatureC < min) ||
      (max !== undefined && reading.temperatureC > max),
  }))
  const temps = data.map((point) => point.temperatureC)
  const low = Math.floor(Math.min(min ?? Infinity, ...temps) - 3)
  const high = Math.ceil(Math.max(max ?? -Infinity, ...temps) + 3)
  const hasRange = min !== undefined && max !== undefined

  return (
    <figure
      className="trace-chart"
      role="img"
      aria-label={`Biểu đồ nhiệt độ vận chuyển: ${data.map((point) => `${point.temperatureC} độ C`).join(', ')}`}
    >
      <ResponsiveContainer width="100%" height={300} minWidth={0}>
        <AreaChart data={data} margin={{ top: 28, right: 24, bottom: 4, left: 0 }}>
          <defs>
            <linearGradient id="trace-chart-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={FOREST} stopOpacity={0.35} />
              <stop offset="100%" stopColor={FOREST} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={LINE} strokeDasharray="3 4" vertical={false} />
          {hasRange && (
            <ReferenceArea y1={min} y2={max} fill="#d8e8d1" fillOpacity={0.7} ifOverflow="extendDomain" />
          )}
          {hasRange && (
            <ReferenceLine
              y={max}
              stroke={FOREST}
              strokeDasharray="5 4"
              strokeOpacity={0.7}
              label={{
                value: `Ngưỡng ${min}–${max}°C`,
                position: 'insideTopRight',
                fill: '#235640',
                fontSize: 12,
                fontWeight: 600,
              }}
            />
          )}
          {hasRange && (
            <ReferenceLine y={min} stroke={FOREST} strokeDasharray="5 4" strokeOpacity={0.7} />
          )}
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: LINE }}
            tick={{ fill: MUTED, fontSize: 12 }}
            padding={{ left: 24, right: 24 }}
          />
          <YAxis
            domain={[low, high]}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(value: number) => `${value}°`}
            tick={{ fill: MUTED, fontSize: 12 }}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: FOREST, strokeOpacity: 0.25 }} />
          <Area
            type="monotone"
            dataKey="temperatureC"
            stroke={FOREST}
            strokeWidth={3}
            fill="url(#trace-chart-fill)"
            dot={<Dot />}
            activeDot={{ r: 7, stroke: '#fff', strokeWidth: 2 }}
            isAnimationActive
            animationDuration={700}
          />
        </AreaChart>
      </ResponsiveContainer>
    </figure>
  )
}
