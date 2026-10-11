/**
 * W5（V3.8.5）#6 今日战报：全局「打开某日战报」请求通道（模块级单例）。
 *
 * 为什么不是直接改 selDay：热力图的 `selDay` 状态住在 HeatmapModule 的 useDashboardStats 实例里，
 * 而品牌区（App.vue 顶栏）在它外面——顶栏不 import 调度台视图、视图也不该被顶栏逐层传 props。
 * 这里放一个模块级 ref 做单次请求：品牌区 `requestDailyLog()` 写入日期，
 * HeatmapModule watch 到后消费（置 dash.selDay + 校正年份），跨路由时先 navigate('/') 再等挂载。
 *
 * 口径：day 省略 = 今天（todayKey，本地时区，与热力图 today 同源）。
 */
import { ref } from 'vue'
import { todayKey } from '@/shared/utils/reviewReport'

const pendingDay = ref<string | null>(null)

/** 请求打开某日战报（省略 day = 今天）。已挂载的 HeatmapModule 会立即消费；未挂载则挂载后消费。 */
export function requestDailyLog(day?: string): void {
  pendingDay.value = day || todayKey()
}

export function useDailyLogRequest() {
  /** 取出并清空待处理请求（HeatmapModule 专用） */
  function consume(): string | null {
    const d = pendingDay.value
    pendingDay.value = null
    return d
  }
  return { pendingDay, consume }
}
