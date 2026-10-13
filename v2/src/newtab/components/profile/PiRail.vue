<script setup lang="ts">
/**
 * W10（V3.9.0）PiRail —— 时间轴左侧导航 rail。
 * 三个节点：今天 / 近期 / 全年。active 由宿主通过 IntersectionObserver 驱动。
 */
defineProps<{ active: 'now' | 'recent' | 'year' }>()
const emit = defineEmits<{ (e: 'jump', k: 'now' | 'recent' | 'year'): void }>()
</script>

<template>
  <aside class="pi-rail" aria-label="时间轴导航">
    <button class="pi-rnode" :class="{ on: active === 'now' }" @click="emit('jump', 'now')">
      <span class="pi-rdot"></span><span class="pi-rlab">今天<br>TODAY</span>
    </button>
    <button class="pi-rnode" :class="{ on: active === 'recent' }" @click="emit('jump', 'recent')">
      <span class="pi-rdot"></span><span class="pi-rlab">近期<br>WEEK</span>
    </button>
    <button class="pi-rnode" :class="{ on: active === 'year' }" @click="emit('jump', 'year')">
      <span class="pi-rdot"></span><span class="pi-rlab">全年<br>YEAR</span>
    </button>
  </aside>
</template>
