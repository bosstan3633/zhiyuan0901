/**
 * 产品使用手册数据（第二十轮重写；R49 V2.22.0 三大系统页改版全量同步；R66 V2.36.0 品牌内涵重构对齐）
 * 五篇结构：速览 / 基础 / 方法 / 理念 / 附录
 * html 字段由 GlobalSettings 手册面板以 v-html 渲染。
 * 品牌口径（R66 对齐 00 母版 R2）：主 Slogan「万千可调用，自有我方向」；品类=「你在浏览器里的个人调度中台」；
 *                名称内涵：知源=知道为何出发+知道信息从何来；调度=让合适的信息、工具与材料参与行动；
 *                核心价值=三个看见（看见方向/留下好奇/策展成果）+ 调用贯穿 + 信任支撑。
 * 命名口径（R63 更新）：调度台 / 方向台 / 资源台（唯一 kind='resource'，真身源头）/ 策展台（N 个）；
 *                主航线 / 完整方向树；方向状态（指标条）；好奇心培育 / 任务调度；项目详情 / 项目总览。
 * 结构口径（R61-R66）：资源台 = 资源卡真身唯一居所；策展台 = 台内卡 + 资源台镜像 + 金字塔视图 + 5 指标卡；
 *                主题卡（中心论点）= 策展台金字塔 L1 根；Airtable 单向同步（设置 → ⇄ Airtable 同步）。
 */
export interface ManualSection { id: string; title: string; html: string }
export interface ManualPart { title: string; sections: ManualSection[] }

