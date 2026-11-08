import type { ReactNode } from 'react'
import { explorerUrl } from '../../../config/env'

/** Liên kết tới block explorer (Etherscan trên Sepolia); trên mạng local chỉ hiện chữ. */
export function ExplorerLink({
  kind,
  value,
  children,
  className = 'mono',
}: {
  kind: 'tx' | 'address'
  value: string
  children?: ReactNode
  className?: string
}) {
  const href = explorerUrl(kind, value)
  const text = children ?? value
  if (!href) return <span className={className}>{text}</span>
  return (
    <a
      className={`trace-explorer-link ${className}`}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={`Mở trên Etherscan: ${value}`}
    >
      {text}
    </a>
  )
}
