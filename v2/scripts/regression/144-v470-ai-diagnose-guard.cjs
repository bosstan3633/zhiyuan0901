/**
 * V4.7.0 · P0 AI 诊断空指针守卫。
 *
 * 事故：项目诊断的 parse() 只产出 `{ key, badge, main }`，没有 data 字段；
 * AiSuggestionDrawer 的 watch(shown) 却直接读 `v[0].data.__verdict`，点击项目 AI 诊断即抛
 * `Cannot read properties of undefined (reading '__verdict')`。
 *
 * 本片只守三件事：
 * 1. 不得再对 `v[0].data` 做无保护判词直读；
 * 2. 判词行必须按内容查找，且只接受字符串判词（布尔标记行不是判词）；
 * 3. 每个新 job 必须清空上一轮的判词选择与标题，避免串判词。
 */
const { check, read, codeOnly, fnBody } = require('./helpers.cjs')

console.log('【V4.7.0 · P0 AI 诊断空指针守卫】')

const DRAWER = codeOnly(read('/newtab/components/AiSuggestionDrawer.vue'))

check('AI470-1 ★项目诊断建议行没有 data 时，判词监听不得再直读 v[0].data.__verdict', () => {
  if (!DRAWER) return false
  if (/v\[0\]\.data\s+as\s*\{\s*__verdict/.test(DRAWER)) return false
  if (DRAWER.includes('watch(shown, (v) => { if (v.length && !verdictPick.value)')) return false
  return true
})

check('AI470-2 ★判词行按内容查找，不再默认首行；只接受字符串判词，布尔标记行不误选', () => {
  return DRAWER.includes('shown.value.find(row =>')
    && DRAWER.includes("typeof data?.__verdict === 'string'")
    && DRAWER.includes('const firstVerdict = v.find(row =>')
    && DRAWER.includes("typeof data?.__verdict === 'string' && data.__verdict.length > 0")
    && DRAWER.includes('firstVerdict.data as { __verdict: string }')
    && !DRAWER.includes('const verdictRow = computed(() => shown.value[0])')
})

check('AI470-3 ★每次 run(job) 必须清空上一 job 的判词选择与标题，避免串判词', () => {
  const body = fnBody(DRAWER, 'async function run(job: AiJob) {', '\nwatch(() => [props.job, keyOf.value]')
  if (!body) return false
  return body.includes("verdictPick.value = ''")
    && body.includes("verdictTitle.value = ''")
})

check('AI470-4 ★项目诊断仍保持“建议行无 data”的契约，不得为了绕错给每行塞假判词', () => {
  const diag = codeOnly(read('/shared/ai/projectDiagnose.ts'))
  return diag.includes("rows.push({ key: 'adv:' + rows.length")
    && !diag.includes('__verdict')
})
