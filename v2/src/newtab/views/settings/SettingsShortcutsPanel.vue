<template>
  <div class="gs-panel">
    <div class="gs-page-header">
      <div class="gs-page-title">快捷键设置</div>
      <div class="gs-page-desc"><Icon name="bulb" :size="13"/> 系统级快捷键（含完整方向树/快速采集任务/同步到 Airtable 等六条无默认键命令）请在浏览器地址栏打开 chrome://extensions/shortcuts 自定义（高效使用知源的第一步）；应用内快捷键开箱即用</div>
      </div>
    <div class="gs-card">
      <div class="gs-card-header"><span class="gs-card-title">全局快捷键（任意网页可用）</span><span class="gs-card-desc">由 Chrome 统一管理 · 下表是本扩展的全部命令，键位显示「未设置」的几条没有默认键，需到 chrome://extensions/shortcuts 手动分配</span></div>
      <div class="gs-card-body">
        <div class="gs-setting-row" v-for="c in chromeCommands" :key="c.name">
          <span class="gs-sr-label">{{ c.description }}</span>
          <div class="gs-sr-control"><span class="gs-keycap">{{ c.shortcut || '未设置' }}</span></div>
          </div>
        <div class="gs-setting-row">
          <span class="gs-sr-label">修改全局快捷键（完整方向树等）</span>
          <div class="gs-sr-control"><a :href="shortcutsUrl" target="_blank" class="gs-shortcut-link">前往 chrome://extensions/shortcuts ›</a></div>
          </div>
        </div>
      </div>
    <div class="gs-card">
      <div class="gs-card-header"><span class="gs-card-title">应用内快捷键</span><span class="gs-card-desc">与「? 快捷键速查面板」和使用手册附录共用一份清单（改键位三处同步，不会脱节）· 切台键随下方修饰键偏好实时变化</span></div>
      <div class="gs-card-body">
        <div class="gs-setting-row">
          <span class="gs-sr-label">应用内切台</span>
          <div class="gs-sr-control">
            <select class="gs-select" v-model="wsMod" @change="saveWsMod">
            <option value="alt">Alt + 数字键（1=调度台、2=方向台、3 起=各策展台）</option>
            <option value="ctrl">Ctrl + 数字键（1=调度台、2=方向台、3 起=各策展台）</option>
            <option value="ctrl-shift">Ctrl + Shift + 数字键</option>
            <option value="alt-shift">Alt + Shift + 数字键</option>
            <option value="none">纯数字键（无修饰键）</option>
            </select>
            </div>
          </div>
        <div class="gs-setting-row" v-for="k in appShortcuts" :key="k.keys">
          <span class="gs-sr-label">{{ k.action }}</span>
          <div class="gs-sr-control"><span class="gs-keycap">{{ k.keys }}</span></div>
          </div>
        </div>
      </div>
    </div>

  <div class="gs-panel">
    <!-- 策展台快捷键（R49-I2 引入；V3.7.0 R179：资源台退役后策展台顺延——1=调度台、2=方向台、3 起=各策展台） -->
    <div class="gs-page-header">
      <div class="gs-page-title"><Icon name="sliders" :size="13"/> 策展台快捷键</div>
      <div class="gs-page-desc">应用内按「修饰键 + 数字」切台：1 = 调度台、2 = 方向台、3 起按台签顺序对应各策展台（拖拽改序后数字键跟随顺序）；完整方向树等浏览器级命令在 chrome://extensions/shortcuts 自定义</div>
      </div>
    <div class="gs-card">
      <div class="gs-card-header"><span class="gs-card-title">映射表（按顶部导航顺序）</span><span class="gs-card-desc">第 N 个策展台 = 修饰键 + (N+2)（最多到数字 9）</span></div>
      <div class="gs-card-body">
        <div class="gs-setting-row" v-for="(w, i) in store.workspaces" :key="w.id">
          <span class="gs-sr-label">第 {{ i + 1 }} 个 · {{ w.icon }} {{ wsDisplayNameOf(w) }}</span>
          <div class="gs-sr-control"><span class="gs-keycap">{{ i + 3 <= 9 ? modLabel() + ' + ' + (i + 3) : '—' }}</span></div>
          </div>
        <div class="gs-setting-row">
          <span class="gs-sr-label">修饰键</span>
          <div class="gs-sr-control"><span class="gs-keycap">{{ modLabel() }} + 数字</span></div>
          </div>
        </div>
      </div>
    </div>
</template>

