/**
 * 第卌二轮 REQ-059：零依赖 zip 读写工具（附件包导出/导入）
 *
 * 设计：STORE 模式（不压缩）——附件本体是图片/HTML，压缩收益趋近于零，
 * 换来 ~150 行无依赖实现与极速打包。CRC32 保证数据完整性。
 *
 * 格式锚点：
 *  - Local File Header：PK\x03\x04（0x04034b50）
 *  - Central Directory：PK\x01\x02（0x02014b50）
 *  - EOCD：PK\x05\x06（0x06054b50）
 */

// ---- CRC32 ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    t[n] = c >>> 0
  }
  return t
})()

function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

export interface ZipEntry { name: string; data: Uint8Array<ArrayBuffer> }
export interface ZipBlobEntry { name: string; data: Blob }

/** 大文件不在内存里一次转成 ArrayBuffer：按 4MB 切片累计 CRC，随后直接把原 Blob 交给 zip。 */
async function crc32Blob(blob: Blob): Promise<number> {
  const chunkSize = 4 * 1024 * 1024
  let c = 0xffffffff
  for (let offset = 0; offset < blob.size; offset += chunkSize) {
    const bytes = new Uint8Array(await blob.slice(offset, offset + chunkSize).arrayBuffer())
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

/** 打包 zip（STORE 模式）；entry.name 用正斜杠相对路径（UTF-8） */
export function buildZip(entries: ZipEntry[]): Blob {
  const enc = new TextEncoder()
  const chunks: Uint8Array<ArrayBuffer>[] = []
  const central: Uint8Array<ArrayBuffer>[] = []
  let offset = 0

  const u16 = (v: number) => new Uint8Array([v & 0xff, (v >>> 8) & 0xff])
  const u32 = (v: number) => new Uint8Array([v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff])

  for (const e of entries) {
    if (e.data.length > 0xffffffff) throw new Error(`zip 条目超过 4GB：${e.name}`)
    const nameBytes = enc.encode(e.name)
    const crc = crc32(e.data)
    // Local File Header
    chunks.push(u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0), u32(crc), u32(e.data.length), u32(e.data.length), u16(nameBytes.length), u16(0), nameBytes)
    chunks.push(e.data)
    // Central Directory 记录
    central.push(u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0), u32(crc), u32(e.data.length), u32(e.data.length), u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nameBytes)
    offset += 30 + nameBytes.length + e.data.length
  }
  const cdSize = central.reduce((s, c) => s + c.length, 0)
  // EOCD
  const eocd = [...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(entries.length), ...u16(entries.length), ...u32(cdSize), ...u32(offset), ...u16(0)]
  return new Blob([...chunks, ...central, new Uint8Array(eocd)], { type: 'application/zip' })
}

/**
 * 流式友好的 STORE zip：只保留各附件 Blob 引用，不把全部附件转成 ArrayBuffer。
 * 适用于设置页「全部附件整体打包下载」这类可能包含大量图片/PDF 的场景。
 */
export async function buildZipFromBlobs(entries: ZipBlobEntry[]): Promise<Blob> {
  const enc = new TextEncoder()
  const chunks: BlobPart[] = []
  const central: Uint8Array<ArrayBuffer>[] = []
  let offset = 0

  const u16 = (v: number) => new Uint8Array([v & 0xff, (v >>> 8) & 0xff])
  const u32 = (v: number) => new Uint8Array([v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff])

  for (const e of entries) {
    if (e.data.size > 0xffffffff) throw new Error(`zip 条目超过 4GB：${e.name}`)
    const nameBytes = enc.encode(e.name)
    const crc = await crc32Blob(e.data)
    chunks.push(u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0), u32(crc), u32(e.data.size), u32(e.data.size), u16(nameBytes.length), u16(0), nameBytes)
    chunks.push(e.data)
    central.push(u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0), u32(crc), u32(e.data.size), u32(e.data.size), u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nameBytes)
    offset += 30 + nameBytes.length + e.data.size
    if (offset > 0xffffffff) throw new Error('附件包超过 4GB，暂不支持生成 zip')
  }
  const cdSize = central.reduce((s, c) => s + c.length, 0)
  const eocd = [...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(entries.length), ...u16(entries.length), ...u32(cdSize), ...u32(offset), ...u16(0)]
  return new Blob([...chunks, ...central, new Uint8Array(eocd)], { type: 'application/zip' })
}

/** 解包 zip（仅支持 STORE；压缩条目抛错）。返回条目数组 */
export function readZip(buf: ArrayBuffer): ZipEntry[] {
  const view = new DataView(buf)
  const bytes = new Uint8Array(buf)
  // 从尾部找 EOCD（注释长度 ≤ 1024）
  let eocd = -1
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 22 - 1024); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('无效 zip：找不到 EOCD')
  const count = view.getUint16(eocd + 10, true)
  let p = view.getUint32(eocd + 16, true)
  const dec = new TextDecoder()
  const out: ZipEntry[] = []
  for (let i = 0; i < count; i++) {
    if (view.getUint32(p, true) !== 0x02014b50) throw new Error('无效 zip：Central Directory 损坏')
    const method = view.getUint16(p + 10, true)
    const crc = view.getUint32(p + 16, true)
    const size = view.getUint32(p + 24, true)
    const nameLen = view.getUint16(p + 28, true)
    const extraLen = view.getUint16(p + 30, true)
    const commentLen = view.getUint16(p + 32, true)
    const lho = view.getUint32(p + 42, true)
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen))
    if (method !== 0) throw new Error(`zip 条目已压缩（${name}），仅支持 STORE 模式附件包`)
    // Local header 校验 + 读数据
    const lnLen = view.getUint16(lho + 26, true)
    const leLen = view.getUint16(lho + 28, true)
    const dataStart = lho + 30 + lnLen + leLen
    const data = bytes.subarray(dataStart, dataStart + size)
    if (crc32(data) !== crc) throw new Error(`zip 条目 CRC 校验失败（${name}）`)
    if (!name.endsWith('/')) out.push({ name, data })
    p += 46 + nameLen + extraLen + commentLen
  }
  return out
}
