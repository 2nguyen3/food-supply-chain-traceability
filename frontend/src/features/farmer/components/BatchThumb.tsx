import { useEffect, useState } from 'react'
import { loadBatchImage } from '../services/farmerChain'
import { FarmerOverviewIcon } from './FarmerOverviewIcon'

/** Ảnh thu nhỏ của lô lấy từ metadata trên IPFS; chưa tải được thì hiện khung trống. */
export function BatchThumb({ metadataCid, alt }: { metadataCid: string; alt: string }) {
  const [url, setUrl] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    let active = true
    void loadBatchImage(metadataCid).then((value) => {
      if (active) setUrl(value)
    })
    return () => {
      active = false
    }
  }, [metadataCid])
  if (url) return <img src={url} alt={alt} loading="lazy" />
  return (
    <span className="farmer-batch-thumb-empty" aria-hidden="true">
      <FarmerOverviewIcon name="box" />
    </span>
  )
}
