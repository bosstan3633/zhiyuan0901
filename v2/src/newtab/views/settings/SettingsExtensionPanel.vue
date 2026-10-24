<template>
  <div class="gs-panel">
  <div class="gs-page-header">
      <div class="gs-page-title"><Icon name="plug" :size="13"/> 浏览器扩展设置</div>
      <div class="gs-page-desc">配置浏览器扩展的连接和抓取行为</div>
    </div>
    <div class="gs-card">
      <div class="gs-card-header"><span class="gs-card-title">连接状态</span></div>
      <div class="gs-card-body">
        <div class="gs-setting-row">
          <span class="gs-sr-label">扩展状态</span>
          <div class="gs-sr-control"><span class="gs-status-badge connected"><span class="gs-status-dot"></span>已连接</span></div>
        </div>
        <div class="gs-setting-row">
          <span class="gs-sr-label">扩展版本</span>
          <div class="gs-sr-control gs-sr-note">V{{ runtimeVersion }}</div>
        </div>
      </div>
    </div>
    <div class="gs-card">
      <div class="gs-card-header"><span class="gs-card-title">抓取设置</span></div>
      <div class="gs-card-body">
        <div class="gs-setting-row">
          <span class="gs-sr-label">快速抓取快捷键</span>
          <div class="gs-sr-control">
            <a :href="shortcutsUrl" target="_blank" class="gs-keycap gs-keycap-link">Ctrl+Shift+J</a>
          </div>
        </div>
        <!-- R1.5：「默认存入台面」选择器随资源台退役删除——采集单形态落「🗂 资源卡池」，defaultWsId 零消费方 -->
        <div class="gs-setting-row">
          <span class="gs-sr-label">自动取文件夹名</span>
          <div class="gs-sr-control"><div class="gs-toggle" v-pressable role="switch" :aria-checked="capturePref.autoFolderName" :class="{ on: capturePref.autoFolderName }" @click="capturePref.autoFolderName = !capturePref.autoFolderName; persistCapturePref()"></div></div>
        </div>
        <div class="gs-setting-row">
          <span class="gs-sr-label">抓取后确认弹窗</span>
          <div class="gs-sr-control"><div class="gs-toggle on" v-pressable role="switch" aria-checked="true" @click="showToast('快捷键采集始终显示确认弹窗')"></div></div>
        </div>
        <div class="gs-setting-row">
          <span class="gs-sr-label">全局快捷键配置</span>
          <div class="gs-sr-control">
            <a :href="shortcutsUrl" target="_blank" class="gs-shortcut-link">前往 chrome://extensions/shortcuts ›</a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/* V3.8.42 · P0-3 第三批：从 GlobalSettings.vue 原样搬出的「扩展设置」子域。
   ★props 而非各自复制：runtimeVersion 三子域共用（changelog/about 也在用），
     shortcutsUrl 被 shortcuts 子域的两处链接共用——复制一份就是两处都得改的隐患。
   ★抓取偏好（capturePref）随迁：它只服务本子域的「自动取文件夹名」开关，
     留在宿主就得为一个开关专设一条 props 通道（关于 shared 也只有本组件写）。
   ★样式：本子域**没有私有样式**——状态徽章 / 按键帽 / 快捷键链接都与 Airtable、快捷键子域共用，
     已随第三批并入共享基类 settings/base.css（全局表）。 */
import Icon from '@/shared/components/Icon.vue'
import { reactive } from 'vue'
import { K } from '@/shared/storage/keys'
import { showToast } from '@/shared/components/toast'

defineProps<{
  runtimeVersion: string
  shortcutsUrl: string
}>()

// ---- 抓取偏好 ----
const capturePref = reactive({ defaultWsId: '', autoFolderName: true })
// R1.5：defaultCaptureWs 计算属性随「默认存入台面」控件退役（采集单形态落池，defaultWsId 零消费方）
function persistCapturePref() {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.set({ zy_capture_pref: { ...capturePref } })
  }
}
if (typeof chrome !== 'undefined' && chrome.storage) {
  chrome.storage.local.get(K.CAPTURE_PREF).then(r => {
    if (r.zy_capture_pref) Object.assign(capturePref, r.zy_capture_pref)
  })
}
</script>

<!-- 基类：.gs-card / .gs-setting-row / .gs-status-badge / .gs-keycap…（V3.8.42 外提为全局表） -->
<style src="./base.css"></style>
