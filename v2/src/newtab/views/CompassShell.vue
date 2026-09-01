<script setup lang="ts">
import Icon from '@/shared/components/Icon.vue'
/**
 * 知源罗盘 · 一级工作区容器
 * 版式与工作台对齐：Hero 封面 + 左侧栏（子页导航）+ 内容区（子路由）
 * 子页按操作频率排序：今日行动 → 项目策展 → 方向树
 */
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import { useCompass } from '../stores/compass'
import { dateKey } from '@/shared/utils'
import { saveUIPrefs } from '@/shared/storage/repository'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const { d, allProjects } = useCompass()

const todayUndone = computed(() => {
  const list = d.value.dailyFocus[dateKey(new Date())] || []
  return list.filter(s => !s.done).length
})
const goalsCount = computed(() => d.value.compass.directions.length)
const projectsCount = computed(() => allProjects().length)
const pinnedCount = computed(() => allProjects().filter(p => p.pinnedToLighthouse).length)

const activePage = computed(() => {
  if (route.path.startsWith('/compass/projects')) return 'projects'
  if (route.path.startsWith('/compass/tree')) return 'tree'
  return 'actions'
})

// 记住上次停留的子页
watch(() => route.fullPath, (fp) => {
  if (fp.startsWith('/compass/')) {
    const tab = fp.split('?')[0] as '/compass/actions' | '/compass/projects' | '/compass/tree'
    if (store.ui && store.ui.compassTab !== tab) {
      store.ui.compassTab = tab
      saveUIPrefs({ compassTab: tab })
    }
  }
})

function nav(sub: string) { router.push('/compass/' + sub) }
</script>

<template>
  <div class="compass-page">
    <!-- Hero（版式对齐工作台封面） -->
    <div class="compass-hero">
      <div class="hero-name"><span class="icon"><Icon name="compass" :size="20" /></span>知源罗盘</div>
      <div class="hero-desc">看见：大方向（六层思维链） → 项目（中观策展） → 每日行动（今日三件事）</div>
      <div class="hero-bottom">
        <div class="hero-stats">
          <span class="stat"><Icon name="target" :size="13" /> <b>{{ goalsCount }}</b> 战略目标</span>
          <span class="stat"><Icon name="layers" :size="13" /> <b>{{ projectsCount }}</b> 攻坚项目</span>
          <span class="stat"><Icon name="radio" :size="13" /> <b>{{ pinnedCount }}</b> 已投射灯塔</span>
          <span class="stat"><Icon name="flame" :size="13" /> <b>{{ todayUndone }}</b> 今日要事</span>
        </div>
        <div class="hero-actions">
          <button class="hero-btn primary" @click="nav('projects')"><Icon name="layout" :size="13" /> 项目策展</button>
          <button class="hero-btn ghost" @click="nav('tree')"><Icon name="branch" :size="13" /> 方向树</button>
        </div>
      </div>
    </div>

    <div class="compass-body">
      <!-- 左侧栏（版式对齐工作台分类导航） -->
      <aside class="comp-sidebar">
        <div class="cs-label">罗盘工作区</div>
        <div class="cat-item" :class="{active: activePage==='actions'}" @click="nav('actions')">
          <span class="ci"><Icon name="flame" :size="15" /></span><span class="cn">今日行动</span><span class="cc">{{ todayUndone }} 待办</span>
        </div>
        <div class="cat-item" :class="{active: activePage==='projects'}" @click="nav('projects')">
          <span class="ci"><Icon name="layout" :size="15" /></span><span class="cn">项目策展</span><span class="cc">{{ projectsCount }} 项目</span>
        </div>
        <div class="cat-item" :class="{active: activePage==='tree'}" @click="nav('tree')">
          <span class="ci"><Icon name="branch" :size="15" /></span><span class="cn">方向树</span><span class="cc">{{ goalsCount }} 目标</span>
        </div>
        <div class="cat-divider"></div>
        <div class="side-note">方向树给「为什么」<br>项目策展给「是什么」<br>今日行动给「做什么」</div>
      </aside>

      <main class="comp-content">
        <!-- 第十三轮：移除子页 out-in 过渡，罗盘内切换即时渲染 -->
        <router-view v-slot="{ Component }">
          <component :is="Component" />
        </router-view>
      </main>
    </div>
  </div>