export const MANUAL: ManualPart[] = [
  {
    title: '速览 · 一页上手',
    sections: [
      { id: 'quick-1', title: '它是什么 · 给谁用 · 解决什么', html: `
        <p>知源调度台是一套 <strong>浏览器扩展</strong>（Chrome / Edge / Brave 等 MV3），<strong>接管你的新标签页</strong>——它是<strong>你在浏览器里的个人调度中台</strong>：围绕自己的方向，组织探索、调用与成果的工作空间。</p>
        <h4>名称的内涵</h4>
        <div class="mc-quote"><strong>知源</strong>，是知道自己为何出发，也知道所用信息从何而来；<strong>调度</strong>，是围绕自己的问题，让合适的信息、工具与材料参与行动。<br>—— 万千可调用，自有我方向。</div>
        <p>知源不以「拥有更多信息」为目的。信息与工具不断涌现，外部的丰富并不会自动变成自己的进展——真正的瓶颈是：<strong>外部可能性持续增加，个人却难以把方向、探索和行动组织在一起</strong>。看到新工具就想试，却不知与自己何干；好奇冒出来，没有承接；任务做了不少，看不见和长期方向的关系；有了材料和产出，却组织不成能表达判断的成果。知源回应的正是这段断裂：向内，看见自己的方向、问题与好奇；向外，连接值得参考的信息源与可以借助的工具；在行动中把外部资源组织为解决问题的助力，再把阶段成果策展成自己的表达。</p>
        <h4>三项核心价值</h4>
        <table class="mc-table">
          <tr><th>价值</th><th>你看见什么</th></tr>
          <tr><td><b>看见方向</b></td><td>今天的行动有来处——行动与目标、项目之间的关系一目了然</td></tr>
          <tr><td><b>留下好奇</b></td><td>探索从自己的问题出发——冒出来的疑问先留下，回看时再选择投入</td></tr>
          <tr><td><b>策展成果</b></td><td>做过的事形成自己的表达——围绕主题取舍、分层，讲给任何人听</td></tr>
        </table>
        <p><strong>调用</strong>贯穿三者：根据当前问题，组织信息源、工具、方法与材料，让它们参与任务。信任托底：数据 100% 本机、无账号无云端、可导出迁移、删除可恢复。</p>
        <h4>它给谁用（按工作方式识别）</h4>
        <p>主要在浏览器中接触信息与开展工作；需要独立决定研究什么、投入什么、如何交付；同时使用多个信息来源和工具；希望把探索与行动连接，并形成自己的成果表达。——独立顾问、研究型创作者、独立研究者与多项目知识工作者会最先用顺手。</p>
        <p><strong>不面向：</strong>想找「存一堆链接就不看」工具的人；已有完整 Notion/Obsidian 工作流且满意的人；强依赖多人协作、自动云同步或自动化执行的人。</p>
        <h4>它坚持不做什么</h4>
        <p>❌ <b>不做云同步</b>——数据在你自己的电脑里；<br>❌ <b>不做 AI 替你决策</b>——AI 是被你调度的工具，判断永远在你；<br>❌ <b>不做「第二大脑」</b>——不抢写作与知识库市场，与 Obsidian/Notion 互补；<br>❌ <b>不做社交/协作</b>——个人工作中心；<br>❌ <b>不做使用追踪与画像</b>——没有广告位，没有 KPI 压迫。</p>
      ` },
      { id: 'quick-2', title: '三大系统页与六个核心动作', html: `
        <h4>系统页 · 一条动线</h4>
        <div class="mc-flow">🎛 调度台（今天从哪里出发）→ 🧭 方向台（主航线与项目）→ 📦 资源台（资源真身唯一居所）→ 🗂 策展台（N 个，台内卡 + 镜像 + 金字塔）</div>
        <h4>六个核心动作 · 时间即价值</h4>
        <table class="mc-table">
          <tr><th>#</th><th>动作</th><th>触发</th><th>时间</th></tr>
          <tr><td>1</td><td>快速采集</td><td><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>J</kbd> 任意网页</td><td>5 秒</td></tr>
          <tr><td>2</td><td>三秒搜索</td><td><kbd>Ctrl</kbd>+<kbd>K</kbd> 全场景（任意网页浮层 / newtab 内）</td><td>3 秒</td></tr>
          <tr><td>3</td><td>追想法念头</td><td><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>I</kbd></td><td>10 秒</td></tr>
          <tr><td>4</td><td>一键直跳</td><td>双击搜索结果（单击开详情 / 双击跳转链接）</td><td>0 思考</td></tr>
          <tr><td>5</td><td>方向管理</td><td>方向台（愿景 / 使命 / 战略目标 / 项目 / 指标 / 任务）</td><td>锚定主攻</td></tr>
          <tr><td>6</td><td>完整导出</td><td>设置 → 导出全部数据</td><td>一份 JSON</td></tr>
        </table>
        <div class="mc-flow">🔍 <kbd>Ctrl</kbd>+<kbd>K</kbd> ｜ 📥 <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>J</kbd> ｜ 💡 <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>I</kbd> ｜ ⚙ 在 <code>chrome://extensions/shortcuts</code> 绑定「打开设置/方向台/资源台/完整方向树/任务调度/同步到 Airtable」</div>
        <div class="mc-tip">💡 键盘党第一步：打开 <code>chrome://extensions/shortcuts</code> 把三键改成你的肌肉记忆。「打开设置」「打开方向台」「打开资源台」「打开完整方向树」四个命令无默认键——按需分配；「快速采集任务」「同步到 Airtable」同样无默认键，分配后任意网页一键记任务 / 一键同步。检索结果行 hover 出 🗑 可<strong>直接删除</strong>（应用内与网页浮层皆可，无二次确认，进回收站可恢复）——R55。</div>
        <h4>每天的节奏 · 4 步闭环</h4>
        <div class="mc-steps">
          <div class="mc-step"><b>1</b><span>刷新 → 调度台：方向状态一栏看今日记录，今日三件事（最多 3 件），30 秒方向确认</span></div>
          <div class="mc-step"><b>2</b><span>切方向台 → 看指标条与主航线，确认没把战争打在防守的战场</span></div>
          <div class="mc-step"><b>3</b><span>干活中随手三键采集，搜索 / 双击直达</span></div>
          <div class="mc-step"><b>4</b><span>睡前看一眼方向状态指标条——它是镜子，不是考核</span></div>
        </div>
      ` },
      { id: 'quick-3', title: '它与同类相比 · 独特价值', html: `
        <p>知源不是"又一个收藏夹"。它与两类工具同场竞技——<strong>直接竞品</strong>（同样经营个人知识/资源）与<strong>间接竞品</strong>（AI 时代浏览器自带的默认选项）——但它的货架位置不同。</p>
        <h4>直接竞品：同赛道，不同货架</h4>
        <table class="mc-table">
          <tr><th>竞品</th><th>它是什么</th><th>知源的不同</th></tr>
          <tr><td>Notion</td><td>一体化工作空间（笔记/数据库/协作）</td><td>知源不做笔记与数据库，只做调度台。Notion 用户最常见的困境是"库越建越重、找回越来越慢"——知源把"三秒进出"做到极致，把深度写作交还给它。</td></tr>
          <tr><td>Obsidian</td><td>本地双链笔记</td><td>知源与 Obsidian 互补而非竞争：知源收录并直达 <code>obsidian://</code> 链接，深度写作仍留在 Obsidian。</td></tr>
          <tr><td>Flomo</td><td>碎片化记录</td><td>好奇心与 Flomo 同源，但好奇心只是六层链的一环——知源把它接进方向、项目与指标条，不止是"存起来"。</td></tr>
          <tr><td>Raindrop.io / Eagle</td><td>书签管理 / 素材管理</td><td>它们收藏"链接"本身；知源调度"资源 + 任务 + 好奇心 + 方向"四类对象，且数据 100% 本机。</td></tr>
          <tr><td>Raycast / LaunchBar</td><td>启动器（命令/检索）</td><td>同频"三秒召回"，但它们是系统级命令面板，知源是个人认知资源的总调度——有方向、有策展、有主航线。</td></tr>
        </table>
        <h4>间接竞品：AI 时代的默认选项</h4>
        <table class="mc-table">
          <tr><th>默认选项</th><th>为什么不够</th><th>知源的解法</th></tr>
          <tr><td>浏览器书签</td><td>只存不找；层级深了等于没有</td><td>拼音首字母三秒召回；标签/分类双树；双击直达</td></tr>
          <tr><td>AI 对话框收藏</td><td>内容锁在对话里，与你的资源库隔离</td><td>Ctrl+K 全场景穿透，AI 产出与人工收集同库调度</td></tr>
          <tr><td>"稍后读"应用</td><td>读完就没有下游了</td><td>好奇 → 求证 → 项目 → 指标 → 任务，五步各有去处</td></tr>
        </table>
        <h4>一句话总结</h4>
        <div class="mc-quote">通用工具比知源"更能装"，知源比通用工具"更能调"。知源不抢你的写作、不抢你的协作、不抢你的云——它只做一件事：<strong>让你见过的每一个信息，都具备在正确时刻被召回的能力</strong>。</div>
      ` }
    ]
  },
  {
    title: '基础篇 · 上手',
    sections: [
      { id: 'basic-1', title: '界面全景（四大系统区）', html: `
        <p>整个产品是一条<strong>「调度 → 方向 → 资源 → 策展」</strong>的动线，全部住在浏览器新标签页里。顶部导航：<strong>调度台（默认）/ 方向台 / 资源台 / 策展台列表</strong>。</p>
        <div class="mc-flow">🎛 调度台（今日记录 + 三件事 + 好奇心培育）→ 🧭 方向台（指标条 / 主航线 / 项目总览）→ 📦 资源台（资源真身）→ 🗂 策展台（N 个，镜像 + 金字塔）</div>
        <h4>调度台：今天，从哪里出发</h4>
        <ul>
          <li><b>方向状态（最顶部，R66 整合）</b>：战略目标 / WCE 好奇探索 / WRR 资源复用 / 未归档任务四格单行指标条，日/周/累计三档，全部可下钻；<b>右端即今日记录四格</b>（入台/移出/调出/写入，R66 自页头迁入右对齐），单击打开明细抽屉；右上角只留「数据存储」与「同步状态」两个 chip。</li>
          <li><b>今日三件事</b>：硬上限 3 件（方法论见方法篇），三槽<strong>横向并列</strong>为一个模块；单击任务卡联动下方项目调度，双击开详情。</li>
          <li><b>项目调度（两列，R66 瘦身）</b>：呈现选中任务隶属的项目——左列<strong>项目名大字</strong> + 战略目标行（目标名+进度+进入详情）+ 四大数值 2×2（愿景/使命不再在此呈现，数据保留在方向台）；右列成功指标 → 任务树（默认全展开、可折叠），支持新建/关联/<strong>去关联</strong>，单击任务右侧滑出详情。</li>
          <li><b>今日记录条</b>：入台/移出/调出/写入记录四格，主计数 = 分类型副行之和；写入记录 = 当日三卡事件（新增/删除/恢复/清理）+ 三卡调出，系统事件灰显可见不计数。</li>
          <li><b>底部专区</b>：好奇心培育（R55 起单区直呈；任务调度已迁方向台项目总览之下，全域统一管理）。</li>
        </ul>
        <h4>方向台：主航线与项目全景</h4>
        <ul>
          <li><b>指标条（方向状态）</b>：战略目标 / WCE 好奇探索 / WRR 资源复用 / 未归档任务四格，日/周/累计三档并入指标条表头，四格全部可点击下钻；「📋 详细指标」下钻完整六指标（新增/删除卡等）。</li>
          <li><b>主航线（R52 全量呈现）</b>：愿景 → 使命 → 战略目标行<strong>内嵌该项目下全部项目 chip</strong>（🎯 主攻在前；超过 6 个折「更多 N」行内展开）；点击 chip 进项目详情。</li>
          <li><b>项目总览</b>：满宽三列卡；点击任意项目卡进项目策展详情；📌 置顶分组、拖拽排序、新建/改名/删除（摘除式）全套管理。</li>
          <li><b>任务调度（R55 迁入）</b>：项目总览之下全域任务管理模块——卡片/列表/看板三视图、分组、批量、筛选全量保留，默认展开。</li><li><b>完整方向树</b>（右上角/项目调度右上角/快捷键进入）：六层全深度 + 顶部统计 + 一键展开/收起 + 已完成项目显隐。</li>
          <li><b>二级导航（R54）</b>：完整方向树与项目详情页头有面包屑（「方向台 / 页名」，方向台段可点回总览），返回按钮<strong>感知来源</strong>——从项目详情进树，返回键即「← 返回项目详情」；<kbd>Esc</kbd> 在二级页 = 返回上级（抽屉打开时先关抽屉）。方向树项目节点 📄 可直达项目详情页；项目详情的归属链/🌳 按钮跳树并<strong>定位闪烁</strong>到对应战略目标。</li><li><b>项目目录树（R55）</b>：项目详情左栏双列——第一列全部项目（单击切换），第二列当前项目目录（项目名→指标→任务）：拖任务到其他指标=变更归属、拖指标=排序（实时同步调度台项目调度）；单击节点右侧定位高亮；归属链横向一行。</li>
        </ul>
        <h4>资源台：资源卡真身的唯一居所（R64 归一）</h4>
        <ul>
          <li><b>真身唯一</b>：所有资源卡真身只住在资源台——分类树（最多 4 级）组织它们；其他地方看到的资源卡都是这里的镜像。<b>旧版工作台数据已全部并入资源台</b>（每台分类树挂在根下同名根分类内），<b>采集默认落资源台</b>。</li>
          <li><b>📤 单卡镜像 / 📡 分类镜像</b>：右键或卡面 📡 把单卡镜像到指定策展台；目录树 📤 把整个分类（含直属子分类与卡）镜像过去——镜像分类物化为策展台内带 📡 溯源标识的真实分类，源台零影响。</li>
          <li><b>布局对齐旧工作台（R65）</b>：顶部工具条——▦ 卡片 / ☰ 列表 / ▤ 看板三视图切换、🔍 台内搜索、<b>☑ 批量管理</b>（浮动栏：全选/批量打开链接/移动到/批量删除）、<b>⬇ 导入</b>（书签 HTML 按文件夹生成分类 + 本地文件）、＋ 新建卡片；<b>单击卡片右侧抽屉详情</b>（编辑表单），<b>双击打开链接</b>。</li>
        </ul>
        <h4>策展台：为一次策展而生的专题空间（N 个）</h4>
        <ul>
          <li><b>两种卡来源</b>：台内原生卡（新建，<strong>不写入资源台</strong>，删除直接进回收站）+ 资源台镜像卡（虚线边框 + 📡，写操作回落真身）。</li>
          <li><b>导入 / 导出（R65 语义修正）</b>：工具条「⬇ 导入」只收<b>策展台数据包 JSON</b>（⚙「📦 导出工作台数据」的同格式导出物：论点分类树 + 台内卡 + 镜像投射，按 ID 并集合并）；<b>书签文件/本地文件导入只在资源台</b>，策展台不再提供。</li>
          <li><b>5 指标条（R64 压缩为紧凑单行）</b>：🏛 策展主题 / 🔢 卡片总数 / 🔀 来源构成 / 📎 附件数量 / 🕐 最近更新，全部可点击下钻明细（附件可直接打开，镜像可跳真身）。</li>
          <li><b>卡片视图（R64 树状分组）</b>：默认按左侧分类树<b>递归嵌套分组</b>——子分类卡不再混入父组平铺，逐级缩进呈现层级；每张卡片卡面显示<b>完整分类路径徽标</b>（如 123 / 123-2），归属一眼可辨。</li>
          <li><b>中心论点（主题卡）</b>：每台一张——金字塔页点「🏛 点击设立中心论点」<b>弹窗填写即立</b>（保存后自动落为 L1 根）；卡片右键「设为中心论点」为辅助入口。</li>
          <li><b>两种视图</b>：分组分类树（默认，最多 4 级层级色点）+ ⬡ 金字塔视图（中心论点根 → 分类树居中呈现，<b>层级间直角折线相连</b>）；卡片拖入节点；节点可拖挂子级、⟨⟩ 调同级顺序，层级/成环自动校验）；节点 ⋯ 菜单 6 项：新建子论点 / 同级节点 / 从资源台镜像分类 / 打包所选卡片入此节点 / 重命名 / 删除节点（卡片回待分类）。。<b>R66 居中树布局</b>：节点宽度自适应、整体居中不占满横向空间；<b>父节点横向恒等于其子组横向并居中悬于其上</b>，子组永不跨入其他父节点的横向空间——从属关系与紧凑归属一眼可辨；节点卡带 L2/L3 层级徽标。每个节点模块底部两个入口——<b>🔗 关联资源卡</b>（弹资源台全量卡选择器，关键词过滤、多选、镜像到该节点）与 <b>➕ 新建卡片</b>（台内卡，可挂附件，不写资源台）；节点内卡片可<b>跨节点拖拽</b>改归属；节点（组）可拖拽<b>排序与改层级</b>（落点高亮：挂子级/同级插入/拖回根层，防循环+4 级上限自动校验）</li>
          <li><b>右键菜单（R62 起真正可用）</b>：打开链接 / 复制链接 / 移动分类 / 置顶 / 🏛 设为中心论点 / 删除；镜像卡菜单自动拦截写操作。</li>
        </ul>
        <div class="mc-tip">💡 无论停在哪一页，刷新固定回调度台——「今天从哪里出发」优先，是知源的第一设计。冷启动时你会看到品牌动画（300–600ms），按 Esc 或单击可跳过。</div>
      ` },
      { id: 'basic-2', title: '三键采集与全局搜索', html: `
        <div class="mc-steps">
          <div class="mc-step"><b>1</b><span>在任意网页按 <kbd>Ctrl+Shift+J</kbd>，弹窗自动预填标题与链接；先选中文字，会自动填入描述</span></div>
          <div class="mc-step"><b>2</b><span><kbd>Enter</kbd> 保存 → 弹窗变「✓ 已保存」→ 再按 <kbd>Enter</kbd> 直接打开看板并高亮新卡</span></div>
          <div class="mc-step"><b>3</b><span>同一链接重复采集？知源只定位不重复收录</span></div>
        </div>
        <h4>📥 资源采集 · Ctrl+Shift+J</h4>
        <ul>
          <li>链接类型三选：网页 URL / 本地文件 / <code>obsidian://</code>；本地文件双击即开（需开启「允许访问文件网址」）。</li>
          <li>悬停出现 📂 移动分类、📌 置顶；也可以右键卡片呼出完整菜单。</li>
        </ul>
        <h4>💡 好奇心采集 · Ctrl+Shift+I</h4>
        <ul>
          <li><b>选中文字后按键</b>：文字自动填入，并<strong>自动附带当前网页的标题与链接</strong>，方便日后回溯来源。</li>
          <li><b>不选文字直接按键</b>：只记录想法，链接留空——知源不预设任何默认值。</li>
          <li><kbd>Ctrl</kbd>+<kbd>Enter</kbd> 保存，反馈「💗好奇心+1」；零摩擦红线：没有分类、优先级、截止日期。</li>
        </ul>
        <h4>🔍 全局搜索 · Ctrl+K</h4>
        <ul>
          <li>穿透三卡、全部工作台与项目；空查询时显示<strong>快捷操作 + 最近打开</strong>。</li>
          <li>结果按 📄 资源 / ✅ 任务 / 💡 好奇 / 🗂 工作台 / 📦 项目 <b>分组</b>呈现，关键词<b>高亮</b>；支持<b>拼音与首字母</b>（输入 sj 能命中「设计」）。</li>
          <li><kbd>Tab</kbd> 循环过滤类型，或输入「任务」「资源」「好奇」「工作台」「项目」+ Tab 直达。</li>
          <li><strong>工作台类型 = 分类树</strong>：展示每个工作台下的分类与卡片数；单击分类即定位——分类下有卡则高亮第一张，无卡则高亮分类行本身。</li>
          <li><strong>项目类型</strong>：列出全部项目（🎯 主攻/已完成标记），单击直达项目详情。</li>
          <li>选中结果按 <kbd>Ctrl</kbd>+<kbd>C</kbd> 复制 Markdown 引用（标题+链接）。</li>
        </ul>
        <div class="mc-warn">⚠ chrome:// 等不可注入页面会自动改用独立小窗，体验一致。</div>
      ` },
      { id: 'basic-3', title: '策展台与资源台操作', html: `
        <h4>单击看详情 · 双击开链接（三卡一致）</h4>
        <div class="mc-flow">单击卡片 → 详情抽屉 ｜ 双击卡片 → 打开链接（网页 / 本地文件 / Obsidian）</div>
        <h4>分类：最多 4 级的树（R61 下放）</h4>
        <ul>
          <li>「＋ 新建分类」弹窗输入即建；hover 出 <b>📌 置顶 / ✎ 重命名 / 🗑 删除</b>，也可右键呼出菜单；左树层级色点一眼看清深度。</li>
          <li>拖拽三语义：上下沿=同级排序（有插入线）；拖到节点中间=成为子分类（层级/成环自动校验，上限 4 级）；拖到底部「⬆ 升为一级」区=恢复顶级。</li>
          <li>点父分类聚合显示全部子孙资源；卡片左下角 📂 分类标签可点击跳转。</li>
          <li><strong>展开 / 折叠</strong>：点 ▸ 箭头或文件夹图标逐节点收展；顶部工具条「⊟ 收起」一键收起到根部、「⊞ 展开」全局展开（默认全展开，选中被收起的子分类会自动展开父级）。</li>
        </ul>
        <h4>置顶与批量</h4>
        <ul>
          <li>📌 在卡片右上角（资源/好奇/任务三卡一致）；置顶项物理移到列表顶部，拖拽顺序始终以你手动排列为准。</li>
          <li>批量管理：批量打开（>15 确认）/ 批量删除（可撤销）/ 批量移动到任意工作台与分类。</li>
          <li>误删不慌：删除后的 toast 里有<b>「撤销」</b>按钮，5 秒内一键恢复。</li>
        </ul>
        <div class="mc-tip">💡 右键卡片 = 完整操作菜单（打开 / 复制链接 / 移动分类 / 置顶 / 删除），比找小按钮更快。</div>
      ` },
      { id: 'basic-4', title: '调度台 · 今日三件事与项目调度', html: `
        <p>刷新即回调度台。三件事横向并列成一个模块，项目调度在其下两列铺开。</p>
        <h4>🕯 今日三件事（硬上限 3 件）</h4>
        <ul>
          <li><strong>为什么最多 3 件</strong>：三件事的价值在于"取舍"，不在于"全记"。超过 3 件，它就退化成又一张 Todo 清单——而你要的每天只有三件事是：今天结束了，最重要的几件事真的推进了。满员时显示 ⚖ 锁定条（3/3），空位入口立即拦截——先完成或移除一件，空位立即开放。</li>
          <li>空槽「＋ 从任务库选取」即唯一入口（R53 起顶部不再放重复按钮）：已完成与已选入的任务自动置灰；置顶任务排在最前；「复制昨日 / 导出」在模块右上角。</li>
          <li><strong>呼吸灯</strong>提示聚焦（选中/完成后转为常亮）；复选框并入标题行；<strong>单击</strong>任务卡 → 右栏「项目调度」联动呈现其隶属项目；<strong>双击</strong> → 打开任务详情抽屉；右上角 × 可移除后从任务库重选。</li>
          <li>勾选 = 同步完成任务状态；「复制昨日」一键延续；<kbd>Ctrl</kbd>+<kbd>←</kbd>/<kbd>→</kbd> 快速切日期。</li>
          <li>「导出」弹窗自选时间范围，CSV 六字段：任务内容 / 所属项目 / 项目→成功指标 / 任务状态 / 安排时间 / 创建时间。</li>
        </ul>
        <h4>📦 项目调度（两列，可拖拽）</h4>
        <ul>
          <li>默认呈现第一件事所隶属的项目，单击三件事任务卡即联动切换。</li>
          <li><strong>左列（方向感，R66 瘦身）</strong>：<strong>项目名大字</strong> + <strong>战略目标</strong>行（目标名 + 项目进度 + 进入详情）+ 四大数值 2×2：成功指标 / 任务总数 / 已完成 / 进行中——<strong>四格均可点击下钻</strong>（点击下钻弹窗列指标清单或任务明细，单击任务开详情）。愿景/使命在方向台与主航线查看，项目调度不再重复呈现。</li>
          <li><strong>中缝分隔条可左右拖拽</strong>（30%–75%，记忆保存）；<strong>右列（执行面）</strong>：按成功指标分组的任务树，<strong>默认全部展开</strong>、点指标行折叠/展开；支持「＋ 新建任务」（可指定指标）与「🔗 关联任务」；已关联任务 hover 出 <strong>⨯ 去关联</strong>（转未归档，不删除）；<strong>单击任务 → 右侧滑出详情抽屉</strong>。</li>
        </ul>
        <div class="mc-tip">💡 任务的多维管理在调度台底部 Tab「任务调度」（卡片 / 列表 / 看板三视图）——三件事只聚焦当下，项目只呈现全景。</div>
        <h4>🗑 删除入口（V2.21.3 补全）</h4>
        <ul>
          <li>任务调度<strong>卡片 / 列表 / 看板三视图</strong>均有删除入口：hover 卡片出现 🗑，或右键菜单「删除」；删除有 5 秒撤销。</li>
          <li>任务详情抽屉左下角提供降级样式的「🗑 删除」，不与主按钮抢视觉。</li>
        </ul>
        <h4>🪟 详情页新结构（V2.21.3 重设计）</h4>
        <ul>
          <li>三卡详情统一为：<strong>标题 + 状态下拉 chip</strong> → <strong>灵魂内容区</strong>（好奇心=摘录引用体 / 任务=说明 / 资源=链接）→ <strong>紧凑属性行</strong>（项目·指标双列、优先级、标签）→ <strong>折叠附属区</strong>（附件 / 挂载）。</li>
          <li>操作分层：左侧弱化次操作，右侧唯一主按钮（<kbd>Ctrl+↩</kbd> 保存）；危险操作一律降级。</li>
        </ul>
        <h4>📦 项目详情（方向台项目总览 / 搜索项目进入）</h4>
        <ul>
          <li>归属链四段可点击：愿景 → 使命 → 战略目标 → 项目（前三段跳完整方向树）。</li>
          <li>项目树：项目 → 成功指标 → 任务，默认展开，指标行带进度条；任务拖拽排序、跨指标归属。</li>
          <li><strong>任务附件区</strong>：按任务聚合展示附件（🖼 图片弹窗预览 / 🌐 HTML / 📕 PDF 新标签打开）；资源卡本体在资源台管理，此处不重复呈现。</li>
          <li>好奇心不直接挂进项目——通过「转为任务 / 归档为资源」进入，这是产品规则。</li>
        </ul>
      ` }
    ]
  },
  {
    title: '方法篇 · 认知增强',
    sections: [
      { id: 'mid-1', title: '资源价值公式', html: `
        <div class="mc-quote">资源的实际价值 = 资源本身的价值 × <b>被找到</b> × <b>被及时调用</b> × <b>被正确使用</b>的概率</div>
        <p>AI 时代从不缺第一项。知源的每个功能都在为后三项概率服务：</p>
        <table class="mc-table">
          <tr><th>提升哪项</th><th>对应功能</th><th>你的动作</th></tr>
          <tr><td>被找到</td><td>Ctrl+K（拼音首字母/工作台分类树/项目直达）· 标签树 · 分类树</td><td>收录时打对标签、放进合适分类</td></tr>
          <tr><td>被及时调用</td><td>双击直达 · 修饰键+数字 · 📌 置顶 · 最近打开</td><td>高频资源置顶，快捷键炼成肌肉记忆</td></tr>
          <tr><td>被正确使用</td><td>我的注解 · 采集时选中文字自动入描述</td><td>采集那一刻写一句「为什么留它」</td></tr>
        </table>
        <h4>用 🔥 做月度复用复盘</h4>
        <p>每张卡片的 🔥 = 被打开次数，指标条 <b>WRR</b> 是它们的周期总和。每月看一次：0 次调用的卡片，要么给它一个被找到的位置，要么诚实删掉——回收站永远兜底，而且删除后有 5 秒撤销。</p>
      ` },
      { id: 'mid-2', title: '六层思维链', html: `
        <div class="mc-flow">1 愿景 Why → 2 使命 How → 3 战略目标 → 4 攻坚项目 → 5 成功指标 → 6 任务</div>
        <ul>
          <li>全部节点点击即编辑（Enter 保存 / Esc 取消）；完整方向树默认全局展开，可逐层折叠，也可「⊞ 展开 / ⊟ 收起」一键全开全收。</li>
          <li>愿景 / 使命 / 战略目标三层——主航线呈现每个战略目标下的<strong>全部项目</strong>；🎯 主攻标记你此刻认定的方向（主攻标记的是重心，不是遮罩）；方向状态以「战略目标数 + 推进中项目数」直白呈现，不做加权计算。</li>
          <li>项目「已完成」口径：手动标记 done/归档，或<strong>项目下任务全部完成</strong>自动视为完成；「👁 已完成项目」显隐开关在主航线 / 项目总览 / 完整方向树三处同步。</li>
          <li>🎯 主攻（最多 2 个）直通调度台速览；14 天无推进自动亮 ⚠ 停滞。</li>
          <li>愿景/使命可「🔗 关联卡片」挂资源与好奇——为方向配上策展证据。</li>
        </ul>
        <div class="mc-tip">💡 不必一次写完六层。今天只有一个模糊愿景加一个项目，也完全合法——方向是长出来的，不是填出来的。</div>
      ` },
      { id: 'mid-3', title: '项目总览与项目详情', html: `
        <div class="mc-flow">方向台 · 项目总览（置顶分组 + 拖拽排序）→ 点击项目卡进入项目详情 → 就地策展指标与任务</div>
        <ul>
          <li><b>📌 置顶分组</b>：置顶组与全部组分块呈现；跨区拖拽会被拦截——先用 📌 决定分区。</li>
          <li><b>拖拽排序</b>：组内拖拽自由排序，刷新后保持；项目名单击即改名。</li>
          <li><b>删除项目 = 摘除式</b>：其下任务转为「未归档任务」（不删除，可重新关联），成功指标随项目移除——数据永不静默丢失。</li>
          <li>项目详情页：归属链可点击、任务附件按任务聚合、任务拖拽跨指标归属；与完整方向树实时双向同步。</li>
        </ul>
        <div class="mc-tip">💡 建议每周进一次项目详情做「策展式回顾」——这是给你自己看的，不是给老板看的。</div>
      ` },

      { id: 'mid-4', title: '方向状态与未归档任务', html: `
        <table class="mc-table">
          <tr><th>指标</th><th>口径</th><th>照见什么</th></tr>
          <tr><td>战略目标 / 推进项目</td><td>目标数 = 使命下拆解的方向数；推进中 = 挂有任务（任务数≠0）的项目数（全部项目口径）</td><td>方向是否有拆解、项目是否集体沉默</td></tr>
          <tr><td>WCE 好奇探索</td><td>探索中 + 已求证的好奇数</td><td>认知活力</td></tr>
          <tr><td>WRR 有效复用</td><td>周期内资源被打开次数</td><td>调度系统是否真在被用</td></tr>
          <tr><td>未归档任务</td><td>未挂项目/指标或引用失效的任务数（含分母=全部未删除任务）</td><td>归档清单是否干净（下钻级联归档）</td></tr>
        </table>
        <p>指标为镜子不是考核：数字不好看先别自责——问是方向错了，还是节奏断了（R64 起 DHI 计算口径退役，方向状态回归「目标数 + 推进数」的直白呈现）。</p>
        <div class="mc-tip">💡 每周一早上看一次「周」口径。</div>
      ` },
      { id: 'mid-5', title: '标签与字段', html: `
        <ul>
          <li>设置 → 标签管理：3 级树状标签，行内新建、拖拽挂层级、重命名<b>级联同步所有卡片</b>；新建的标签会高亮闪烁确认。</li>
          <li>三卡打标签统一走详情抽屉的标签选择器（读取标签树、显示完整路径）；体系为空时会引导你先去创建。</li>
          <li>设置 → 卡片字段：三卡独立字段设计，拖拽即排序、👁 控显隐、支持自定义字段，右侧实时预览三视图。</li>
        </ul>
        <div class="mc-tip">💡 索引哲学：先少后多。标签 5 个以内、字段 6 个以内时系统最顺手。</div>
      ` },
      { id: 'mid-6', title: 'Airtable 同步（进阶）', html: `
        <p>设置 → <b>⇄ Airtable 同步</b>：把知源的卡单向推送到你自己的 Airtable 表格，用于多维表分析、汇报引用或团队共享。<b>方向永远是知源 → Airtable，绝不回写本地</b>——你的数据仍然 100% 在本机。</p>
        <ul>
          <li><b>连接</b>：填入 Airtable Personal Access Token（需 data.records 读写 + schema.bases 写权限）、Base ID（app 开头）、Table ID（tbl 开头），点「测试连接」确认表名。</li>
          <li><b>自动建字段</b>：首次同步自动比对补齐缺失列（知源ID/标题/卡片类型/所属工作台/分类路径/层级/是否中心论点/链接/描述/标签/状态/优先级/截止日期/已删除/更新时间）；<b>已存在的列不改名不改类型</b>，公式/汇总/引用列一律不碰。</li>
          <li><b>同步范围</b>：调度台好奇心卡、方向台任务卡、资源台资源卡、各策展台镜像卡与主题卡。<b>每条镜像在 Airtable 是独立记录</b>（幂等键 = 卡ID:m:目标台），带各自「所属工作台」标识——资源台真身与策展台镜像各自成行。</li>
          <li><b>触发</b>：手动为主——设置页「立即同步」、调度台右上角同步状态卡点击、浏览器快捷键「同步到 Airtable」（chrome://extensions/shortcuts 自定义键位）；3 小时自动轮询默认关闭，按需开启。</li>
          <li><b>增量与限流</b>：只推上次同步后有更新的卡；每批 ≤10 条、批间 200ms、限流自动退避 30 秒。设置页显示累计调用次数。</li>
          <li><b>自愈（R64）</b>：若你在 Airtable 端手动删除了记录，下次同步会自动识别并<b>重建缺失记录</b>（无需手工清理映射），日志中可见「逐条自愈重建」；同步出错时点调度台右上角「同步出错」直接跳转设置页日志查看原因。</li>
          <li><b>删除</b>：知源删除的卡同步后在 Airtable 置「已删除」勾选，不物理删记录——Airtable 侧始终可追溯。</li>
        </ul>
        <div class="mc-tip">💡 主题卡（中心论点）同步为「是否中心论点」勾选列，不额外加列批注——它是知源界面层的呈现。</div>
      ` }
    ]
  },
  {
    title: '理念篇 · 知源哲学',
    sections: [
      { id: 'adv-1', title: '知源哲学', html: `
        <div class="mc-quote"><strong>知源</strong>，是知道自己为何出发，也知道所用信息从何而来；<strong>调度</strong>，是围绕自己的问题，让合适的信息、工具与材料参与行动。<br>万千可调用，自有我方向。</div>
        <p>信息不断涌来，工具不断更新，但外界的丰富并不会自动变成自己的进展。知源关注的是这中间的一段工作：我为什么投入这个问题？哪些好奇值得继续？什么资料可以作为依据？什么工具可以借力？做完之后，又形成了什么？知源不替你选择道路，而让你在浏览器这个通向外界的窗口里，<b>有一个围绕自己展开工作的地方</b>。</p>
        <table class="mc-table">
          <tr><th>关键词</th><th>主张</th></tr>
          <tr><td>知源</td><td>行动的来处与信息的来处，在这里相遇</td></tr>
          <tr><td>方向</td><td>看见方向——今天的行动有来处，与目标、项目的关系一目了然</td></tr>
          <tr><td>好奇</td><td>留下好奇——探索从自己的问题出发，先留下，回看时再选择投入</td></tr>
          <tr><td>调用</td><td>贯穿方式——根据当前问题组织信息源、工具与材料，让它们参与行动</td></tr>
          <tr><td>策展</td><td>策展成果——围绕主题取舍、分层与表达，做过的事形成自己的表达</td></tr>
          <tr><td>信任</td><td>本地保存、无账号、可导出迁移、删除可恢复——你对自己的数据有主权</td></tr>
          <tr><td>无摩擦</td><td>每一毫秒延迟都是对认知节奏的打断</td></tr>
          <tr><td>镜子</td><td>指标是镜子不是考核——反馈帮你看清自己，不给你打分</td></tr>
        </table>
        <p>边界声明：「知源」是一种品牌寓意——知源不自动保证信息真实、不自动鉴别一手来源、不替你完成判断。判断力，永远是你的肌肉。</p>
      ` },
      { id: 'adv-2', title: '理论支柱', html: `
        <table class="mc-table">
          <tr><th>层级</th><th>思想家</th><th>在知源中的戒律</th></tr>
          <tr><td>价值伦理</td><td>伊万·伊里奇 · 共生工具</td><td>绝不强制转化好奇心；数据本地可导出</td></tr>
          <tr><td>系统架构</td><td>恩格尔巴特 · 智力增强</td><td>六层思维链是脚手架不是牢笼；双向透射</td></tr>
          <tr><td>交互媒介</td><td>布雷特·维克多 · 动态媒介</td><td>毫秒级响应、直接操纵、拒绝隐藏导航</td></tr>
          <tr><td>资源组织</td><td>维纳·布什 · Memex</td><td>关联而非文件夹；允许杂乱</td></tr>
          <tr><td>成长反馈</td><td>唐纳德·舍恩 · 反思性实践</td><td>方向状态提供镜子而非评分</td></tr>
          <tr><td>意义生成</td><td>卡尔·维克 · 意义建构</td><td>支持自下而上修正愿景；允许模糊</td></tr>
        </table>
        <div class="mc-tip">💡 延伸阅读：布什 1945 年《As We May Think》——Memex 的联想路径就是今天你的完整方向树与关联卡片。</div>
      ` },
      { id: 'adv-3', title: '七不原则', html: `
        <ul>
          <li><b>不做 KPI 压迫</b>——无甘特图/燃尽图/逾期警报；逾期最多一枚低调的 ⏰。</li>
          <li><b>不做云端黑盒</b>——无账号无同步，数据 100% 本机。</li>
          <li><b>不做自动生成</b>——内置无 LLM；AI 是被调度的工具，不是替你思考的保姆。</li>
          <li><b>不做强制关联</b>——好奇可以只是一句问题；<b>不做信度评分</b>——来源可信与否，永远由人判断。</li>
          <li><b>不做复杂笔记</b>——深度写作交给 Obsidian/Notion，知源收录并直达其链接。</li>
          <li><b>不做事实裁决</b>——提供核验线索，判断力是你的肌肉。</li>
          <li><b>不做数据绑架</b>——JSON/CSV/Markdown 一键全量导出，随时带记忆离开。</li>
        </ul>
        <div class="mc-quote">写每行代码时自问：这个功能让用户更自由地思考，还是让用户更像机器的奴隶？如果是后者，删除它。</div>
      ` },
      { id: 'adv-4', title: '个性化探索', html: `
        <h4>① 设计你的每日动线</h4>
        <div class="mc-flow">刷新 → 调度台 30 秒（记录条 + 三件事）→ 方向台看主航线 → 干活中 <kbd>J</kbd>/<kbd>I</kbd>/<kbd>K</kbd> 随手采集 → 睡前照 1 分钟指标条</div>
        <h4>② 工作台即人生域</h4>
        <p>按人生项目或资源类型建工作台均可；图标与名称随点随改；左侧目录树支持<strong>逐节点展开/折叠</strong>（点 ▸ 箭头或文件夹图标），工具条<strong>「⊟ 收起」</strong>一键收起到根部、<strong>「⊞ 展开」</strong>全局展开（默认全展开）；<kbd>修饰键</kbd>+数字炼成肌肉记忆——<b>当你不再思考「工具在哪」，工具才真正消失</b>。</p>
        <h4>③ 数据主权演练</h4>
        <ul>
          <li>设置 → 导出数据：JSON 全量 / CSV / Markdown，建议每月一次。</li>
          <li>设置 → 📊 知源仪表盘：核心指标卡与动态条<strong>单击下钻明细</strong>，<strong>单击明细行</strong>即跳转定位到卡片所在页面；明细抽屉内置<strong>搜索框</strong>与<strong>左右翻页（每页 20 条）</strong>，大库也能快速找卡。</li>
          <li><strong>新增/导入双口径（V2.21.3 起）</strong>：「今日/本周新增」按<strong>新建 X</strong> 计数（卡片 createdAt），导入的卡单独显示<strong>「导 Y」</strong>并继承原创建时间——不会把导入错记成今天新建，明细里导入卡带「⇪ 导入」徽标。</li>
          <li><strong>运行错误留痕</strong>：出现崩溃/异常时，仪表盘动态条会出现「⚠ 运行错误 N」——单击即可导出含完整堆栈的 txt 文件，无需开 F12 就能把现场发给开发者定位。</li>
          <li>换电脑：新机装扩展 → 导入 JSON，一切如初；删除的卡片在回收站，且有 5 秒撤销兜底。</li>
        </ul>
        <h4>④ 数据迁移语义（V2.21.2 起）</h4>
        <ul>
          <li><strong>导出 = 全量快照（R66 起含界面偏好）</strong>：「导出全部数据」是一份完整 JSON——罗盘数据（愿景/使命/方向→项目→成功指标→任务关联）+ 调度台/方向台/资源台与各策展台数据（工作台/目录树/三类卡片/今日三件事/统计/行为日志）+ 全部数据关系 + <strong>界面偏好段 uiPrefs</strong>（主题/密度等）。</li>
          <li><strong>导入 = 并集合并 + 偏好自动应用</strong>：按 ID 与现有数据取并集，同 ID 以导入文件为准覆盖；指标的任务关联（taskIds）取并集；包内附 uiPrefs 时主题/密度<b>自动应用</b>，无需再设置。</li>
          <li><strong>导入前自动备份</strong>：点击导入时，扩展会先把当前全部数据自动下载为一份 JSON 备份——合并结果不满意，可再导入这份备份还原。</li>
          <li><strong>格式校验</strong>：仅接受知源 v2 格式的导出文件；其他 JSON 会被拒绝，不改动现有数据。</li>
        </ul>
        <h4>⑤ 留给你的探索题</h4>
        <ul>
          <li>把好奇心培育看板当创意漏斗：每周只转化一张卡，一个月后观察 WCE 与主航线的变化。</li>
          <li>每个战略目标只设 1 个主攻项目——放不下时，不是航线太窄，是你想要的太多。</li>
          <li>用「我的注解」写「为什么留它」：半年后，这是唯一不会被 AI 替代的检索信号。</li>
        </ul>
        <div class="mc-quote">愿你在某一天睡前感到：我知道自己在做什么、为什么做、正在成为想成为的人。</div>
      ` }
    ]
  },
  {
    title: '附录 · 速查',
    sections: [
      { id: 'ref-1', title: '快捷键全表', html: `
        <table class="mc-table">
          <tr><th>场景</th><th>按键</th><th>作用</th></tr>
          <tr><td rowspan="6">全局（任意网页）</td><td><kbd>Ctrl+Shift+J</kbd></td><td>快速采集资源卡</td></tr>
          <tr><td><kbd>Ctrl+Shift+I</kbd></td><td>采集好奇心（选中文字附带来源）</td></tr>
          <tr><td><kbd>Ctrl+K</kbd></td><td>全局搜索（空查询=快捷操作+最近打开）</td></tr>
          <tr><td><kbd>Ctrl+Shift+K</kbd></td><td>打开调度台</td></tr>
          <tr><td>（自定义）</td><td>打开方向台 / 打开资源台 / 打开完整方向树 / 打开设置——在 <code>chrome://extensions/shortcuts</code> 分配；<b>快速采集任务</b>（R66 对齐好奇心速记）——选中网页文字后按键：选中文本自动填入任务内容、网页标题填入任务名称、当前页链接填入链接字段（均可编辑可清除）；不选文字则为空表单；保存进全域任务；<b>同步到 Airtable</b>（R63）——任意位置一键触发单向同步（需先在设置完成连接配置）</td></tr>
          <tr><td></td><td></td></tr>
          <tr><td rowspan="4">应用内</td><td><kbd>修饰键</kbd>+<kbd>1…N</kbd></td><td>各策展台（从 1 起按导航顺序计数，修饰键可自定义）</td></tr>
          <tr><td><kbd>?</kbd></td><td>快捷键速查面板</td></tr>
          <tr><td><kbd>Ctrl</kbd>+<kbd>←</kbd>/<kbd>→</kbd></td><td>今日三件事切换日期</td></tr>
          <tr><td></td><td></td></tr>
          <tr><td rowspan="4">编辑与列表</td><td><kbd>Ctrl+Enter</kbd></td><td>保存并关闭（所有弹窗/抽屉）</td></tr>
          <tr><td><kbd>Esc</kbd></td><td>逐层关闭（含刷新动画跳过）</td></tr>
          <tr><td><kbd>↑↓</kbd> / <kbd>Enter</kbd> / <kbd>空格</kbd></td><td>任务列表：选择 / 开抽屉 / 批量勾选</td></tr>
          <tr><td><kbd>Tab</kbd></td><td>搜索内循环过滤类型</td></tr>
          <tr><td rowspan="3">鼠标</td><td>单击 / 双击</td><td>三卡一致：单击详情，双击打开链接</td></tr>
          <tr><td>右键</td><td>卡片操作菜单</td></tr>
          <tr><td>拖拽</td><td>排序 / 跨列改状态 / 跨组改归属（有插入线）</td></tr>
        </table>
        <div class="mc-warn">⌨ 系统级四键已占满默认键位；「打开设置 / 方向台 / 资源台 / 完整方向树 / 任务调度 / 同步到 Airtable」在 <code>chrome://extensions/shortcuts</code> 手动分配——高效使用知源的第一步。</div>
      ` },
      { id: 'ref-2', title: '数据与安全', html: `
        <ul>
          <li>所有数据 100% 存储在本机（chrome.storage.local），无账号、无云端、无「同步中」的谎言。</li>
          <li>设置 → 导出数据：JSON 全量 / 按工作台 CSV / Markdown，建议每月备份。</li>
          <li>导入 JSON：<strong>并集合并</strong>，含罗盘数据与调度台全部数据及关系；导入前自动下载当前数据备份，仅接受 v2 格式（详见「日常仪式 · 数据迁移语义」）。</li>
          <li>删除一律软删：回收站可恢复；删除瞬间 toast 有 5 秒撤销。</li>
          <li>设置 → 重置与回滚：输入「回滚」确认后恢复初始状态（先导出！）。</li>
        </ul>
        <div class="mc-quote">数据主权是认知主权的物理保证：你对自己的资源有主权，你对自己的数据同样有主权。</div>
      ` }
    ]
  }
]


