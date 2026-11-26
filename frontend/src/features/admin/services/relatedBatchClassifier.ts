/**
 * COCOmark TEST 04 — classify batches related to an incident.
 *
 * A match means only "candidate for investigation", NEVER proof of contamination.
 * No recall side effects, RPC calls, wallet access, or on-chain writes.
 */
export interface RelatedBatchIdentity {
  tokenId: string
  farmId: string
  harvestGroupId: string
}

export interface RelatedBatchGroups<T extends RelatedBatchIdentity> {
  /** Same farmId AND harvestGroupId; requires further investigation. */
  related: T[]
  /** Same farmId, different harvestGroupId; comparison/control group. */
  sameFarmOtherGroup: T[]
  /** Different farmId; comparison/control group. */
  otherFarm: T[]
}

export function classifyRelatedBatches<T extends RelatedBatchIdentity>(
  incidentBatch: T,
  batches: readonly T[],
): RelatedBatchGroups<T> {
  const related: T[] = []
  const sameFarmOtherGroup: T[] = []
  const otherFarm: T[] = []

  for (const entry of batches) {
    if (entry.tokenId === incidentBatch.tokenId) continue
    if (entry.farmId !== incidentBatch.farmId) {
      otherFarm.push(entry)
    } else if (entry.harvestGroupId === incidentBatch.harvestGroupId) {
      related.push(entry)
    } else {
      sameFarmOtherGroup.push(entry)
    }
  }

  return { related, sameFarmOtherGroup, otherFarm }
}