</template>

<style scoped>
.compass-page { padding: 0 20px 24px; min-height: calc(100vh - 52px); }

/* Hero（对齐工作台封面） */
/* P2 视觉重构：Hero 改为 Linear 表面面板（surface-1 + 发丝线），去装饰渐变与光晕 */
.compass-hero { position: relative; height: 128px; background: var(--surface); border-bottom: 1px solid var(--border); border-radius: 0 0 12px 12px; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end; padding: 0 28px 16px; }
.hero-name { font-size: 21px; font-weight: 600; color: var(--text); display: flex; align-items: center; gap: 10px; position: relative; z-index: 1; letter-spacing: .3px; }
.hero-name .icon { color: var(--accent); display: flex; align-items: center; }
.hero-desc { font-size: 12.5px; color: var(--text-3); margin-top: 3px; position: relative; z-index: 1; }
.hero-bottom { display: flex; align-items: center; gap: 16px; margin-top: 9px; position: relative; z-index: 1; }
.hero-stats { display: flex; gap: 14px; font-size: 11.5px; color: var(--text-3); }
.hero-stats .stat { display: inline-flex; align-items: center; gap: 5px; }
.hero-btn { gap: 6px; }
.hero-btn svg { flex-shrink: 0; }
.hero-stats b { color: var(--text); font-weight: 600; }
.hero-actions { margin-left: auto; display: flex; gap: 8px; }
.hero-btn { padding: 6px 14px; border-radius: 8px; font-size: 12px; cursor: pointer; transition: all .15s; display: flex; align-items: center; gap: 5px; font-weight: 500; border: none; font-family: inherit; }
.hero-btn.primary { background: var(--accent); color: #fff; }
.hero-btn.primary:hover { transform: translateY(-1px); }
.hero-btn.ghost { background: var(--surface-2); color: var(--text-2); border: 1px solid var(--border); }
.hero-btn.ghost:hover { background: var(--surface-3); color: var(--text); }

/* Body */
.compass-body { display: flex; min-height: calc(100vh - 52px - 128px); }
.comp-sidebar { width: 190px; flex-shrink: 0; border-right: 1px solid var(--border); background: var(--surface); padding: 14px 10px; overflow-y: auto; }
.cs-label { font-size: 10px; font-weight: 700; color: var(--text-3); letter-spacing: .5px; padding: 0 10px 8px; }
.cat-item { display: flex; align-items: center; gap: 8px; padding: 9px 10px; border-radius: 8px; font-size: 12.5px; color: var(--text-2); cursor: pointer; transition: all .12s; margin-bottom: 2px; border: 1px solid transparent; }
.cat-item:hover { background: var(--surface-3); color: var(--text); }
.cat-item.active { background: var(--accent-light); color: var(--accent); font-weight: 600; border-color: rgba(14,122,78,.2); }
.cat-item .ci { font-size: 14px; flex-shrink: 0; }
.cat-item .cn { flex: 1; }
.cat-item .cc { font-size: 10px; color: var(--text-3); background: var(--surface-2); padding: 1px 7px; border-radius: 99px; }
.cat-item.active .cc { background: var(--surface); color: var(--accent); }
.cat-divider { height: 1px; background: var(--border); margin: 8px 10px; }
.side-note { font-size: 10px; color: var(--text-4); padding: 8px 10px; line-height: 1.8; }

.comp-content { flex: 1; min-width: 0; padding: 20px 26px 60px; }


@media (max-width: 1080px) {
  .comp-sidebar { width: 64px; }
  .cs-label, .cat-item .cn, .cat-item .cc, .side-note, .cat-divider { display: none; }
  .cat-item { justify-content: center; padding: 11px 0; }
}
</style>
