import { computed } from 'vue'
import { useAppStore } from './app'
import { uid } from '@/shared/utils'
import type { CuriosityCard, ResourceCard, TaskCard } from '@/shared/models'

/** 好奇心状态 → 展示元信息 */
export const CURIOSITY_STATUS = {
  todo:    { label: '待探索', icon: '💡', cls: 'pending' },
  doing:   { label: '探索中', icon: '🔍', cls: 'exploring' },
  done:    { label: '已求证', icon: '✅', cls: 'verified' },
  shelf:   { label: '已搁置', icon: '⏸', cls: 'shelved' }
} as const

export type CuriStatus = keyof typeof CURIOSITY_STATUS

/**
 * 好奇心卡管理
 */
export function useCuriosity() {
  const store = useAppStore()
  const d = computed(() => store.data!)

  // 第廿二轮根修：移除 createdAt 虚拟排序——它会把手动拖拽结果每次渲染都吃回。
  // 顺序权威 = 源数组；新卡片由 add() unshift 到顶部，保持「最新在前」的默认体验。
  const curiosities = computed(() =>
    d.value.curiosities
      .filter(c => !c.deletedAt)
  )

  function add(question: string, sourceUrl = '', sourceTitle = ''): CuriosityCard {
    const c: CuriosityCard = {
      id: uid('cz'),
      kind: 'curiosity',
      question: question.trim(),
      sourceUrl: sourceUrl || undefined,
      status: 'todo',
      pinned: false,
      relatedResourceIds: [],
      customFields: {},
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    d.value.curiosities.unshift(c)
    store.persist()
    return c
  }

  function update(id: string, patch: Partial<CuriosityCard>) {
    const c = d.value.curiosities.find(x => x.id === id)
    if (c) { Object.assign(c, patch, { updatedAt: Date.now() }); store.persist() }
  }

  function setStatus(id: string, status: CuriStatus) {
    update(id, { status })
  }

  function remove(id: string) {
    const c = d.value.curiosities.find(x => x.id === id)
    if (c) { c.deletedAt = Date.now(); store.persist() }
  }

  /** 转化为任务卡 → 进入任务中心（可选归属项目/指标） */
  function convertToTask(c: CuriosityCard, projectId?: string, metricId?: string): TaskCard {
    const task: TaskCard = {
      id: uid('tk'),
      kind: 'task',
      title: c.question,
      status: 'todo',
      priority: 'medium',
      projectId,
      metricId,
      mountedResourceIds: [],
      mountedCuriosityIds: [c.id],
      customFields: {},
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    d.value.tasks.unshift(task)
    c.deletedAt = Date.now()
    store.persist()
    return task
  }

  /** 转化为资源卡 → 进入指定工作台/分类 */
  function convertToResource(c: CuriosityCard, workspaceId: string, categoryId?: string): ResourceCard {
    const resource: ResourceCard = {
      id: uid('rc'),
      kind: 'resource',
      title: c.question,
      linkType: 'url',
      link: c.sourceUrl || '',
      workspaceId,
      categoryId: categoryId || '',
      tags: [],
      customFields: {},
      pinned: false,
      callCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    d.value.resources.unshift(resource)
    c.deletedAt = Date.now()
    store.persist()
    return resource
  }

  return {
    curiosities, STATUS_MAP: CURIOSITY_STATUS,
    add, update, setStatus, remove, convertToTask, convertToResource
  }
}
