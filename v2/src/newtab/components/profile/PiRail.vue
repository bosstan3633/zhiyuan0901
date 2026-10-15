<script setup lang="ts">
/**
 * W10（V3.9.0）PiRail —— 时间轴左侧导航 rail。
 * ★V3.8.20：三节点 → 四节点（今天 / 本周 / 本月 / 本年度）——画像洞察新增轻量月度段后，
 * rail 必须给月度段一个落点（否则页面有段、rail 无钮，导航与内容对不上）。
 * active 由宿主通过 IntersectionObserver 驱动。
 */
defineProps<{ active: 'now' | 'week' | 'month' | 'year' }>()
const emit = defineEmits<{ (e: 'jump', k: 'now' | 'week' | 'month' | 'year'): void }>()
</script>

<template>
  <aside class="pi-rail" aria-label="时间轴导航">
    <button class="pi-rnode" :class="{ on: active === 'now' }" @click="emit('jump', 'now')">
      <span class="pi-rdot"></span><span class="pi-rlab">今天<br>TODAY</span>
    </button>
    <button class="pi-rnode" :class="{ on: active === 'week' }" @click="emit('jump', 'week')">
      <span class="pi-rdot"></span><span class="pi-rlab">本周<br>WEEK</span>
    </button>
    <button class="pi-rnode" :class="{ on: active === 'month' }" @click="emit('jump', 'month')">
      <span class="pi-rdot"></span><span class="pi-rlab">本月<br>MONTH</span>
    </button>
    <button class="pi-rnode" :class="{ on: active === 'year' }" @click="emit('jump', 'year')">
      <span class="pi-rdot"></span><span class="pi-rlab">本年度<br>YEAR</span>
    </button>
  </aside>
</template>
