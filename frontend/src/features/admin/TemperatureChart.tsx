import { useEffect, useRef, useState } from 'react'
import type { TemperatureReading } from './batchFixtures'

// Vẽ đúng 1:1 theo bề rộng container: chữ/nhãn giữ nguyên kích cỡ px,
// không bị scale phóng to khi card rộng (nguyên nhân tràn chữ cũ).
export function TemperatureChart({
  readings,
  min,
  max,
}: {
  readings: TemperatureReading[]
  min: number
  max: number
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(480)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const update = () => setWidth(Math.max(300, Math.round(el.clientWidth)))
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const height = width >= 520 ? 280 : 220
  const compact = width < 520
  const padLeft = 44
  const padRight = 18
  const padTop = compact ? 28 : 34
  const padBottom = compact ? 40 : 52
  const maxY = 20

  // Nhãn ngưỡng ở phía trên-phải dải xanh (theo thiết kế gốc);
  // khoảng cách nhãn point #4 được bù bằng offset riêng cho kích thước gọn.
  const bandLabelX = width - padRight
  const bandLabelY = yAt(max) - 16

  return (
    <div className="temp-chart-wrap" ref={wrapRef}>
      <svg
        className="temp-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Biểu đồ nhiệt độ theo thời gian"
      >
        <rect
          x={padLeft}
          y={yAt(max)}
          width={Math.max(0, width - padLeft - padRight)}
          height={Math.max(0, yAt(min) - yAt(max))}
          fill="#e3efdc"
        />
        <text x={bandLabelX} y={bandLabelY} textAnchor="end" className="temp-band-label">
          Ngưỡng {min}–{max}°C
        </text>

        {[4, 8, 12, 16, 20].map((tick) => (
          <g key={tick}>
            <line
              x1={padLeft}
              x2={width - padRight}
              y1={yAt(tick)}
              y2={yAt(tick)}
              stroke="#e8e4d8"
              strokeWidth="1"
            />
            <text x={padLeft - 8} y={yAt(tick) + 5} textAnchor="end" className="temp-axis-label">
              {tick}°
            </text>
          </g>
        ))}

        <polyline
          points={points()}
          fill="none"
          stroke="#2d6a4f"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {readings.map((reading, index) => {
          const x = xAt(index)
          const y = yAt(reading.temperatureC)
          // Điểm đầu/cuối neo nhãn vào trong để không đè trục y hay bị cắt mép.
          const valueAnchor =
            index === 0 ? 'start' : index === readings.length - 1 ? 'end' : 'middle'
          const valueX = index === 0 ? x + 7 : index === readings.length - 1 ? x - 7 : x
          const labelY = reading.over ? y - 17 : y - 14
          return (
            <g key={reading.id}>
              {reading.over ? (
                <path
                  d={`M ${x} ${y - 8} L ${x + 8} ${y + 6} L ${x - 8} ${y + 6} Z`}
                  fill="#b42318"
                />
              ) : (
                <circle
                  cx={x}
                  cy={y}
                  r={compact ? 4.5 : 5.5}
                  fill="#fff"
                  stroke="#2d6a4f"
                  strokeWidth={2.5}
                />
              )}
              <text
                x={valueX}
                y={labelY}
                textAnchor={valueAnchor}
                className={reading.over ? 'temp-value over' : 'temp-value'}
              >
                {reading.temperatureC}°C
              </text>
              <text x={x} y={height - 10} textAnchor="middle" className="temp-axis-label">
                #{reading.id}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )

  function xAt(index: number) {
    const span = Math.max(readings.length - 1, 1)
    const step = (width - padLeft - padRight) / span
    return Math.round(padLeft + index * step)
  }

  function yAt(value: number) {
    return padTop + ((maxY - value) / maxY) * (height - padTop - padBottom)
  }

  function points() {
    return readings
      .map((reading, index) => `${xAt(index)},${Math.round(yAt(reading.temperatureC))}`)
      .join(' ')
  }
}
