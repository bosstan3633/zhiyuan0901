import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import type { ComputedRef } from 'vue'
import { showToast } from '@/shared/components/toast'
import {
  snoozeCard, reactivateCard, setCoolingDays,
  coolingDefaultDaysOf, setCoolingDefaultDays, lifecycleState, coolingMsOf
} from '@/shared/utils/lifecycle'
import PiMetricDetailDrawer, { type PiStatRow, type PiReconCell } from '@/newtab/components/profile/PiMetricDetailDrawer.vue'
import type { useProfileInsights } from './useProfileInsights'

export function useProfileInsightsTags(deps: Pick<ReturnType<typeof useProfileInsights>, 'gd' | 'store' | 'tagAiJob' | 'totalCards' | 'statList' | 'dashDirections' | 'goalDirId' | 'topicTag' | 'statDrawer' | 'todayCalled' | 'todayAdd' | 'ammoSplit' | 'todayRows' | 'coolingCards' | 'gResLive' | 'gTaskLive' | 'heroSupportRate' | 'gCurioLive'>): { runTagOptimizeAi: () => Promise<void>; statDrawerTitle: ComputedRef<string>; statReconcile: ComputedRef<PiReconCell[] | null>; statReconcileNote: ComputedRef<"" | "「次数」= 打开动作总数（含同一张卡多次打开）；「张数」= 去重后的卡片数。两者不同不是 bug，是两件事。" | "今日入台按卡字段 createdAt 计（与上方四格读数同源）；事件只用来标注来源。" | "弹药只算**存活**资源卡，与上方「已备弹药 N 张」同源；已软删的那几张单列，不混进清单。" | "冷却判定逐卡走 lifecycleState（与生命周期面板的「冷却」Tab 同一真源），默认 30 天不用即冷却、90 天归档。" | "支撑 = 任务到资源卡的一条显式关联，不是\"标签相同就算支撑\"。" | "本清单是卡片维度；想看\"谁在什么时候做了什么\"，去页头「全部记录」。"> } {
  const { gd, store, tagAiJob, totalCards, statList, dashDirections, goalDirId, topicTag, statDrawer, todayCalled, todayAdd, ammoSplit, todayRows, coolingCards, gResLive, gTaskLive, heroSupportRate, gCurioLive } = deps
async function runTagOptimizeAi() {
  try {
    const [{ loadAiConfig, aiReady, aiConfig }, govern] = await Promise.all([
      import('@/shared/ai/config'), import('@/shared/ai/govern'),
    ])
    await loadAiConfig()
    if (!aiReady.value) { showToast('请先在 设置 → AI 助手 完成地址、Key 与模型配置'); return }
    const job = govern.buildTagGovernJob({
      d: gd.value, depth: aiConfig.value.depth, persist: () => store.persist(),
    })
    if (!job) { showToast('当前没有可处理的标签问题'); return }
    tagAiJob.value = job
  } catch (e) {
    showToast('AI 入口载入失败：' + (e instanceof Error ? e.message : String(e)))
  }
}
const statDrawerTitle = computed(() => ({
  all: `全部卡片明细（${totalCards.value}）`,
  support: `任务证据支撑明细（${statList.value.length}）`,
  ammo: `已备弹药 · 三件事的支撑卡清单（${statList.value.length} 张）`,
  cooling: `可调出的旧卡 · 冷却期清单（${statList.value.length} 张）`,
  'today-in': `今日入台的卡（${statList.value.length} 张）`,
  'today-call': `↗ 今日调出的卡（${statList.value.length} 张）`,
  'goal-week': `${dashDirections.value.find(d => d.id === goalDirId.value)?.name || '方向'} · 本周产出任务（${statList.value.length}）`,
  'curio-conv': `本月转化的好奇卡（${statList.value.length}）`,
  'curated': `入策展金字塔明细（${statList.value.length} · 投射 + 论点）`,
  'mo-support': `本月支撑任务明细（${statList.value.length}）`,
  topic: `#${topicTag.value} 本月新增卡片（${statList.value.length}）`,
  '': ''
}[statDrawer.value]))

/** ★W16-T3 · 抽屉对账条（用户拍板 2026-10-16「要」）：把"次数"与"张数"两套口径并排摆出来。
    病灶是同一件事有两个数（今日调出按事件次数、去重后才是卡数），标题只写一个数会让人以为对不上账。 */
const statReconcile = computed<PiReconCell[] | null>(() => {
  const S = statDrawer.value
  if (!S) return null
  const cell = (k: string, n: number | string, u?: string, warn?: boolean): PiReconCell => ({ k, n: String(n), u, warn })
  switch (S) {
    case 'today-call':
      /* 计数 todayCalled 是事件次数，清单是去重卡数 —— 两个数并排，说清差别 */
      return [cell('调出动作', todayCalled.value, '次', todayCalled.value > statList.value.length),
        cell('涉及卡片', statList.value.length, '张'), cell('其中重复打开', Math.max(0, todayCalled.value - statList.value.length), '次')]
    case 'today-in':
      return [cell('今日入台', todayAdd.value, '张'), cell('清单行数', statList.value.length, '张'),
        cell('本地导入', statList.value.filter(c => c.owner === '本地导入').length, '张'),
        cell('采集入池', statList.value.filter(c => c.owner === '采集入池').length, '张')]
    case 'ammo':
      return [cell('存活弹药卡', ammoSplit.value.live.length, '张'), cell('已进回收站', ammoSplit.value.removed, '张', ammoSplit.value.removed > 0),
        cell('支撑关联条数', (gd.value.supportLinks || []).filter(l => l.taskId && todayRows.value.some(r => r && r.slot.sourceId === l.taskId)).length, '条')]
    case 'cooling':
      return [cell('冷却期卡', statList.value.length, '张'), cell('其中高价值（调用≥3）', coolingCards.value.filter(c => (gResLive.value.find(r => r.id === c.id)?.callCount || 0) >= 3).length, '张'),
        cell('默认冷却阈值', Math.round((coolingDefaultDaysOf() || 30)), '天'), cell('默认归档阈值', Math.round((coolingDefaultDaysOf() || 30) * 3), '天')]
    case 'support':
      const supported = (gd.value.supportLinks || []).filter(l => l.taskId).map(l => l.taskId)
      const supportedTasks = gTaskLive.value.filter(t => supported.includes(t.id)).length
      return [cell('支撑率', heroSupportRate.value, '%'), cell('已支撑', supportedTasks, '个'),
        cell('未支撑', Math.max(0, gTaskLive.value.length - supportedTasks), '个', supportedTasks < gTaskLive.value.length)]
    case 'all':
      return [cell('存活卡片', totalCards.value, '张'), cell('资源', gResLive.value.length, '张'),
        cell('任务', gTaskLive.value.length, '张'), cell('好奇', gCurioLive.value.length, '张')]
    default: return null
  }
})
/** 对账条的脚注：一句话说清这个抽屉是什么维度 */
const statReconcileNote = computed(() => {
  const S = statDrawer.value
  if (!S) return ''
  if (S === 'today-call') return '「次数」= 打开动作总数（含同一张卡多次打开）；「张数」= 去重后的卡片数。两者不同不是 bug，是两件事。'
  if (S === 'today-in') return '今日入台按卡字段 createdAt 计（与上方四格读数同源）；事件只用来标注来源。'
  if (S === 'ammo') return '弹药只算**存活**资源卡，与上方「已备弹药 N 张」同源；已软删的那几张单列，不混进清单。'
  if (S === 'cooling') return '冷却判定逐卡走 lifecycleState（与生命周期面板的「冷却」Tab 同一真源），默认 30 天不用即冷却、90 天归档。'
  if (S === 'support') return '支撑 = 任务到资源卡的一条显式关联，不是"标签相同就算支撑"。'
  if (S === 'all') return '本清单是卡片维度；想看"谁在什么时候做了什么"，去页头「全部记录」。'
  return ''
})

/* ===== W9/R48-B2 导入双口径计数（判据 R48-5 钉；界面徽标欠账见交付说明）+ 月窗口锚 ===== */

  return {
    runTagOptimizeAi, statDrawerTitle, statReconcile, statReconcileNote,
  }
}
