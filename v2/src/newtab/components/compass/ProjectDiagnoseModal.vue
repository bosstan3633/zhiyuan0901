<script setup lang="ts">
/**
 * N2 · V3.8.18 方向台「项目 AI 诊断」中央弹窗。
 *
 * 形态同画像洞察复盘弹窗（Teleport + overlay + self 关闭）——不另造一套浮层，
 * W12-G 那条「交互区附近不许用最淡档 --text-4」的纪律在这里照旧适用。
 *
 * 三块内容全部是**已定稿数据**：结论来自规则、建议来自已采纳的 AI 行，
 * 弹窗自己不调模型、不写库，只负责展示与导出。
 */
import { computed, ref, watch } from 'vue'
import type { ProjectDiagnosis } from '@/shared/ai/projectDiagnose'

const props = defineProps<{
  open: boolean
  report: ProjectDiagnosis | null
  /** 用当前数据重算指纹，用来判断报告过期（宿主传的是最新一次诊断的指纹对比源） */
  stale: boolean
  /** 数据自生成后的变更条数（宿主算好，只用来显示一行字） */
  changed?: number
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'rerun'): void
}>()

const now = ref(Date.now())
watch(() => props.open, v => { if (v) now.value = Date.now() })

const levelClass = (l: string) => (l === 'bad' ? 'bad' : l === 'warn' ? 'warn' : 'ok')
const levelLabel = (l: string) => (l === 'bad' ? '需处理' : l === 'warn' ? '有风险' : '健康')
const fmtTime = (t: number) => {
  const d = new Date(t)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}


/** 过期判定的真源是「当前数据重算的指纹 ≠ 报告里的指纹」——宿主算好传进来，弹窗不碰 store */
const isStale = computed(() => !!props.report && props.stale)

// ── 导出（HTML / Markdown 都是自包含单文件，PNG 二批再做） ──
const esc = (s: string) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
const stripB = (s: string) => String(s).replace(/<\/?b>/g, '')

