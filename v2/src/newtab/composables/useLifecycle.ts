/**
 * R110-LC：生命周期面板的宿主接线（三宿主共用）
 *
 * 分工（关键设计）：
 * - **面板组件**（LifecyclePanel.vue）只做纯展示 + 发意图（archive / snooze / reactivate），
 *   自身不改 props、不依赖 store；
 * - **宿主**（资源台 / 好奇心卡 / 任务卡）通过本组合式拿到 lcOpen 与四个回调，
 *   由宿主对**真实 store 卡对象**落库并 persist。
 *
 * 这样做的原因：宿主若把卡片 map 成副本传入（早先的接法），面板写 lifecycleArchived 只会改到
 * 副本上、persist 落空——表现为「点了归档没反应」。传活卡引用 + 宿主落库是唯一可靠路径。
 */
import { ref, type ComputedRef } from 'vue'
import { useAppStore } from '@/newtab/stores/app'
import { snoozeCard, reactivateCard } from '@/shared/utils/lifecycle'
import type { LifecycleCard } from '@/newtab/components/LifecyclePanel.vue'

export function useLifecycle(opts: {
  /** 面板可见的活卡（**真实 store 引用**；调用方负责过滤软删） */
  cards: ComputedRef<LifecycleCard[]>
  /** 定位回调（各宿主自实现：本台高亮 / 跨台路由 / 切换筛选） */
  locate: (id: string) => void
}) {
  const store = useAppStore()
  const lcOpen = ref(false)

  /** 按 id 找活卡——找不到（刚被删/恢复）时静默忽略，不抛错 */
  function find(id: string): LifecycleCard | undefined {
    return opts.cards.value.find(c => c.id === id)
  }
  /** 📦 归档：唯一写操作，强制隐藏于默认视图（可逆） */
  function onLcArchive(id: string) {
    const c = find(id)
    if (!c) return
    c.lifecycleArchived = true
    c.updatedAt = Date.now()
    store.persist()
  }
  /** 「忽略 30d」：重置活动时间，延后评估（不改变阶段语义） */
  function onLcSnooze(id: string) {
    const c = find(id)
    if (!c) return
    snoozeCard(c)
    store.persist()
  }
  /** 🔥 重新激活：清归档标记 + 重置活动时间 */
  function onLcReactivate(id: string) {
    const c = find(id)
    if (!c) return
    reactivateCard(c)
    store.persist()
  }
  function onLcLocate(id: string) {
    lcOpen.value = false
    opts.locate(id)
  }

  return { lcOpen, onLcArchive, onLcSnooze, onLcReactivate, onLcLocate }
}
