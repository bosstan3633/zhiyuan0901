import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { crx } from '@crxjs/vite-plugin'
import UnoCSS from 'unocss/vite'
import { transform as transformCss } from 'lightningcss'
import { fileURLToPath, URL } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import manifest from './src/manifest'

/**
 * R114-59：content script 隔离世界里的相对动态 import 会被浏览器解析到**宿主页 origin**
 * （如 https://目标站/assets/chunk-*.js → 404 / MIME 拒绝 → 浮层实现与拼音字典链路静默失效，
 * 且每次 Ctrl+K 都要吃一次 404 网络往返——这正是「全局搜索慢」的元凶之一）。
 * 构建期把 dist 内所有相对路径动态 import 统一改写为 chrome.runtime.getURL 绝对路径——
 * content 与扩展页两个世界都有 chrome.runtime，改写对两界皆安全、零行为差异。
 */
function fixContentDynamicImports() {
  return {
    name: 'fix-content-dynamic-imports',
    closeBundle() {
      const dir = fileURLToPath(new URL('./dist/assets', import.meta.url))
      if (!fs.existsSync(dir)) return
      let fixed = 0
      for (const f of fs.readdirSync(dir)) {
        if (!f.endsWith('.js')) continue
        const p = path.join(dir, f)
        const src = fs.readFileSync(p, 'utf8')
        const out = src.replace(/import\((["'])(\.\.?\/[^"']+\.js)\1\)/g, (_m, _q, rel: string) => {
          const name = rel.replace(/^(\.\.\/)+/, '').replace(/^assets\//, '')
          fixed++
          return `import(chrome.runtime.getURL("assets/${name}"))`
        })
        if (out !== src) fs.writeFileSync(p, out)
      }
      if (fixed) console.log(`  [fix-content-dynamic-imports] 改写 ${fixed} 处相对动态 import → chrome.runtime.getURL`)
    }
  }
}

/**
 * 发布包体积预算只计算 dist 内最终落盘字节，而 Vite 生成的 manifest 和 HTML
 * 仍会保留人类可读的缩进、换行与内联样式注释。这里只做格式压缩：
 * manifest 仍是合法 JSON，HTML 的标签结构、脚本和文本内容不变。
 */
function compactBuildArtifacts() {
  return {
    name: 'compact-build-artifacts',
    closeBundle() {
      const dist = fileURLToPath(new URL('./dist', import.meta.url))
      const manifestPath = path.join(dist, 'manifest.json')
      if (fs.existsSync(manifestPath)) {
        const data = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
        fs.writeFileSync(manifestPath, JSON.stringify(data))
      }

      for (const rel of ['src/newtab/index.html', 'src/options/index.html']) {
        const file = path.join(dist, rel)
        if (!fs.existsSync(file)) continue
        let html = fs.readFileSync(file, 'utf8')
        html = html.replace(/<!--[\s\S]*?-->/g, '')
        html = html.replace(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gi, (_m, css: string) => {
          try {
            const minified = transformCss({
              filename: 'inline.css',
              code: Buffer.from(css),
              minify: true,
              targets: { chrome: 120 << 16 }
            }).code.toString()
            return `<style>${minified}</style>`
          } catch {
            // 内联样式异常时保留原内容，构建不应因压缩失败而破坏启动页。
            return _m
          }
        })
        html = html.replace(/>\s+</g, '><').trim()
        fs.writeFileSync(file, html)
      }
    }
  }
}

/**
 * 手册正文是运行时直接交给 v-html 的静态 HTML。Vite/Terser 只会压缩 JS 语法，
 * 不会碰模板字符串里的缩进和纯标签间空白，于是约 37KB 的正文把无意义排版原样带进安装包。
 * 本插件只在构建期压缩这些 HTML 文本（不改源文件、不删正文），开发态与回归仍读可维护的源稿。
 */
function compactManualHtmlData() {
  let build = false
  const compact = (html: string): string => html
    .replace(/^[\r\n]+\s*/, '')
    .replace(/\s*[\r\n]+$/, '')
    .replace(/[ \t]+$/gm, '')
    .replace(/^[ \t]+/gm, '')
    .replace(/>[\t\r\n ]+</g, '><')
    .replace(/\n{3,}/g, '\n\n')

  return {
    name: 'compact-manual-html-data',
    enforce: 'pre' as const,
    configResolved(config: { command: string }) {
      build = config.command === 'build'
    },
    transform(code: string, id: string) {
      if (!build || !id.replace(/\\/g, '/').endsWith('/src/newtab/manual-data.ts')) return null
      let changed = 0
      const out = code.replace(/(\bhtml:\s*`)([\s\S]*?)(`\s*\})/g, (_match, open: string, html: string, close: string) => {
        const next = compact(html)
        if (next !== html) changed++
        return open + next + close
      })
      if (!changed) return null
      console.log(`  [compact-manual-html-data] 压缩 ${changed} 段手册 HTML（仅构建产物）`)
      return { code: out, map: null }
    }
  }
}

/**
 * 更新日志保留全部历史，但对象字面量会在 193 个版本里重复写入
 * version/date/title/points/kinds 五组键名。构建期把数组收成位置元组，再在运行时映射回
 * 同一 ChangelogEntry 形状；源文件仍然是逐字段可审的可读格式，历史内容一条不删。
 */
function compactChangelogData() {
  let build = false
  return {
    name: 'compact-changelog-data',
    enforce: 'pre' as const,
    configResolved(config: { command: string }) {
      build = config.command === 'build'
    },
    transform(code: string, id: string) {
      const rel = id.replace(/\\/g, '/')
      if (!build || !/(?:entries-v2|entries-v3)\.ts$/.test(rel)) return null
      const sf = ts.createSourceFile(rel, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
      let target: ts.ArrayLiteralExpression | null = null
      const visit = (node: ts.Node) => {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)
          && (node.name.text === 'CHANGELOG_V2' || node.name.text === 'CHANGELOG_V3')
          && node.initializer && ts.isArrayLiteralExpression(node.initializer)) {
          target = node.initializer
          return
        }
        ts.forEachChild(node, visit)
      }
      visit(sf)
      if (!target) return null
      const rows: string[] = []
      for (const element of target.elements) {
        if (!ts.isObjectLiteralExpression(element)) return null
        const fields: Record<string, string> = {}
        for (const prop of element.properties) {
          if (!ts.isPropertyAssignment(prop)) return null
          const key = prop.name.getText(sf).replace(/^['"]|['"]$/g, '')
          fields[key] = prop.initializer.getText(sf)
        }
        if (!fields.version || !fields.date || !fields.title || !fields.points) return null
        rows.push(`[${fields.version},${fields.date},${fields.title},${fields.points}${fields.kinds ? ',' + fields.kinds : ''}]`)
      }
      const replacement = `([
${rows.join(',\n')}
] as const).map(([version, date, title, points, kinds]) => ({ version, date, title, points, kinds })) as ChangelogEntry[]`
      const start = target.getStart(sf)
      const end = target.getEnd()
      console.log(`  [compact-changelog-data] ${path.basename(rel)}：${rows.length} 条历史改为紧凑元组（仅构建产物）`)
      return {
        code: code.slice(0, start) + replacement + code.slice(end),
        map: null
      }
    }
  }
}

export default defineConfig({
  plugins: [
    compactManualHtmlData(),
    compactChangelogData(),
    vue(),
    crx({ manifest }),
    UnoCSS(),
    fixContentDynamicImports(),
    compactBuildArtifacts()
  ],
  // 全项目均为 <script setup> / 组合式 API，Options API 合并与运行时代理分支
  // 可以安全裁掉；这是 Vue 官方支持的编译期能力开关，不改变业务行为。
  define: {
    __VUE_OPTIONS_API__: false,
    __VUE_PROD_DEVTOOLS__: false
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    target: 'esnext',
    // 发布包预算以磁盘字节为准。esbuild 的最小化已接近下限，
    // 改用 Terser 做一次更彻底的符号/表达式折叠，换取稳定的 2 MiB 余量。
    minify: 'terser',
    // Lightning CSS 对 Vue scoped 选择器与自定义属性做更紧的序列化；
    // 不改变选择器层级或运行时样式语义。
    cssMinify: 'lightningcss',
    // MV3 只面向现代 Chromium；显式声明目标，避免为旧浏览器保留无用的兼容降级。
    cssTarget: 'chrome120',
    terserOptions: {
      compress: {
        passes: 4,
        drop_console: false,
        toplevel: true,
        drop_debugger: true,
        // 保留 error/warn：线上排障与失败提示仍依赖它们；只去掉纯开发日志。
        pure_funcs: ['console.log', 'console.info', 'console.debug']
      },
      mangle: {
        toplevel: true
      },
      format: {
        comments: false,
        // Terser 会按 ASI 规则保留必要分号；去掉可选尾分号不改变语句边界。
        semicolons: false
      }
    },
    // R114-59：禁用 modulePreload——其依赖链接以 document base 解析，在 content script 隔离世界
    // 会打到「宿主页 origin」（https://目标站/assets/chunk-*.js → 404 + MIME 报错），
    // 每次 Ctrl+K 白吃 2~3 个跨域 404 往返（全局搜索慢的元凶之一）；扩展场景本地磁盘加载，preload 无收益。
    modulePreload: false,
    // R70：生成 sourcemap（hidden = 产出 .map 但不写引用注释）。
    // 此前 dist 内 0 个 .map，用户侧报错只能拿到压缩后的堆栈（runtimeError.ts 记的错误日志也无法定位）。
    // 用户安装包在打包时排除 *.map，分发体积不变。
    sourcemap: 'hidden',
    rollupOptions: {
      output: {
        chunkFileNames: 'assets/chunk-[hash].js',
        // V3.9.16：pinyin-pro 已退出运行时（两层内联表），旧的 manualChunks 规则只剩死配置，清掉。
      }
    }
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173
    }
  }
})