function download(name: string, mime: string, text: string) {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

function exportMd() {
  const r = props.report
  if (!r) return
  const L: string[] = []
  L.push(`# ${r.projName} · AI 诊断报告`, '')
  L.push(`- 生成时间：${fmtTime(r.genAt)}`)
  L.push(`- 快照：${r.snapshot.metrics} 指标 / ${r.snapshot.tasks} 任务 · 数据指纹 \`${r.fingerprint}\``)
  L.push(`- 总评：**${r.verdictLabel}**`, '', stripB(r.summary), '')
  for (const d of r.dims) {
    L.push(`## ${d.label} — ${levelLabel(d.status)}`, '')
    for (const f of d.findings) L.push(`- **${f.tag}**：${f.text} \`${f.evidence}\``)
    L.push('')
  }
  if (r.advice.length) {
    L.push('## 建议动作（按优先级）', '')
    r.advice.forEach((a, i) => L.push(`${i + 1}. ${a}`))
    L.push('')
  }
  L.push('---', '', '> 本报告由规则引擎生成结论、AI 补充建议；存于会话缓存，关闭浏览器即失效。')
  download(`${r.projName}-诊断.md`, 'text/markdown;charset=utf-8', L.join('\n'))
}

function exportHtml() {
  const r = props.report
  if (!r) return
  const color = (l: string) => (l === 'bad' ? '#f87171' : l === 'warn' ? '#fbbf24' : '#34d399')
  const dim = (l: string) => (l === 'bad' ? 'rgba(248,113,131,.14)' : l === 'warn' ? 'rgba(251,191,36,.14)' : 'rgba(52,211,153,.14)')
  const dims = r.dims.map(d => `
<section style="border:1px solid rgba(0,0,0,.10);border-radius:10px;margin:12px 0;overflow:hidden">
  <div style="display:flex;align-items:center;gap:9px;padding:9px 13px;border-bottom:1px solid rgba(0,0,0,.10);background:rgba(0,0,0,.03)">
    <b style="font-size:13px">${esc(d.label)}</b>
    <span style="margin-left:auto;font-size:11px;padding:2px 9px;border-radius:99px;font-weight:700;color:${color(d.status)};background:${dim(d.status)}">${levelLabel(d.status)}</span>
  </div>
  <div style="padding:10px 13px">
    ${d.findings.map(f => `<p style="margin:5px 0;font-size:12px;line-height:1.7;color:#333"><b style="color:${color(f.level)}">${esc(f.tag)}</b> · ${esc(stripB(f.text))} <span style="color:#888;font-size:11px">${esc(f.evidence)}</span></p>`).join('')}
  </div>
</section>`).join('')
  const advice = r.advice.length ? `
<section style="border:1px solid rgba(139,92,246,.3);border-radius:10px;background:rgba(139,92,246,.07);padding:13px 15px">
  <b style="font-size:12px;color:#6d28d9">💡 建议动作（按优先级）</b>
  ${r.advice.map((a, i) => `<p style="margin:7px 0;font-size:12px;line-height:1.8"><span style="display:inline-block;width:16px;height:16px;border-radius:4px;background:rgba(139,92,246,.2);color:#6d28d9;font-size:10px;text-align:center;line-height:16px">${i + 1}</span> ${esc(a)}</p>`).join('')}
</section>` : ''
  const html = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>${esc(r.projName)} · AI 诊断报告</title></head>
<body style="margin:0;padding:26px 30px 60px;font:14px/1.65 -apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;color:#1f2328;max-width:860px">
<h1 style="font-size:21px;margin:0 0 6px">${esc(r.projName)} · AI 诊断报告</h1>
<p style="margin:0;color:#6a737d;font-size:12px">${fmtTime(r.genAt)} 生成 · 快照 ${r.snapshot.metrics} 指标 / ${r.snapshot.tasks} 任务 · 数据指纹 <code style="background:#f1f3f5;padding:1px 5px;border-radius:4px">${r.fingerprint}</code></p>
<div style="display:flex;align-items:center;gap:14px;padding:13px 15px;border-radius:10px;margin:16px 0;background:${dim(r.verdict)};border:1px solid ${color(r.verdict)}">
<b style="font-size:19px;color:${color(r.verdict)}">${r.verdictLabel}</b>
<span style="font-size:13px;line-height:1.7">${esc(stripB(r.summary))}</span>
</div>
${dims}${advice}
<p style="margin-top:26px;color:#8b949e;font-size:11px">结论由规则引擎生成、AI 补充建议 · 报告存于会话缓存，关闭浏览器即失效</p>
</body></html>`
  download(`${r.projName}-诊断.html`, 'text/html;charset=utf-8', html)
}

</script>

<template>
  <Teleport to="body">
    <div v-if="open && report" class="ovl" @click.self="emit('close')">
      <div class="pd-modal" role="dialog" aria-modal="true" :aria-label="report.projName + ' AI 诊断'">
        <!-- 头 -->
        <div class="pd-h">
          <div class="pd-ic">🧠</div>
          <div class="pd-hx">
            <div class="pd-t">{{ report.projName }} · AI 诊断</div>
            <div class="pd-s">
              {{ new Date(report.genAt).toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-') }} 生成 ·
              快照 {{ report.snapshot.metrics }} 指标 / {{ report.snapshot.tasks }} 任务 ·
              数据指纹 <code>{{ report.fingerprint }}</code>
            </div>
          </div>
          <button class="pd-x" title="关闭" @click="emit('close')">×</button>
        </div>

        <!-- 过期条 -->
        <div v-if="isStale" class="pd-stale">
          <span>⚠</span>
          <span>本项目自生成后数据已变更（当前指纹与报告不一致），结论可能已过期。</span>
          <button class="pd-stale-btn" @click="emit('rerun')">↻ 重新诊断</button>
        </div>

        <!-- 导出条 -->
        <div class="pd-bar">
          <span class="pd-lb">导出</span>
          <div class="pd-seg">
            <i @click="exportHtml">🌐 HTML</i>
            <i @click="exportMd">📄 Markdown</i>
          </div>
          <span class="pd-rt">PNG 二批再做</span>
        </div>

        <!-- 体 -->
        <div class="pd-b">
          <div class="pd-verdict" :class="levelClass(report.verdict)">
            <span class="pd-big">{{ report.verdictLabel }}</span>
            <span class="pd-sm" v-html="report.summary"></span>
          </div>

          <div v-for="(d, i) in report.dims" :key="d.key" class="pd-dim">
            <div class="pd-dim-h">
              <span class="pd-n">{{ i + 1 }}</span>
              <span class="pd-dim-t">{{ d.label }}</span>
              <span class="pd-st" :class="levelClass(d.status)">{{ levelLabel(d.status) }}</span>
            </div>
            <div class="pd-dim-b">
              <div v-for="(f, fi) in d.findings" :key="fi" class="pd-fnd">
                <span class="pd-bd" :class="levelClass(f.level)">{{ f.tag }}</span>
                <span>{{ stripB(f.text) }}</span>
                <span class="pd-ev">{{ f.evidence }}</span>
              </div>
            </div>
          </div>

          <div v-if="report.advice.length" class="pd-advs">
            <div class="pd-adv-h">💡 建议动作（按优先级）</div>
            <div v-for="(a, i) in report.advice" :key="i" class="pd-adv">
              <span class="pd-adv-i">{{ i + 1 }}</span>
              <span>{{ a }}</span>
            </div>
          </div>
          <div v-else class="pd-noadv">本次未采纳 AI 建议——报告只有规则结论。</div>
        </div>

        <!-- 尾 -->
        <div class="pd-f">
          <span>报告存于会话缓存，关闭浏览器即失效 · 不落卡片池</span>
          <span class="pd-f-sp">
            <button class="pd-btn" @click="emit('rerun')">↻ 重新诊断</button>
            <button class="pd-btn pri" @click="emit('close')">关闭</button>
          </span>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.ovl {
  position: fixed; inset: 0; z-index: var(--z-modal); display: grid; place-items: center; padding: 24px;
  background: rgba(0, 0, 0, .55);
}
.pd-modal {
  background: var(--surface-2); border: 1px solid var(--border-strong); border-radius: 14px;
  width: min(780px, 100%); max-height: 100%; display: flex; flex-direction: column; overflow: hidden;
  box-shadow: 0 24px 70px rgba(0, 0, 0, .6);
}
.pd-h { padding: 16px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: flex-start; gap: 12px; }
.pd-ic { width: 34px; height: 34px; border-radius: 9px; background: var(--accent-light); display: grid; place-items: center; font-size: 16px; flex: none; }
.pd-hx { min-width: 0; }
.pd-t { font-size: var(--fs-title); font-weight: 800; color: var(--text); }
.pd-s { font-size: var(--fs-caption); color: var(--text-3); margin-top: 2px; }
.pd-s code { background: var(--surface-3); padding: 1px 5px; border-radius: 4px; }
.pd-x { width: 26px; height: 26px; border-radius: 7px; display: grid; place-items: center; color: var(--text-3); cursor: pointer; font-size: 15px; margin-left: auto; flex: none; background: none; border: 0; }
.pd-x:hover { background: var(--surface-3); color: var(--text); }

.pd-stale { display: flex; align-items: center; gap: 9px; padding: 9px 20px; background: var(--warning-bg-soft); border-bottom: 1px solid rgba(251, 191, 36, .24); font-size: var(--fs-caption); color: var(--warning); }
.pd-stale-btn { margin-left: auto; padding: 3px 9px; font-size: 11px; background: transparent; border: 1px solid rgba(251, 191, 36, .4); color: var(--warning); border-radius: 7px; cursor: pointer; }

.pd-bar { padding: 11px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 8px; }
.pd-lb { font-size: 11px; color: var(--text-3); }
.pd-seg { display: flex; background: var(--surface-3); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.pd-seg i { font-style: normal; font-size: var(--fs-caption); padding: 5px 11px; color: var(--text-2); cursor: pointer; white-space: nowrap; }
.pd-seg i + i { border-left: 1px solid var(--border); }
.pd-seg i:hover { background: var(--surface-2); color: var(--text); }
.pd-rt { margin-left: auto; font-size: var(--fs-tiny); color: var(--text-3); }

.pd-b { padding: 16px 20px; overflow: auto; }
.pd-verdict { display: flex; align-items: center; gap: 14px; padding: 13px 15px; border-radius: 10px; margin-bottom: 16px; border: 1px solid transparent; }
.pd-verdict.ok { background: var(--success-bg-soft); border-color: rgba(52, 211, 153, .28); }
.pd-verdict.warn { background: var(--warning-bg-soft); border-color: rgba(251, 191, 36, .28); }
.pd-verdict.bad { background: var(--danger-bg-soft); border-color: rgba(248, 113, 113, .28); }
.pd-big { font-size: 19px; font-weight: 800; flex: none; }
.pd-verdict.ok .pd-big { color: var(--success); }
.pd-verdict.warn .pd-big { color: var(--warning); }
.pd-verdict.bad .pd-big { color: var(--danger); }
.pd-sm { font-size: var(--fs-caption); color: var(--text-2); line-height: 1.7; }

.pd-dim { margin-bottom: 13px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); overflow: hidden; }
.pd-dim-h { display: flex; align-items: center; gap: 9px; padding: 9px 13px; border-bottom: 1px solid var(--border); }
.pd-n { width: 19px; height: 19px; border-radius: 5px; background: var(--surface-3); color: var(--text-3); font-size: 10px; font-weight: 700; display: grid; place-items: center; flex: none; }
.pd-dim-t { font-size: var(--fs-sub); font-weight: 700; color: var(--text); }
.pd-st { margin-left: auto; font-size: var(--fs-tiny); padding: 2px 8px; border-radius: 99px; font-weight: 700; }
.pd-st.ok { background: var(--success-bg-soft); color: var(--success); }
.pd-st.warn { background: var(--warning-bg-soft); color: var(--warning); }
.pd-st.bad { background: var(--danger-bg-soft); color: var(--danger); }
.pd-dim-b { padding: 10px 13px; }
.pd-fnd { display: flex; gap: 9px; align-items: flex-start; padding: 6px 0; font-size: var(--fs-caption); color: var(--text-2); line-height: 1.7; }
.pd-bd { font-weight: 700; flex: none; }
.pd-bd.ok { color: var(--success); }
.pd-bd.warn { color: var(--warning); }
.pd-bd.bad { color: var(--danger); }
.pd-ev { margin-left: auto; flex: none; font-size: 10px; color: var(--text-3); font-variant-numeric: tabular-nums; padding-left: 10px; white-space: nowrap; }

.pd-advs { padding: 13px 15px; border-radius: 10px; background: var(--accent-light); border: 1px solid rgba(139, 92, 246, .24); }
.pd-adv-h { font-size: var(--fs-caption); font-weight: 700; color: var(--accent-ink); margin-bottom: 8px; }
.pd-adv { font-size: var(--fs-caption); color: var(--text-2); line-height: 1.8; padding: 5px 0; display: flex; gap: 9px; }
.pd-adv-i { width: 16px; height: 16px; border-radius: 4px; background: rgba(139, 92, 246, .22); color: var(--accent-ink); font-size: 9px; font-weight: 700; display: grid; place-items: center; flex: none; margin-top: 3px; }
.pd-noadv { padding: 12px 14px; border-radius: 10px; background: var(--surface-3); font-size: var(--fs-caption); color: var(--text-3); }

.pd-f { padding: 11px 20px; border-top: 1px solid var(--border); display: flex; align-items: center; gap: 9px; font-size: var(--fs-tiny); color: var(--text-3); }
.pd-f-sp { margin-left: auto; display: flex; gap: 8px; }
.pd-btn { font-size: var(--fs-caption); padding: 5px 11px; border-radius: 7px; background: var(--surface-3); color: var(--text-2); border: 1px solid var(--border); cursor: pointer; white-space: nowrap; }
.pd-btn:hover { color: var(--text); border-color: var(--border-strong); }
.pd-btn.pri { background: var(--accent); color: #fff; border-color: transparent; font-weight: 700; }
</style>
