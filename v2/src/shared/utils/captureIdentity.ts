import type { CardBase } from '@/shared/models'

const CAPTURE_FIELD_KEYS = ['captureInboxId', 'capture_inbox_id'] as const

type CaptureLinkedCard = Pick<CardBase, 'sourceCaptureId' | 'customFields'> & { deletedAt?: number }

/** 单一读取口径：新数据读 sourceCaptureId，V4.1.0 旧导入读 customFields。 */
export function captureIdOfCard(card: CaptureLinkedCard | null | undefined): string {
  if (!card) return ''
  const direct = String(card.sourceCaptureId || '').trim()
  if (direct) return direct
  for (const key of CAPTURE_FIELD_KEYS) {
    const value = String(card.customFields?.[key] || '').trim()
    if (value) return value
  }
  return ''
}

export function cardMatchesCaptureId(card: CaptureLinkedCard | null | undefined, captureId: string): boolean {
  const wanted = String(captureId || '').trim()
  if (!wanted || !card) return false
  if (String(card.sourceCaptureId || '').trim() === wanted) return true
  return CAPTURE_FIELD_KEYS.some(key => String(card.customFields?.[key] || '').trim() === wanted)
}

/** 补齐新旧两代溯源字段；返回是否发生变化。 */
export function ensureCaptureIdentity(card: CardBase, captureId: string): boolean {
  const wanted = String(captureId || '').trim()
  if (!wanted) return false
  let changed = false
  if (card.sourceCaptureId !== wanted) {
    card.sourceCaptureId = wanted
    changed = true
  }
  if (!card.customFields) card.customFields = {}
  if (String(card.customFields.captureInboxId || '').trim() !== wanted) {
    card.customFields.captureInboxId = wanted
    changed = true
  }
  return changed
}
