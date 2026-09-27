<script setup lang="ts">
import { useOverlayTarget } from '@/shared/utils/overlayHost'
// R113-N5：Teleport 目标动态化——金字塔真全屏期间浮层挂进全屏元素（否则不可见）
const overlayTarget = useOverlayTarget()
/**
 * 标签选择器（N4）
 * 唯一入口为「设置 → 标签管理」的树状标签体系；此处只做搜索 + 勾选 + 快捷新建（入树）。
 * 支持三卡：资源卡 / 任务卡 / 好奇心卡。
 */
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/newtab/stores/app'
import { uid } from '@/shared/utils'
import type { TagNode } from '@/shared/models'

const props = defineProps<{ modelValue?: string[] }>()
const store = useAppStore()
const router = useRouter()
const open = ref(false)
const q = ref('')
const popLeft = ref(0)
const popTop = ref(0)
function openPop(e: MouseEvent) {
  open.value = !open.value
  popLeft.value = Math.max(8, Math.min(e.clientX - 40, window.innerWidth - 320))
  popTop.value = Math.min(e.clientY + 8, window.innerHeight - 360)
}

const tags = computed<string[]>(() => Array.isArray(props.modelValue) ? props.modelValue : [])

interface FlatTag { id: string; name: string; depth: number; path: string }
const flat = computed<FlatTag[]>(() => {
  const out: FlatTag[] = []
  const walk = (nodes: TagNode[], depth: number, prefix: string) =>
    nodes.forEach(n => {
      const path = prefix ? prefix + ' / ' + n.name : n.name
      out.push({ id: n.id, name: n.name, depth, path })
      if (n.children?.length) walk(n.children, depth + 1, path)
    })
  walk(store.data?.tagTree || [], 0, '')
  return out
})
const visible = computed(() => {
  const qq = q.value.trim().toLowerCase()
  return qq ? flat.value.filter(t => t.name.toLowerCase().includes(qq)) : flat.value
})

function persist(next: string[]) {
  emit('update:modelValue', next)
  store.persist()
}
/** R126（诉求 7）：选中值——根=名称；子=「父/子」路径（与卡片存储口径一致） */
function valOf(t: FlatTag) { return t.depth === 0 ? t.name : t.path.split(' / ').join('/') }
function toggle(name: string) {
  const set = new Set(tags.value)
  set.has(name) ? set.delete(name) : set.add(name)
  persist([...set])
}
function removeTag(name: string) {
  persist(tags.value.filter(t => t !== name))
}
/** 快捷新建：入标签树（根级），并选中 */
function createNew() {
  const name = q.value.trim()
  if (!name) return
  if (flat.value.some(t => t.name === name)) { toggle(name); q.value = ''; return }
  store.data!.tagTree.push({ id: uid('tag'), name })
  store.persist()
  toggle(name)
  q.value = ''
}
const emit = defineEmits<{ 'update:modelValue': [string[]] }>()
/** 标签体系为空时：引导前往「设置 → 标签管理」创建 */
function goTagManage() {
  open.value = false
  router.push({ path: '/settings', query: { page: 'tags' } })
}
</script>

<template>
  <div class="tp" @click.stop>
    <div class="tp-chips">
      <span v-for="t in tags" :key="t" class="tp-chip">#{{ t }} <span class="tp-x" @click="removeTag(t)">×</span></span>
      <span class="tp-add" @click.stop="openPop">＋ 标签</span>
    </div>
    <Teleport :to="overlayTarget">
      <div v-if="open" class="tp-mask" @click="open = false" />
      <div v-if="open" class="tp-pop" :style="{ left: popLeft + 'px', top: popTop + 'px' }" @click.stop>
        <div class="tp-head">🏷 选择标签 <span class="tp-sub">来自标签管理体系（设置 → 标签管理）</span></div>
        <input v-model="q" class="tp-search" placeholder="搜索标签，或输入名称后新建…">
        <div class="tp-list">
          <!-- 标签体系为空：引导去标签管理创建 -->
          <div v-if="!flat.length" class="tp-guide">
            <div class="tp-guide-icon">🏷</div>
            <div class="tp-guide-title">标签体系还未创建</div>
            <div class="tp-guide-desc">标签统一在「设置 → 标签管理」中搭建（支持两级），创建后会自动出现在这里供勾选。</div>
            <button class="tp-guide-btn" @click="goTagManage">🏷 去标签管理创建</button>
            <div class="tp-new" @click="createNew">或输入「{{ q.trim() || '标签名' }}」快速新建根标签</div>
          </div>
          <template v-else>
            <label v-for="t in visible" :key="t.id" class="tp-item" :style="{ paddingLeft: 10 + t.depth * 16 + 'px' }"
              :class="{ on: tags.includes(valOf(t)) }" @click="toggle(valOf(t))">
              <span class="tp-name">{{ t.name }}</span>
              <span v-if="t.depth > 0" class="tp-pathtext">{{ t.path }}</span>
            </label>
            <div v-if="!visible.length" class="tp-new" @click="createNew">
              {{ q.trim() ? `＋ 新建标签「${q.trim()}」并选中` : '没有标签' }}
            </div>
          </template>
        </div>
        <div class="tp-foot">
          <button class="tp-btn" @click="open = false">完成</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.tp { position: relative; }
