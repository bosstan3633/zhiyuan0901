<script setup lang="ts">
/**
 * R4-a：分类 → 标签 迁移报告卡（挂在设置页「标签管理」）
 *
 * 为什么单独一张卡：V3.7.0（R179）落了迁移原语——写备份 / 出报告 / 可回退——**却没落出口**：
 * 报告键只写不读，`restoreMigrateBackup` 零调用方。一次改数据模型的一不可逆迁移，
 * 用户既看不到它改了什么，也用不上那条回退路。数据地基的安全带不能只存在于代码里。
 *
 * 回退必须"停得住"：两个迁移是幂等落戳的，回退把戳清掉之后下次启动会原样再迁一遍。
 * 所以回退同时落 `K.MIGRATE_OPTOUT`，启动期 `stores/app.ts` 认这个开关跳过整段池迁移，
 * 直到用户主动点「重新执行迁移」。
 */
import Icon from '@/shared/components/Icon.vue'
import { onMounted, ref } from 'vue'
import { useAppStore } from '../stores/app'
import { K } from '@/shared/storage/keys'
import type { AppData, CatsMigrateReport } from '@/shared/models'
import { replaceData } from '@/shared/storage/repository'
import { readMigrateBackup, restoreMigrateBackup, setMigrateOptOut, hasMigrateOptOut } from '@/shared/storage/poolMigration'
import { useConfirm } from '@/shared/components/confirm'
import { showToast } from '@/shared/components/toast'

const store = useAppStore()
const report = ref<CatsMigrateReport | null>(null)
const backup = ref<{ at: number; reason?: string; cards: number } | null>(null)
const optOut = ref(false)
const mapOpen = ref(false)

async function load() {
  try {
    const raw = await chrome.storage.local.get([K.MIGRATE_REPORT, K.MIGRATE_BACKUP])
    report.value = (raw[K.MIGRATE_REPORT] as CatsMigrateReport) || null
    const b = raw[K.MIGRATE_BACKUP] as { at?: number; reason?: string; data?: AppData } | undefined
    backup.value = b && b.data && b.at
      ? { at: b.at, reason: b.reason, cards: (b.data.resources || []).filter(r => !r.deletedAt).length }
      : null
    optOut.value = await hasMigrateOptOut()
  } catch { report.value = null }
}
onMounted(() => { void load() })

function fmt(t: number) { return new Date(t).toLocaleString('zh-CN', { hour12: false }) }

