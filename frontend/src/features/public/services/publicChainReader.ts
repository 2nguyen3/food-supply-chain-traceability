import { getAddress, isAddress, JsonRpcProvider } from 'ethers'
import { config } from '../../../config/env'

export interface ProductionTraceIdentity {
  chainId: '11155111'
  contractAddress: `0x${string}`
  tokenId: string
}

export type TraceParameterError = 'chainId' | 'network' | 'contractAddress' | 'tokenId'

export function parseProductionTraceParams(
  chainId?: string,
  contractAddress?: string,
  tokenId?: string,
):
  | { identity: ProductionTraceIdentity; error?: never }
  | { identity?: never; error: TraceParameterError } {
  if (!chainId || !/^\d+$/.test(chainId)) return { error: 'chainId' }
  if (BigInt(chainId) !== 11155111n) return { error: 'network' }
  if (!contractAddress || !isAddress(contractAddress)) return { error: 'contractAddress' }
  if (!tokenId || !/^\d+$/.test(tokenId)) return { error: 'tokenId' }

  return {
    identity: {
      chainId: '11155111',
      contractAddress: getAddress(contractAddress) as `0x${string}`,
      tokenId: BigInt(tokenId).toString(),
    },
  }
}

export type PublicReadStatus =
  | { kind: 'unconfigured'; missing: string[] }
  | { kind: 'unsupportedContract' }
  | { kind: 'wrongNetwork' }
  | { kind: 'rpcTimeout' }
  | { kind: 'rpcUnavailable' }
  | { kind: 'contractMissing' }
  | { kind: 'abiMissing' }
  | { kind: 'tokenMissing' }
  | { kind: 'metadataUnavailable' }
  | { kind: 'ipfsUnavailable' }
  | { kind: 'partialData' }
  | { kind: 'hashMismatch' }

async function withDeadline<T>(
  work: Promise<T>,
  signal: AbortSignal,
  timeoutMs = 8000,
): Promise<T> {
  if (signal.aborted) throw new DOMException('Đã hủy', 'AbortError')
  let timer: ReturnType<typeof setTimeout> | undefined
  let onAbort: (() => void) | undefined
  try {
    return await Promise.race([
      work,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('RPC_TIMEOUT')), timeoutMs)
      }),
      new Promise<T>((_, reject) => {
        onAbort = () => reject(new DOMException('Đã hủy', 'AbortError'))
        signal.addEventListener('abort', onAbort, { once: true })
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
    if (onAbort) signal.removeEventListener('abort', onAbort)
  }
}

function validRpcUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export async function inspectPublicChain(
  identity: ProductionTraceIdentity,
  signal: AbortSignal,
): Promise<PublicReadStatus> {
  const missing: string[] = []
  if (config.chainId !== 11155111) missing.push('VITE_CHAIN_ID=11155111')
  if (!config.publicRpcUrl || !validRpcUrl(config.publicRpcUrl)) missing.push('VITE_PUBLIC_RPC_URL')
  if (!config.contractAddress || !isAddress(config.contractAddress))
    missing.push('VITE_CONTRACT_ADDRESS')
  if (missing.length) return { kind: 'unconfigured', missing }

  if (getAddress(config.contractAddress!) !== identity.contractAddress)
    return { kind: 'unsupportedContract' }

  const provider = new JsonRpcProvider(config.publicRpcUrl)
  try {
    const network = await withDeadline(provider.getNetwork(), signal)
    if (network.chainId !== 11155111n) return { kind: 'wrongNetwork' }

    const code = await withDeadline(provider.getCode(identity.contractAddress), signal)
    if (code === '0x') return { kind: 'contractMissing' }

    // COCOMARK contract ABI and deployment artifacts are absent from this repository.
    // Do not infer methods from the domain interfaces or the unrelated Counter contract.
    return { kind: 'abiMissing' }
  } catch (error) {
    if (signal.aborted) throw error
    if (error instanceof Error && error.message === 'RPC_TIMEOUT') return { kind: 'rpcTimeout' }
    return { kind: 'rpcUnavailable' }
  } finally {
    provider.destroy()
  }
}
