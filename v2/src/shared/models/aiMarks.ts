/**
 * R147-e：AI 写进卡片正文的「出品溯源」前缀，唯一真源。
 * 写方是 shared/ai/batchG.ts，读方是只览组件 ThesisBlock.vue——两边必须吃同一串字面量，
 * 否则论点一改格式，结构化预览就静默失效。
 * 单独成模块的原因：消费面（ResourceDetailDrawer）挂在启动链上，
 * 绝不能再把 shared/ai/* 静态引回来（R134-2 的 248KB 教训）。
 */
export const THESIS_MARK = '🤖 中心论点：'
export const THESIS_WHY_MARK = '依据：'
export const THESIS_PARTS_MARK = '🤖 论点骨架（MECE）：'
