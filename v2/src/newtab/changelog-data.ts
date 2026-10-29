/**
 * 产品更新日志 · 数据入口（R181 拆分后的稳定读取面）。
 * 类型与分组规则在 ./changelog-data/types，V3 / V2 条目分别在 entries-v3 / entries-v2。
 */
export type { ChangelogKind, ChangelogEntry, ChangelogGroup } from './changelog-data/types'
export { CL_SECTIONS, kindGroupsOf } from './changelog-data/types'

import { CHANGELOG_V3 } from './changelog-data/entries-v3'
import { CHANGELOG_V2 } from './changelog-data/entries-v2'
import type { ChangelogEntry } from './changelog-data/types'

/** 最新在前：V3 条目在前，V2 历史条目在后。 */
export const CHANGELOG: ChangelogEntry[] = [...CHANGELOG_V3, ...CHANGELOG_V2]