/** 独立分享版 HTML（自包含样式 + 目录锚点，任何浏览器打开即可阅读） */
export function buildManualStandaloneHtml(): string {
  const toc = MANUAL.map(part => {
    const items = part.sections.map(sec => `<a class="t-item" href="#sec-${sec.id}">${sec.title}</a>`).join('')
    return `<div class="t-part">${part.title}</div>${items}`
  }).join('')
  const body = MANUAL.map(part => part.sections.map(sec => `
    <section id="sec-${sec.id}">
      <div class="s-part">${part.title}</div>
      <h2>${sec.title}</h2>
      <div class="doc">${sec.html}</div>
    </section>`).join('')).join('')
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>知源调度台 · 使用手册</title>
<style>
  body { margin: 0; background: #FAFAFB; color: #17181C; font-family: "Inter", -apple-system, "PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei", sans-serif; font-size: 14.5px; line-height: 2.05; letter-spacing: -0.011em; }
  header { background: #010102; color: #F7F8F8; padding: 26px 32px; }
  header .t { font-size: 20px; font-weight: 600; letter-spacing: -0.02em; }
  header .s { font-size: 12px; color: #8A8F98; margin-top: 4px; letter-spacing: .08em; }
  .wrap { display: flex; gap: 32px; max-width: 1120px; margin: 40px auto; padding: 0 32px; align-items: flex-start; }
  nav { width: 230px; flex-shrink: 0; position: sticky; top: 20px; background: #fff; border: 1px solid #E3E4E8; border-radius: 12px; padding: 12px 8px; max-height: calc(100vh - 60px); overflow: auto; }
  .t-part { font-size: 11px; font-weight: 700; color: #8A8F98; letter-spacing: .06em; padding: 10px 10px 4px; }
  a.t-item { display: block; padding: 6px 10px; border-radius: 6px; color: #3C3F45; text-decoration: none; font-size: 13px; border-left: 2px solid transparent; }
  a.t-item:hover { background: #F0F0F3; color: #17181C; }
  main { flex: 1; min-width: 0; }
  section { background: #fff; border: 1px solid #E7E8EC; border-radius: 12px; padding: 38px 46px; margin-bottom: 26px; scroll-margin-top: 20px; }
  .s-part { font-size: 11px; font-weight: 700; color: #5E6AD2; letter-spacing: .1em; text-transform: uppercase; margin-bottom: 8px; }
  h2 { font-size: 21px; font-weight: 600; letter-spacing: -0.02em; margin: 0 0 16px; }
  .doc p { margin: 10px 0; }
  .doc h4 { font-size: 13.5px; font-weight: 700; margin: 18px 0 8px; padding-left: 9px; border-left: 3px solid #5E6AD2; }
  .doc ul { padding-left: 20px; margin: 6px 0; }
  .doc li { margin: 5px 0; }
  .doc b { color: #17181C; }
  .doc strong { color: #5E6AD2; font-weight: 700; }
  .doc code { background: #EFEFF1; border-radius: 4px; padding: 1px 6px; font-size: 12px; }
  .doc kbd { background: #EFEFF1; border: 1px solid #D5D6DB; border-radius: 5px; padding: 1px 7px; font-size: 11px; box-shadow: 0 1px 0 #D5D6DB; white-space: nowrap; }
  .doc .mc-flow { display: flex; flex-wrap: wrap; gap: 6px 10px; background: #F7F7F8; border: 1px dashed #D5D6DB; border-radius: 10px; padding: 10px 14px; margin: 10px 0; font-size: 13px; }
  .doc .mc-steps { display: flex; flex-direction: column; gap: 8px; margin: 10px 0; }
  .doc .mc-step { display: flex; gap: 10px; background: #F7F7F8; border-radius: 10px; padding: 9px 12px; font-size: 13px; }
  .doc .mc-step b:first-child { flex-shrink: 0; width: 22px; height: 22px; border-radius: 7px; background: #5E6AD2; color: #fff; font-size: 11px; display: flex; align-items: center; justify-content: center; }
  .doc .mc-tip { background: #EDF0FA; border-radius: 10px; padding: 10px 14px; margin: 12px 0; font-size: 13px; line-height: 1.8; }
  .doc .mc-warn { background: #FBF1DE; border-radius: 10px; padding: 10px 14px; margin: 12px 0; font-size: 13px; line-height: 1.8; }
  .doc .mc-quote { background: linear-gradient(135deg, #EDF0FA, #fff); border-left: 3px solid #5E6AD2; border-radius: 0 12px 12px 0; padding: 14px 18px; margin: 12px 0; font-size: 14px; line-height: 2; color: #17181C; }
  .doc .mc-table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 13px; }
  .doc .mc-table th { text-align: left; background: #EFEFF1; padding: 7px 10px; border: 1px solid #E3E4E8; }
  .doc .mc-table td { padding: 7px 10px; border: 1px solid #E3E4E8; vertical-align: top; }
  footer { text-align: center; font-size: 11px; color: #8A8F98; padding: 24px 0 40px; letter-spacing: .1em; }
  @media print { nav { display: none; } .wrap { display: block; padding: 0; } section { border: none; } }
</style>
</head>
<body>
  <header><div class="t">📖 知源调度台 · 使用手册</div><div class="s">速览 / 基础 / 方法 / 理念 / 附录 · 万千可调用，自有我方向</div></header>
  <div class="wrap"><nav>${toc}</nav><main>${body}</main></div>
  <footer>— 由知源调度台导出分享 —</footer>
</body>
</html>`
}
