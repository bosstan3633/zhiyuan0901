/** 同步清单与回执行共用的稳定序列化 / 指纹，避免两处算法漂移。 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(item => stableStringify(item)).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`
}

export function fallbackHash(input: string): string {
  let h1 = 0x811c9dc5
  let h2 = 0x9e3779b9
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i)
    h1 ^= code
    h1 = Math.imul(h1, 0x01000193)
    h2 ^= code + i
    h2 = Math.imul(h2, 0x85ebca6b)
  }
  return `fnv:${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`
}

/** 与同步清单一致的对象指纹；回执行操作前用它复核记录是否再次变化。 */
export function syncRecordDigest(value: unknown): string {
  return fallbackHash(stableStringify(value))
}
