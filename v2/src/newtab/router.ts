import { createRouter, createWebHashHistory } from 'vue-router'
import { CURATION_WS_ID } from '@/shared/models'

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
      // 方向台：满宽模块页；projects=项目详情二级页、tree=完整方向树二级页
      path: '/compass',
      component: () => import('./views/CompassShell.vue'),
      children: [
        {
          path: 'projects',
          name: 'compass-projects',
          component: () => import('./views/ProjectCuration.vue'),
          meta: { title: '知源调度台 · 项目详情' }
        },
        {
          path: 'tree',
          name: 'compass-tree',
          component: () => import('./views/CompassTree.vue'),
          meta: { title: '知源调度台 · 完整方向树' }
        }
      ]
    },
    {
      path: '/workspace/:id',
      name: 'workspace',
      component: () => import('./views/Workspace.vue'),
      meta: { title: '策展台' }
    },
    {
      // R73（R16 收敛）：资源台两入口合一。
      // 旧路径 /curation 不再渲染独立组件，改为 redirect 到 hub 工作区（Workspace.vue 的 isHub 分支）；
      // 显式透传 to.query，保住 ?hl=<cardId> 高亮定位与 ?cat= 分类定位。
      // 顶栏「资源台」仍 navigate('/curation')，由本 redirect 落到 /workspace/zy-curation。
      path: '/curation',
      name: 'curation',
      redirect: to => ({ path: '/workspace/' + CURATION_WS_ID, query: to.query }),
      meta: { title: '知源调度台 · 资源台' }
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
