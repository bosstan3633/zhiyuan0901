<script setup lang="ts">
/**
 * G3（V3.8.27）：全站空状态唯一实现。
 *
 * 契约（四条，缺一不算收口）：
 *   ① icon  —— 必须是系统 Icon 名（非 emoji），由 Icon.vue 渲染；名不存在时判据 P0-S4 会红。
 *   ② title —— **是什么**：一句话说清"这里为什么是空的"，不评价、不催促。
 *   ③ hint  —— **怎么开始**：一句话给出第一步动作（快捷键 / 按钮位置 / 下一步去哪）。
 *   ④ action—— 可选主行动；没有可点的主行动时（如回收站），只留 ②③ 也合规（D3 特例）。
 *
 * 三档尺寸：
 *   page    整页兜底（方向台无目标 / 项目详情无项目）—— 大留白
 *   section 区块/面板兜底（默认，与旧版像素一致，避免存量 6 处位移）
 *   inline  列表内联兜底（筛选无结果 / 小面板）
 *
 * ★为什么不给 desc 改名：存量 6 处调用已传 desc，改名会静默丢文案。desc 保留为
 *   "补充说明"，hint 是新增的"怎么开始"，两者可分可合。
 */
import Icon from './Icon.vue'

withDefaults(defineProps<{
  icon?: string
  title: string
  desc?: string
  hint?: string
  actionLabel?: string
  secondaryLabel?: string
  size?: 'page' | 'section' | 'inline'
}>(), { icon: 'folder', size: 'section' })

defineEmits<{ action: []; secondary: [] }>()
</script>

<template>
  <!-- 尺寸类写成显式映射而不是模板字符串：dead-css-scan 的"插值前缀票"只认尾巴 ≤3 字符，
       `es-${size}` 的尾巴是 4 个字符，会被误判成死规则。显式映射既让扫描器读得到，
       也让"有哪三档"在模板里一眼可见。 -->
  <div class="es" :class="{
    'es-section': size === 'section',
    'es-page': size === 'page',
    'es-inline': size === 'inline'
  }">
    <div class="es-art"><Icon :name="icon" :size="size === 'page' ? 34 : 28" /></div>
    <div class="es-title">{{ title }}</div>
    <div v-if="desc" class="es-desc">{{ desc }}</div>
    <div v-if="hint" class="es-hint">{{ hint }}</div>
    <div v-if="actionLabel || secondaryLabel" class="es-acts">
      <button v-if="actionLabel" class="es-btn" @click="$emit('action')">{{ actionLabel }}</button>
      <button v-if="secondaryLabel" class="es-btn es-btn-ghost" @click="$emit('secondary')">{{ secondaryLabel }}</button>
    </div>
  </div>
</template>

<style scoped>
.es { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.es-section { padding: 44px 20px; }
.es-page { padding: 64px 20px; }
.es-inline { padding: 22px 12px; }

.es-art {
  display: flex; align-items: center; justify-content: center;
  width: 72px; height: 72px; border-radius: 16px;
  border: 1px dashed var(--border-strong);
  color: var(--text-4); margin-bottom: 14px;
}
.es-page .es-art { width: 86px; height: 86px; border-radius: 20px; }
.es-inline .es-art { width: 44px; height: 44px; border-radius: 10px; margin-bottom: 10px; }

.es-title { font-size: var(--fs-body); font-weight: 600; color: var(--text); margin-bottom: 4px; }
.es-page .es-title { font-size: var(--fs-title); }
.es-desc { font-size: var(--fs-sub); color: var(--text-3); line-height: 1.7; max-width: 340px; margin-bottom: 6px; white-space: pre-line; }
.es-page .es-desc { max-width: 400px; }

/* hint = 「怎么开始」：比 desc 稍亮，作为可执行提示与说明分层 */
.es-hint { font-size: var(--fs-sub); color: var(--text-2); line-height: 1.7; max-width: 380px; }
.es-acts { display: flex; gap: 8px; margin-top: 14px; }

.es-btn {
  padding: 7px 16px; border-radius: var(--radius-sm);
  border: 1px solid var(--accent); background: var(--accent); color: #fff;
  font-size: var(--fs-sub); font-weight: 600; cursor: pointer; font-family: inherit;
}
.es-btn:hover { background: var(--accent-hover); border-color: var(--accent-hover); }
.es-btn-ghost { background: transparent; color: var(--accent-ink); border-color: var(--border-strong); }
.es-btn-ghost:hover { background: var(--accent-light); border-color: var(--accent); }
</style>