.tp-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.tp-chip { display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px; background: var(--accent-light); border-radius: 99px; font-size: var(--fs-caption); color: var(--accent-ink); }
.tp-chip .tp-x { cursor: pointer; opacity: .6; font-size: var(--fs-tiny); }
.tp-chip .tp-x:hover { opacity: 1; }
.tp-add { font-size: var(--fs-caption); color: var(--text-3); cursor: pointer; padding: 3px 9px; border: 1px dashed var(--border-strong); border-radius: 99px; transition: all var(--dur); }
.tp-add:hover { color: var(--accent); border-color: var(--accent); }
.tp-mask { position: fixed; inset: 0; z-index: var(--z-picker); }
.tp-pop { position: fixed; z-index: calc(var(--z-picker) + 1); width: 300px; max-width: 92vw; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--shadow-lg); overflow: hidden; }
.tp-head { padding: 12px 14px 0; font-size: var(--fs-body); font-weight: 600; color: var(--text); }
.tp-head .tp-sub { display: block; font-size: var(--fs-tiny); color: var(--text-3); font-weight: 400; margin-top: 2px; }
.tp-search { width: calc(100% - 20px); margin: 10px 10px 6px; border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; font-size: var(--fs-sub); outline: none; font-family: inherit; background: var(--surface); color: var(--text); }
.tp-search:focus { border-color: var(--accent); }
.tp-list { max-height: 260px; overflow-y: auto; padding: 4px 6px 8px; }
.tp-item { display: flex; align-items: center; gap: 8px; padding: 7px 8px; border-radius: 6px; cursor: pointer; transition: background .1s; }
.tp-item:hover { background: var(--surface-2); }
.tp-name { font-size: var(--fs-sub); color: var(--text); flex-shrink: 0; }
.tp-pathtext { font-size: var(--fs-tiny); color: var(--text-4); margin-left: auto; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tp-new { padding: 10px; text-align: center; font-size: var(--fs-sub); color: var(--accent); cursor: pointer; border-top: 1px dashed var(--border); }
.tp-new:hover { background: var(--accent-light); }
/* 标签体系为空的引导 */
.tp-guide { padding: 18px 16px 12px; text-align: center; }
.tp-guide-icon { font-size: 30px; opacity: .5; margin-bottom: 6px; }
.tp-guide-title { font-size: var(--fs-body); font-weight: 700; color: var(--text); margin-bottom: 5px; }
.tp-guide-desc { font-size: var(--fs-sub); color: var(--text-3); line-height: 1.7; margin-bottom: 12px; }
.tp-guide-btn { padding: 8px 16px; border-radius: 8px; border: 1px solid var(--accent); background: var(--accent); color: #fff; font-size: var(--fs-sub); font-weight: 600; cursor: pointer; font-family: inherit; }
.tp-guide-btn:hover { background: var(--accent-hover); }
.tp-foot { padding: 8px 10px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; }
.tp-btn { padding: 5px 14px; border-radius: 6px; border: 1px solid var(--accent); background: var(--accent); color: #fff; font-size: var(--fs-sub); cursor: pointer; font-family: inherit; }
</style>
