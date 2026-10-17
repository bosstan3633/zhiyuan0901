#!/usr/bin/env node
/* G6（V3.8.27）：把「四主题对比度」挂到提交前。

   为什么挂在提交前而不是发版前：主题走查原本靠人记得"这次改的是颜色，得跑一下"。
   而颜色改动最容易漏判——`color-mix()`、`--accent` 淡底、深色主题下的 `#fff` 主按钮，
   肉眼在一种主题下看是好的，换主题就掉到 3:1 以下。机器能算，就别让人记。

   做法：写 `.git/hooks/pre-commit`，只在**动过样式/视图**时跑 theme-contrast（约 0.2s），
   纯文档/脚本提交直接放行，不拖慢日常提交。

   注意：`.git/hooks` 不入库，换机后需再跑一次 `node scripts/install-hooks.cjs`。
   这是有意为之——钩子是本地开发者的选择，不该在 clone 时静默改写别人的 git 行为。
*/
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const root = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim()
const hooksDir = path.join(root, '.git', 'hooks')
const hookPath = path.join(hooksDir, 'pre-commit')

const hook = `#!/bin/sh
# G6（V3.8.27）自动生成，勿手改；重装：node v2/scripts/install-hooks.cjs
# 只在样式/视图有变更时校验四主题对比度——纯文档提交不跑。
staged=$(git diff --cached --name-only --diff-filter=ACMR)
if echo "$staged" | grep -qE '\\.(vue|css|scss)$|tokens\\.css'; then
  echo "[gate] 四主题对比度校验…"
  node v2/scripts/theme-contrast.cjs || {
    echo "[gate] ✗ 主题对比度未达标——提交已阻止。改色值或补 --accent-fg 后重试。"
    exit 1
  }
  node v2/scripts/a11y-tab-audit.cjs --count >/dev/null 2>&1 || true
fi
exit 0
`

fs.mkdirSync(hooksDir, { recursive: true })
fs.writeFileSync(hookPath, hook, { mode: 0o755 })
console.log('已安装 pre-commit →', hookPath)
console.log('触发条件：暂存区含 .vue / .css / .scss；动作：theme-contrast.cjs')
