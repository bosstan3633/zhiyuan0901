import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('./views/CompassHome.vue'),
      meta: { title: '知源调度台 · 调度台' }
    },
    {
      // R49（V2.22.0）：旧「今日行动」页整体移除（三件事迁调度台首页、任务管理在调度台底部 Tab）
      path: '/compass/actions',
      redirect: '/'
    },
    {
      // R3-B1（V3.7.x）：**树即首屏**——方向台一级直接渲染完整方向树，
      // CompassShell（主航线 + 内嵌项目详情展板）与 LighthousePanel（锚点条/聚焦条/状态筛选/目标卡网格）退役。
      path: '/compass',
      name: 'compass',
      component: () => import('./views/CompassTree.vue'),
      meta: { title: '知源调度台 · 方向台' }
    },
    {
      // R3-B1：原「完整方向树」二级页与一级合并；老深链（content 快捷动作 / background 开台 / 收藏的 #/compass/tree）
      // 一律带 query 重定向到 /compass，不再另立一份台面
      path: '/compass/tree',
      redirect: to => ({ path: '/compass', query: to.query })
    },
    {
      path: '/compass/projects',
      name: 'compass-projects',
      component: () => import('./views/ProjectCuration.vue'),
      meta: { title: '知源调度台 · 项目详情' }
    },
    {
      // V3.7.0（R179）：仅策展台（论点 + 论证节点卡 + 镜像投射）。资源台已随池语义退役——
      // 工作区不再有 isHub 分支，资源卡统一入池，管理面收敛到调度台「3张卡」。
      path: '/workspace/:id',
      name: 'workspace',
      component: () => import('./views/Workspace.vue'),
      meta: { title: '策展台' }
    },
    {
      // V3.7.0（R179）：资源台退役——旧深链 /curation（含 ?hl/?cat）改投调度台首页；
      // 卡片定位由 ⌘K「定位卡片所在处」走 3张卡高亮（?hk 语义，见 GlobalPopups）。
      path: '/curation',
      name: 'curation',
      redirect: () => ({ path: '/' }),
      meta: { title: '知源调度台 · 调度台' }
    },
    {
      // V3.8.9（W9）：画像洞察页——品牌区入口独立页。吸收原设置页知源仪表盘（概览带+复盘段+操作记录）
      // 与资源生命周期面板；今日战报改为页头入口+中央弹窗。调度台「📈 复盘」与归档提示条均指向此页。
      path: '/profile',
      name: 'profile',
      component: () => import('./views/ProfileInsights.vue'),
      meta: { title: '知源调度台 · 画像洞察' }
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('./views/GlobalSettings.vue'),
      meta: { title: '全局设置' }
    },
    {
      path: '/recycle',
      name: 'recycle',
      component: () => import('./views/RecycleBin.vue'),
      meta: { title: '回收站' }
    },
    {
      path: '/manual',
      name: 'manual',
      component: () => import('./views/ManualPage.vue'),
      meta: { title: '使用手册' }
    }
  ]
})

export default router