async function download() {
  const b = await readMigrateBackup()
  if (!b?.data) { showToast('备份不存在（或结构不符）'); return }
  const blob = new Blob([JSON.stringify(b.data)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `zhiyuan_backup_迁移前_${new Date(b.at).toISOString().slice(0, 10)}.json`
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  showToast('迁移前备份已下载')
}

async function rollback() {
  const b = await readMigrateBackup()
  if (!b?.data) { showToast('没有可用备份'); return }
  const cur = store.data
  const curRes = (cur?.resources || []).filter(r => !r.deletedAt).length
  const ok = await useConfirm({
    title: '回退到分类→标签迁移前',
    message: `备份时间 ${fmt(b.at)}（迁移前 ${(b.data.resources || []).length} 张资源卡）。\n当前库 ${curRes} 张资源卡 / ${(cur?.tasks || []).length} 个任务——回退是**整库覆盖**，迁移之后产生的改动会一并丢掉（建议先点「下载备份」留一份当前数据）。\n回退后分类树会回来，但资源台页面已退役，分类只在策展台可见；要再迁回来可点「重新执行迁移」。`,
    confirmText: '整库回退'
  })
  if (!ok) return
  try {
    const d = await restoreMigrateBackup()
    if (!d) { showToast('备份结构不符（需 v2 格式），已中止'); return }
    await setMigrateOptOut(true)
    await chrome.storage.local.remove([K.MIGRATE_REPORT])
    await replaceData(d)
    await load()
    showToast('↺ 已回退到迁移前（标签树与卡面标签一并还原）')
  } catch (e) { showToast('回退失败：' + String(e).slice(0, 70)) }
}

async function reRun() {
  const ok = await useConfirm({
    title: '重新执行分类→标签迁移',
    message: '解除迁移停用并刷新页面：启动期按同一口径重跑两个迁移（幂等），分类树再次转成两级标签 + 卡面路径标签。',
    confirmText: '重跑迁移'
  })
  if (!ok) return
  await setMigrateOptOut(false)
  location.reload()
}
</script>

<template>
  <div v-if="report || backup" class="gs-card mg-card">
    <div class="gs-card-header">
      <span class="gs-card-title"><Icon name="dna" :size="13"/> 分类 › 标签 迁移报告</span>
      <span class="gs-card-desc">{{ report ? `迁移于 ${fmt(report.at)}` : '本库无迁移报告（已回退或从未迁移）' }}<template v-if="backup"> · 备份 {{ fmt(backup.at) }} · {{ backup.cards }} 张卡</template></span>
      <span v-if="optOut" class="mg-off">迁移已停用（回退态）</span>
    </div>
    <div class="gs-card-body">
      <div v-if="report" class="mg-stats">
        <span>一级 › 父标签 <b>{{ report.l1 }}</b></span>
        <span>二级 › 子标签 <b>{{ report.l2 }}</b></span>
        <span>三/四级拍平 <b>{{ report.deep }}</b></span>
        <span>打标卡片 <b>{{ report.cardsTouched }}</b> 张</span>
        <span>新增标签 <b>{{ report.tagsAdded }}</b> 次</span>
      </div>
      <div v-if="report" class="mg-map">
        <button class="gs-btn mg-mini" @click="mapOpen = !mapOpen">{{ mapOpen ? '收起' : '展开' }}逐条映射清单（{{ report.mapping.length }} 条）</button>
        <div v-if="mapOpen" class="mg-rows">
          <div v-for="m in report.mapping" :key="m.catId + m.tagName" class="mg-row">
            <span class="p">{{ m.path }}</span><span class="ar">›</span><span class="t">{{ m.tagName }}</span><span class="k">{{ m.kind === 'parent' ? '父标签' : m.kind === 'child' ? '子标签' : '路径拍平' }}</span>
          </div>
        </div>
      </div>
      <div class="mg-acts">
        <button class="gs-btn mg-mini" :disabled="!backup" @click="download"><Icon name="download" :size="13"/> 下载迁移前备份</button>
        <button v-if="!optOut" class="gs-btn gs-btn-danger mg-mini" :disabled="!backup" @click="rollback"><Icon name="rotateccw" :size="13"/> 回退到迁移前（整库覆盖）</button>
        <button v-else class="gs-btn mg-mini" @click="reRun">▶ 重新执行迁移</button>
      </div>
    </div>
  </div>
</template>

<!-- V3.8.42：本卡复用设置页共享基类，必须显式引入（Vue 的 scoped 命中不了子组件内部元素）。 -->
<style src="../views/settings/base.css"></style>

<style scoped>
/* 复用设置页的 .gs-card / .gs-btn / .gs-btn-danger 外壳（由 settings/base.css 提供），
   这里只补这张卡自己的密度与配色，全部走令牌。
   ★V3.8.42 更正：原注释写「非 scoped 部分由 GlobalSettings 全局表提供」是**错的**——
   宿主那份一直是 scoped 样式，命中不了本组件内部元素，卡片外壳实际一直是掉的。 */
.mg-card { margin-bottom: 14px; }
.mg-off { margin-left: 8px; font-size: var(--fs-caption); color: var(--warning); border: 1px solid var(--warning-border); background: var(--warning-bg-soft); border-radius: 99px; padding: 1px 8px; }
.mg-stats { display: flex; flex-wrap: wrap; gap: 14px; font-size: var(--fs-sub); color: var(--text-2); }
.mg-stats b { color: var(--text); font-variant-numeric: tabular-nums; }
.mg-map { margin-top: 10px; }
.mg-rows { margin-top: 8px; max-height: 240px; overflow: auto; border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px; }
.mg-row { display: flex; align-items: center; gap: 8px; font-size: var(--fs-caption); padding: 3px 0; border-bottom: 1px dashed var(--border); }
.mg-row:last-child { border-bottom: none; }
.mg-row .p { color: var(--text-3); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mg-row .ar { color: var(--text-4); flex: none; }
.mg-row .t { color: var(--accent); font-weight: 600; }
.mg-row .k { margin-left: auto; color: var(--text-4); flex: none; }
.mg-acts { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
.mg-mini { padding: 4px 11px; font-size: var(--fs-caption); }
</style>
