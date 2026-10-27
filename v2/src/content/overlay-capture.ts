/**
 * Content Script · 全局浮层 / 采集域（自 overlay-impl.ts 拆出，V3.9.23 结构优化）
 *
 * 三种采集面板：快速采集资源卡（右上角小窗）/ 快速采集任务 / 采集好奇心（居中）。
 * 与宿主 overlay-impl.ts 共同组成同一份浮层运行时（同域、共享模块状态）。
 */
import { CURATION_WS_ID } from '@/shared/models'
import { POOL_DISPLAY_NAME } from '@/shared/utils/wsName'
import { getSelCache, clearSelCache, getSelectionText, resolveSelection } from './selection'
import {
  uid, safeSend, ensureRoot, focusWhenReady, openOverlay, closeOverlay, showToast,
  showSaved, setActiveTcSave, resetSavedReceipt
} from './overlay-impl'
import { getData, saveData } from './overlay-search'
import { escapeHtml, normalizeUrl } from './overlay-query'

// REQ-031 P-031-8：采集去重 Map——打开小窗时构建一次 url→resource，保存时 O(1) 查重（千卡下不再全量扫描）
let capUrlMap: Map<string, any> | null = null
async function openCapture() {
  resetSavedReceipt()
  // R117（04-61 A）：force=true——分类随时增删改，打开采集浮层必须吃「当前分类」而非旧快照
  const d = await getData(true)
  capUrlMap = new Map()
  for (const r of d?.resources || []) {
    if (r.deletedAt || r.linkType !== 'url' || !r.link) continue
    const fp = normalizeUrl(r.link)
    if (!capUrlMap.has(fp)) capUrlMap.set(fp, r)
  }
  // W4（V3.8.4）：R179 漏网清账——原「存入位置」下拉与「分类」下拉整体退役。
  // 单源纪律随迁：台面选择走 selectableWsOptions 那一段（R4-Dm/R4-Ep 钉过）已无消费者，
  // 分类构建（R117 软删过滤）也随之退役；采集统一入池，标签由「保存后补」承接。
  const selection = getSelectionText()

  openOverlay('corner', closeOverlay)
  const root = ensureRoot()
  const panel = document.createElement('div')
  panel.className = 'zy-panel'
  panel.innerHTML = `
    <div class="zy-cap-head">
      <div class="zy-cap-icon res">📥</div>
      <div class="zy-cap-titles">
        <div class="zy-cap-title">快速采集资源卡</div>
        <div class="zy-cap-sub">把当前页面收进你的来源网络</div>
      </div>
      <button class="zy-cap-close" id="__zy_cap_close__">×</button>
    </div>
    <div class="zy-cap-body">
      <div class="zy-field">
        <label class="zy-field-label">标题</label>
        <input type="text" class="zy-field-input" id="__zy_cap_title__" placeholder="资源卡标题">
      </div>
      <div class="zy-field">
        <label class="zy-field-label">链接类型</label>
        <div class="zy-seg-control" id="__zy_seg__">
          <button class="zy-seg-btn active" data-ltype="url">🔗 URL</button>
          <button class="zy-seg-btn" data-ltype="file">📁 本地文件</button>
          <button class="zy-seg-btn" data-ltype="obsidian">📝 Obsidian</button>
        </div>
        <input type="text" class="zy-field-input" id="__zy_cap_link__" placeholder="https://…">
      </div>
      <div class="zy-field">
        <label class="zy-field-label">描述（选中文本自动填入，可编辑）</label>
        <textarea class="zy-field-input" id="__zy_cap_desc__" placeholder="对该资源的注解、摘录、引用…">${escapeHtml(selection)}</textarea>
      </div>
      <div class="zy-field-row">
        <!-- W4（V3.8.4）：R179 漏网清账——网页浮层采集此前还在「选台面 + 选分类」，
             与应用内采集（统一入池 + 标签保存后可补）不一致。本行改为单行静态提示，
             与 GlobalPopups 采集面板的「存入」行同形态；saveCapture 里 workspaceId 固定池 id、categoryId 置空。 -->
        <div class="zy-field">
          <label class="zy-field-label">存入</label>
          <div class="zy-cap-pool">🗂 ${POOL_DISPLAY_NAME}<span class="zy-cap-pool-sub">· 标签保存后可补</span></div>
        </div>
      </div>
      <!-- R97（D4）：资源采集不设「关联项目」——ResourceCard 模型无 projectId（卡间零挂载红线：
           资源由台面/分类组织，任务才是行动归属）。按提案「或明确边界并说明」分支，把边界写在表单里。 -->
      <div class="zy-cap-boundary">资源卡不挂项目——资源由台面与分类组织，任务才是行动归属</div>
    </div>
    <div class="zy-cap-foot">
      <button class="zy-btn zy-btn-ghost" id="__zy_cap_cancel__">取消</button>
      <button class="zy-btn zy-btn-primary" id="__zy_cap_save__">💾 保存（Enter）</button>
    </div>
  `
  root.appendChild(panel)

  let linkType = 'url'
  const titleInput = document.getElementById('__zy_cap_title__') as HTMLInputElement
  const linkInput = document.getElementById('__zy_cap_link__') as HTMLInputElement

  // 通过 DOM 属性设置值，避免模板字面量注入问题
  titleInput.value = document.title || ''
  linkInput.value = location.href || ''

  // R92（D1）：同上；标题预填了 document.title，聚焦后全选便于直接改写
  focusWhenReady(titleInput, { select: true })

  document.getElementById('__zy_cap_close__')?.addEventListener('click', closeOverlay)
  document.getElementById('__zy_cap_cancel__')?.addEventListener('click', closeOverlay)

  document.querySelectorAll('#__zy_seg__ .zy-seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#__zy_seg__ .zy-seg-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      linkType = (btn as HTMLElement).dataset.ltype || 'url'
      linkInput.placeholder = linkType === 'url' ? 'https://…' : linkType === 'file' ? 'D:\\folder\\file.pdf' : 'obsidian://open?vault=…'
    })
  })

  const onCapEnter = (e: KeyboardEvent) => {
    if (!document.getElementById('__zy_cap_title__')) return
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
      const target = e.target as HTMLElement
      if (target.tagName === 'TEXTAREA') return // 描述框内 Enter 换行
      e.preventDefault()
      e.stopPropagation()
      saveCapture()
    }
  }
  panel.addEventListener('keydown', onCapEnter)
  document.getElementById('__zy_cap_save__')?.addEventListener('click', () => { void saveCapture() })

  async function saveCapture(forceNew = false) {
    const title = titleInput.value.trim()
    if (!title) { showToast('请输入标题'); return }
    const d2 = await getData()
    if (!d2) { showToast('数据加载失败'); return }
    // B5 去重：相同归一化链接 → 确认视图（定位原卡 / 仍然新建一张，R105-D3）；forceNew 跳过查重
    if (!forceNew && linkType === 'url' && linkInput.value.trim()) {
      const fp = normalizeUrl(linkInput.value.trim())
      const dup = capUrlMap?.get(fp)
      if (dup) {
        // B28：面板内自定义确认（替代原生 confirm）
        showDupConfirm(String(dup.title).slice(0, 40), () => {
          safeSend({ type: 'zy-locate-workspace', wsId: dup.workspaceId, hl: dup.id })
          closeOverlay()
          showToast('↗ 已定位到已收录的卡片')
        }, () => { void saveCapture(true) })
        return
      }
    }
    const descInput = document.getElementById('__zy_cap_desc__') as HTMLTextAreaElement
    const resource = {
      id: uid('rc'), kind: 'resource', title,
      linkType, link: linkInput.value.trim(),
      // W4（V3.8.4）：统一入池——与应用内采集同一口径，workspaceId 固定池 id、categoryId 置空（R179 定案）
      workspaceId: CURATION_WS_ID,
      categoryId: '',
      description: (descInput?.value || '').trim(),
      tags: [], customFields: {}, pinned: false, callCount: 0,
      createdAt: Date.now(), updatedAt: Date.now()
    }
    d2.resources?.unshift(resource)
    // REQ-031 P-031-8：新增卡片增量写入去重 Map（保持 O(1) 查重）
    if (capUrlMap && resource.linkType === 'url' && resource.link) {
      const nfp = normalizeUrl(resource.link)
      if (!capUrlMap.has(nfp)) capUrlMap.set(nfp, resource)
    }
    await saveData(d2)
    // W4（V3.8.4）：统一入池后没有「未归档」一说——分类下拉已退役，回执只报入池。
    // R92（E1）原「未归档轻引导」随之退役：它的动线断点（采集后不归位）已由标签体系承接（保存后补）。
    // R78（A3）：回执 toast 化——不再整屏确认；回执期内 Enter 仍可打开看板并定位到这张卡
    showSaved(`✓ 已入 ${POOL_DISPLAY_NAME} · Enter 打开看板`, () => {
      // 通知 background：单例定位到已打开的策展台标签页，或新建
      chrome.runtime.sendMessage({ type: 'zy-locate-workspace', wsId: resource.workspaceId, hl: resource.id })
    })
  }
}
/** 采集去重确认视图（B28：替代原生 confirm，复用已保存态的视觉结构） */
function showDupConfirm(dupTitle: string, onJump: () => void, onForceNew: () => void) {
  const root = ensureRoot()
  const panel = root.querySelector('.zy-panel') as HTMLElement | null
  if (!panel) return
  panel.innerHTML = `
    <div class="zy-saved">
      <div class="zy-saved-icon warn">⚠️</div>
      <div class="zy-saved-title">该页面已收录</div>
      <div class="zy-saved-sub">「${escapeHtml(dupTitle)}」已经收过了（在「${POOL_DISPLAY_NAME}」里）——可定位到原卡，或仍然新建一张（例如要存不同上下文的两份笔记）</div>
      <div class="zy-saved-actions">
        <button class="zy-btn zy-btn-ghost" id="__zy_dup_cancel__">取消</button>
        <button class="zy-btn zy-btn-ghost" id="__zy_dup_force__">仍然新建一张</button>
        <button class="zy-btn zy-btn-primary" id="__zy_dup_jump__">定位到卡片</button>
      </div>
    </div>
  `
  document.getElementById('__zy_dup_cancel__')?.addEventListener('click', closeOverlay)
  document.getElementById('__zy_dup_force__')?.addEventListener('click', onForceNew)
  document.getElementById('__zy_dup_jump__')?.addEventListener('click', onJump)
}
// ============ 采集好奇心（居中，选中文本预填 + O24 自动附带页面来源） ============
/** R55-C：快速采集任务（任意网页快捷键触发；四字段全非必填，直存全域任务）
 *  R66-F1：对齐好奇心速记——选中文本→任务内容、网页标题→任务名称、页面URL→链接（均可编辑） */
