import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      redirect: { name: 'list' },
      component: () => import('@/views/HomeView.vue'),
      children: [
        {
          path: 'list/:catchAll(.*)*',
          name: 'list',
          component: () => import('@/views/explorer/ListView.vue'),
        },
      ],
    },
    {
      path: '/auth',
      name: 'auth',
      component: () => import('@/views/AuthView.vue')
    },

  ]
})

export default router
