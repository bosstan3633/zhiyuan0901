<script setup lang="ts">
/**
 * R171-A2/A3：数据体检卡（设置 → 导出数据页）
 * 结构不变量的检测 + 一键修复。首项：中心论点重复（每台最多一张 isThesis，金字塔 L1 根）。
 * 盘点用纯函数 countThesisDuplicates（不改数据）；修复才走 sanitizeThesisDuplicates（落盘 persist）。
 * 独立组件原因：R164-2 增长门禁（GlobalSettings ≤3,565 行），本卡逻辑自含、不与宿主共享状态。
 */
import Icon from '@/shared/components/Icon.vue'
import { onMounted, ref } from 'vue'
import { useAppStore } from '../stores/app'
import { useConfirm } from '@/shared/components/confirm'
import { showToast } from '@/shared/components/toast'
import { sanitizeThesisDuplicates, countThesisDuplicates } from '@/shared/storage/hub'

const store = useAppStore()
const thesisDup = ref({ wsCount: 0, cleared: 0 })
function refreshThesisScan() {
  try { thesisDup.value = countThesisDuplicates(store.data!) } catch (err) { console.error('[thesis] scan failed:', err) }
}
onMounted(refreshThesisScan)
async function fixThesisDuplicates() {
  const d = store.data!
  const scan = countThesisDuplicates(d)
  if (!scan.wsCount) { showToast('无重复，一切干净'); return }
  const ok = await useConfirm({
    title: '修复中心论点重复',
    message: `${scan.wsCount} 个策展台存在重复的中心论点标记。将保留每台第一张（与统计口径一致），清除其余 ${scan.cleared} 张的标记——卡本身不删除。继续？`,
    confirmText: '修复'
  })
  if (!ok) return
  const res = sanitizeThesisDuplicates(d)
  store.persist()
  refreshThesisScan()
  showToast(`已修复：${res.wsCount} 个策展台归一，清除 ${res.cleared} 张多余标记`)
}
</script>

<template>
  <div class="gs-card">
    <div class="gs-card-header"><span class="gs-card-title"><Icon name="stethoscope" :size="13"/> 数据体检</span><span class="gs-card-desc">数据结构不变量的检测与修复（R171）</span></div>
    <div class="gs-card-body">
      <div class="gs-export-row">
        <div class="gs-er-info">
          <div class="gs-er-name">中心论点重复：{{ thesisDup.wsCount ? `${thesisDup.wsCount} 个策展台存在重复（多余 ${thesisDup.cleared} 张）` : '无重复，一切干净' }}</div>
          <div class="gs-er-desc">不变量：每台最多一张「中心论点」卡（金字塔 L1 根）。重复时统计只认首张，其余成幽灵论点。修复保留每台第一张，其余仅清标记、卡不删除</div>
        </div>
        <button class="gs-btn" :disabled="!thesisDup.wsCount" @click="fixThesisDuplicates">一键修复</button>
      </div>
    </div>
  </div>
</template>