async function openTaskCapture() {
  // R66-F1：实时选区优先 → 预取缓存兜底（与 openCuriosity 同一链路）
  const cached = getSelCache()
  const selection = resolveSelection()
  const hasSel = !!selection
  const pageTitle = hasSel ? ((cached.url === location.href && cached.title) || (document.title || '').trim()) : ''
  const pageUrl = hasSel ? ((cached.url === location.href && cached.url) || location.href) : ''
  clearSelCache()
  const d = await getData()
  const projects: any[] = []
  for (const dir of d?.compass?.directions || []) for (const p of dir.projects || []) projects.push({ id: p.id, name: p.name, metrics: p.metrics || [] })
  // R67-F2：任务采集弹窗改页面正中弹出（与好奇心速记一致；原先 corner 在插件图标附近）
  openOverlay('center', closeOverlay)
  const root = ensureRoot()
  const panel = document.createElement('div')
  panel.className = 'zy-panel'
  panel.innerHTML = `
    <div class="zy-cap-head">
      <div class="zy-cap-icon res">⚡</div>
      <div class="zy-cap-titles">
        <div class="zy-cap-title">快速采集任务</div>
        <div class="zy-cap-sub">四项皆可留空 · 存入全域任务统一管理</div>
      </div>
      <button class="zy-cap-close" id="__zy_tc_close__">×</button>
    </div>
    <div class="zy-cap-body">
      <div class="zy-field"><label class="zy-field-label">任务名称${hasSel ? '（已填入网页标题，可编辑）' : ''}</label>
        <input type="text" class="zy-field-input" id="__zy_tc_title__" placeholder="要做什么（可留空）" value="${escapeHtml(hasSel ? pageTitle : '')}"></div>
      <div class="zy-field"><label class="zy-field-label">任务内容${hasSel ? '（已填入选中文本，可编辑）' : ''}</label>
        <textarea class="zy-field-input" id="__zy_tc_desc__" placeholder="补充说明、上下文、验收标准（可留空）">${escapeHtml(selection)}</textarea></div>
      <div class="zy-field"><label class="zy-field-label">🔗 链接${hasSel ? '（已自动捕获当前页，可编辑）' : '（可选，留空即无链接）'}</label>
        <input type="text" class="zy-field-input" id="__zy_tc_link__" placeholder="https://…" value="${escapeHtml(hasSel ? pageUrl : '')}"></div>
      <div class="zy-field-row">
        <div class="zy-field"><label class="zy-field-label">所属项目（可留空）</label>
          <select class="zy-field-select" id="__zy_tc_proj__"><option value="">未关联项目</option>
          ${projects.map((p: any) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join('')}</select></div>
        <div class="zy-field"><label class="zy-field-label">所属指标（可留空）</label>
          <select class="zy-field-select" id="__zy_tc_met__" disabled><option value="">暂不归属</option></select></div>
      </div>
    </div>
    <div class="zy-cap-foot">
      <button class="zy-btn zy-btn-ghost" id="__zy_tc_cancel__">取消</button>
      <button class="zy-btn zy-btn-primary" id="__zy_tc_save__">⚡ 保存任务（Ctrl+Enter）</button>
    </div>
  `
  root.appendChild(panel)
  const titleInput = document.getElementById('__zy_tc_title__') as HTMLInputElement
  const descInput = document.getElementById('__zy_tc_desc__') as HTMLTextAreaElement
  const linkInput = document.getElementById('__zy_tc_link__') as HTMLInputElement
  const projSel = document.getElementById('__zy_tc_proj__') as HTMLSelectElement
  const metSel = document.getElementById('__zy_tc_met__') as HTMLSelectElement
  // R92（D1）：同上；有选区时焦点落在描述（内容已预填），否则落在标题
  focusWhenReady(hasSel ? descInput : titleInput)
  projSel.addEventListener('change', () => {
    const prj = projects.find(x => x.id === projSel.value)
    metSel.disabled = !prj
    metSel.innerHTML = '<option value="">暂不归属</option>' + (prj ? prj.metrics.map((m: any) => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.title)}</option>`).join('') : '')
  })
  document.getElementById('__zy_tc_close__')?.addEventListener('click', closeOverlay)
  document.getElementById('__zy_tc_cancel__')?.addEventListener('click', closeOverlay)
  const saveTc = async () => {
    const d2 = await getData()
    if (!d2) { showToast('数据加载失败'); return }
    const desc = descInput?.value.trim() || ''
    const link = linkInput?.value.trim() || ''
    const task: any = {
      id: uid('tk'), kind: 'task', title: titleInput.value.trim() || '快速任务',
      description: desc, link: link || undefined, status: 'todo', priority: 'medium',
      projectId: projSel.value || undefined, metricId: metSel.value || undefined,
      customFields: {}, tags: [], pinned: false,
      createdAt: Date.now(), updatedAt: Date.now()
    }
    d2.tasks?.unshift(task)
    if (task.metricId) {
      for (const dir of d2.compass?.directions || []) for (const prj of dir.projects || []) for (const m of prj.metrics || [])
        if (m.id === task.metricId && !m.taskIds.includes(task.id)) m.taskIds.push(task.id)
    }
    await saveData(d2)
    // R78（A3）：回执 toast 化——原整屏确认块与「5 秒后自动关闭」一并移除。
    // 回执期内 Enter 打开落点：挂了项目/指标 → 项目详情；否则 → 调度台高亮这张任务卡。
    const tcRoute = task.projectId ? '/compass/projects?p=' + task.projectId : '/?hl=' + task.id
    // R92（E1）：任务卡的"归位" = 挂到项目（指标依附于项目，项目为空时指标必然为空，只判项目即可）。
    // R92（T4）★ 顺带修既有缺陷：无项目时路由是 `/`（**调度台**），回执却写「打开**方向台**」——
    // 与 R91 清偿的「任务中心顶部」是同一类坏账：**文案指向的页面与实际落点不一致**。
    const filed = !!task.projectId
    showSaved('✓ 任务已保存 · ' + (filed ? 'Enter 打开项目' : '未归档 · Enter 去归位'), () => {
      chrome.runtime.sendMessage({ type: 'zy-open-route', route: tcRoute })
    })
  }
  document.getElementById('__zy_tc_save__')?.addEventListener('click', saveTc)
  // R70：注册到模块级单例（见 onTcKeydown）——不再在此处新建 keydown 闭包
  setActiveTcSave(saveTc)
}

async function openCuriosity() {
  // 第廿四轮：实时选区优先 → 预取缓存兜底（缓存是选中当下捕获的，不受后续清选影响）
  // V2.21：先取缓存快照再清空——原实现只清 text、保留 url/title，此处语义保持一致
  const cached = getSelCache()
  const selection = resolveSelection()
  const hasSel = !!selection
  const pageTitle = hasSel ? ((cached.url === location.href && cached.title) || (document.title || '').trim()) : ''
  const pageUrl = hasSel ? ((cached.url === location.href && cached.url) || location.href) : ''
  clearSelCache()
  // D6：好奇心采集居中呈现，宽度与全局搜索一致
  openOverlay('center', closeOverlay)
  const root = ensureRoot()
  const panel = document.createElement('div')
  panel.className = 'zy-panel curio'
  panel.innerHTML = `
    <div class="zy-cap-head">
      <div class="zy-cap-icon curio">💡</div>
      <div class="zy-cap-titles">
        <div class="zy-cap-title">采集好奇心</div>
        <div class="zy-cap-sub">从好奇出发，向源头求证</div>
      </div>
      <button class="zy-cap-close" id="__zy_cur_close__">×</button>
    </div>
    <div class="zy-cap-body">
      <div class="zy-field">
        <label class="zy-field-label">你的问题或想法${selection ? '（已填入选中文本，可编辑）' : ''}</label>
        <textarea class="zy-field-input" id="__zy_cur_text__" style="min-height:110px" placeholder="看到什么、想到什么、想探索什么？&#10;按 Enter 换行，Ctrl+Enter 保存">${escapeHtml(selection)}</textarea>
      </div>
      <div class="zy-field">
        <label class="zy-field-label">🔗 来源链接${hasSel ? '（已自动捕获当前页，可编辑）' : '（可选，留空即无来源）'}</label>
        <input type="text" class="zy-field-input" id="__zy_cur_url__" placeholder="https://…" value="${escapeHtml(hasSel ? pageUrl : '')}">
      </div>
      <div class="zy-field">
        <label class="zy-field-label">📝 来源标题</label>
        <input type="text" class="zy-field-input" id="__zy_cur_srctitle__" placeholder="来源页面标题（可选）" value="${escapeHtml(hasSel ? pageTitle : '')}">
      </div>
    </div>
    <div class="zy-cap-foot">
      <button class="zy-btn zy-btn-ghost" id="__zy_cur_cancel__">取消</button>
      <button class="zy-btn zy-btn-primary" id="__zy_cur_save__">💾 保存（Ctrl+Enter）</button>
    </div>
  `
  root.appendChild(panel)
  const textarea = document.getElementById('__zy_cur_text__') as HTMLTextAreaElement
  // R92（D1）：同上。⚠ toEnd 条件**必须保留** —— 有选区时文本已预填，光标应停在开头供检查，不能无脑推到末尾
  focusWhenReady(textarea, { toEnd: !selection })

  document.getElementById('__zy_cur_close__')?.addEventListener('click', closeOverlay)
  document.getElementById('__zy_cur_cancel__')?.addEventListener('click', closeOverlay)

  textarea.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      saveCuriosity()
    }
  })

  async function saveCuriosity() {
    const text = textarea.value.trim()
    if (!text) { showToast('请输入内容'); return }
    const d = await getData()
    if (!d) { showToast('数据加载失败'); return }
    const srcUrlInput = (document.getElementById('__zy_cur_url__') as HTMLInputElement | null)?.value.trim() || ''
    const srcTitleInput = (document.getElementById('__zy_cur_srctitle__') as HTMLInputElement | null)?.value.trim() || ''
    d.curiosities?.unshift({
      id: uid('cz'), kind: 'curiosity', question: text,
      sourceUrl: srcUrlInput || undefined, sourceTitle: srcTitleInput || undefined,
      status: 'todo', pinned: false,
      customFields: {},
      createdAt: Date.now(), updatedAt: Date.now()
    })
    await saveData(d)
    closeOverlay()
    showToast('好奇心+1')
  }

  document.getElementById('__zy_cur_save__')?.addEventListener('click', saveCuriosity)
}

export { openCapture, openCuriosity, openTaskCapture }