<script setup lang="ts">
/* V3.8.42 · P0-3 第五批：从 GlobalSettings.vue 原样搬出的「快捷键设置」子域。
   ★本子域含**两个** gs-panel（快捷键设置 / 策展台快捷键），二者原本各带一处
     `v-if="activePage === 'shortcuts'"`。activePage 在宿主，组件内取不到，
     故两处都摘成恒真——**显隐统一交给宿主那一层**：
     `<SettingsShortcutsPanel v-if="activePage === 'shortcuts'" />`。
     ★反过来做（把 v-if 留在子域、或让子域自己判断当前页）会让这一页常驻挂载、其余四页各冒一份。
   ★props 而非复制：shortcutsUrl 被 extension 子域的「全局快捷键配置」链接共用；
     wsDisplayNameOf 与 import/export 两个子域共用同一份（**沿用既有先例**：
     导出页那两份都是 props 通道，复制第三份就是三处都得改的隐患）。
   ★store / saveUIPrefs 由本组件直接取 —— wsMod 是本子域私有的偏好开关，
     留在宿主就得为一个下拉专设一条通道（先例：extension 子域的 capturePref 随迁）。
   ★样式：本子域**没有私有样式** —— 键帽 .gs-keycap / 行 .gs-setting-row / 下拉 .gs-select /
     快捷键链接 .gs-shortcut-link 与 Airtable、扩展子域共用，已在 settings/base.css（全局表）。 */
import { computed, ref } from "vue"
import Icon from "@/shared/components/Icon.vue"
import { useAppStore } from '../../stores/app'
import { shortcutsOf, modLabelOf } from '@/shared/utils/shortcuts'
import { saveUIPrefs } from '@/shared/storage/repository'

const { shortcutsUrl, wsDisplayNameOf } = defineProps<{
  shortcutsUrl: string
  wsDisplayNameOf: (w: { id: string; name: string; icon: string }) => string
}>()

const store = useAppStore()

// ---- 快捷键设置（H） ----
interface CmdInfo { name: string; description: string; shortcut: string }
const chromeCommands = ref<CmdInfo[]>([])
if (typeof chrome !== 'undefined' && chrome.commands?.getAll) {
  chrome.commands.getAll(cmds => {
    chromeCommands.value = cmds.map(c => ({
      name: c.name || '',
      description: ({
        'open-dashboard': '打开知源调度台（新标签页）',
        'quick-capture': '快速采集当前浏览的页面',
        'search': '打开全局搜索',
        'inspire': '好奇心采集'
      } as Record<string, string>)[c.name || ''] || c.description || c.name || ''
      , shortcut: c.shortcut || '未设置'
    }))
  })
}

const wsMod = computed({
  // B7-e H3：回落值原为 'ctrl'，但 repository 启动迁移会把 'ctrl' 一律改写成 'alt'
  // ⇒ store.ui 未就绪那一瞬，下拉会显示「Ctrl + 数字键」而实际生效的是 Alt——下拉在说一个不存在的状态。
  //   回落必须与 loadUIPrefs 的默认值（alt）一致。
  get: () => store.ui?.wsSwitchMod || 'alt',
  set: (v: 'ctrl' | 'alt') => {
    if (store.ui) { store.ui.wsSwitchMod = v; saveUIPrefs({ wsSwitchMod: v }) }
  }
})
function saveWsMod() { /* computed setter 已持久化 */ }

/** 第廿九轮：快捷键跟随位置（顺序即快捷键），自定义绑定已移除——槽位由顶部 Tab 顺序派生 */
/** B7-e H3：文案走 shortcuts.ts 的 MOD_LABELS，不再在本页另抄一份映射表 */
function modLabel(): string {
  return modLabelOf(store.ui?.wsSwitchMod || 'alt')
}

// B7-e H3：应用内快捷键不再各写一份清单——与速查面板、手册同源（shared/utils/shortcuts.ts）。
// ★此前这份是手写的 5 条，且**混进了根本不是快捷键的行**（「资源卡批量管理 · 资源卡池控制行『批量』」
//   那是个按钮位置，不是按键），同时漏掉了真实存在的「? 呼出速查」与切台三键。
//   现按分组从真源取「应用内」+「编辑与检索」两组，全局四条归上面的 Chrome 命令表（键位由浏览器管）。
const appShortcuts = computed(() => [
  ...shortcutsOf('应用内', store.ui?.wsSwitchMod || 'alt'),
  ...shortcutsOf('编辑与检索', store.ui?.wsSwitchMod || 'alt'),
])
</script>

<!-- 基类：.gs-panel / .gs-card / .gs-setting-row / .gs-keycap / .gs-select / .gs-shortcut-link
     （V3.8.42 外提为全局表 settings/base.css，非 scoped —— scoped 命中不了子组件内部元素） -->
<style src="./base.css"></style>
