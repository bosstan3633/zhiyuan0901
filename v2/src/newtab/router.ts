import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('./views/CompassHome.vue'),
      meta: { title: '知源工作台 · 首页' }
    },
    {
      path: '/compass',
      component: () => import('./views/CompassShell.vue'),
      redirect: '/compass/actions',
      children: [
        {
          path: 'actions',
          name: 'compass-actions',
          component: () => import('./views/CompassActions.vue'),
          meta: { title: '知源罗盘 · 今日行动' }
        },
        {
          path: 'projects',
          name: 'compass-projects',
          component: () => import('./views/ProjectCuration.vue'),
          meta: { title: '知源罗盘 · 项目策展' }
        },
        {
          path: 'tree',
          name: 'compass-tree',
          component: () => import('./views/CompassTree.vue'),
          meta: { title: '知源罗盘 · 方向树' }
        }
      ]
    },
    {
      path: '/workspace/:id',
      name: 'workspace',
      component: () => import('./views/Workspace.vue'),
      meta: { title: '工作台' }
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
