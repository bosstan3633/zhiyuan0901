/**
 * 产品使用手册数据（第二十轮重写）
 * 五篇结构：速览 / 基础 / 方法 / 理念 / 附录
 * html 字段由 GlobalSettings 手册面板以 v-html 渲染。
 */
export interface ManualSection { id: string; title: string; html: string }
export interface ManualPart { title: string; sections: ManualSection[] }

export const MANUAL: ManualPart[] = [
  {
    title: '速览 · 一页上手',
    sections: [
      { id: 'quick-1', title: '30 秒看懂知源', html: `
        <p>知源工作台接管你的浏览器新标签页。它做三件事：<strong>把好东西收进来、把方向摆在眼前、把任务落到今天</strong>。</p>
        <div class="mc-flow">🔍 Ctrl+K 搜一切 ｜ 📥 Ctrl+Shift+J 采集网页 ｜ 💡 Ctrl+Shift+I 记灵感</div>
        <h4>每天的节奏</h4>
        <div class="mc-steps">
          <div class="mc-step"><b>1</b><span>打开新标签页 → 首页确认方向（灯塔 + 北极星 + 好奇心）</span></div>
          <div class="mc-step"><b>2</b><span>进知源罗盘 → 今日三件事，锁定今天最重要的 3 件事</span></div>
          <div class="mc-step"><b>3</b><span>干活中随手三键采集，双击卡片直达资源</span></div>
          <div class="mc-step"><b>4</b><span>睡前看一眼北极星——它是镜子，不是考核</span></div>
        </div>
        <h4>三个主场景</h4>
        <table class="mc-table">
          <tr><th>我想…</th><th>去哪里</th><th>怎么做</th></tr>
          <tr><td>收一个网页/灵感</td><td>任意页面三键</td><td>J 采集资源 · I 记好奇心 · K 全局搜索</td></tr>
          <tr><td>推进今天的任务</td><td>知源罗盘 → 今日行动</td><td>三件事勾选完成，看板拖拽流转</td></tr>
          <tr><td>调用收藏的资源</td><td>工作台 / Ctrl+K</td><td>双击卡片直达链接；搜索支持拼音首字母</td></tr>
        </table>
        <div class="mc-tip">💡 先花 1 分钟打开 <code>chrome://extensions/shortcuts</code> 把三键改成你的肌肉记忆——这是高效使用知源的第一步。</div>
      ` }
    ]
  },
  {
    title: '基础篇 · 上手',
    sections: [
      { id: 'basic-1', title: '界面全景', html: `
        <p>整个产品就是一条<strong>「方向 → 行动 → 资源」</strong>的动线，全部住在浏览器新标签页里。</p>
        <div class="mc-flow">🏠 首页（看方向与好奇心）→ 🧭 知源罗盘（今日行动 / 项目策展 / 方向树）→ 📂 工作台（资源策展）</div>
        <h4>首页：30 秒方向确认仪式</h4>
        <ul>
          <li><b>知源灯塔</b>：愿景、使命与主攻项目——在方向树里点亮 📡 投射后自动出现；右上角可跳转罗盘；点击项目卡滑出详情抽屉。</li>
          <li><b>知源北极星</b>：六面镜子（方向健康度 / 好奇探索 / 有效复用 / 模块分组 / 链接卡片 / 未归档任务），全部可点击下钻查看明细。</li>
          <li><b>我的好奇心</b>：卡片 / 列表 / 看板三种视图；单击看详情，双击打开链接；右上角 📌 置顶。</li>
        </ul>
        <h4>导航</h4>
        <table class="mc-table">
          <tr><th>去哪里</th><th>快捷键</th><th>说明</th></tr>
          <tr><td>🧭 知源罗盘</td><td><kbd>Alt</kbd>+<kbd>1</kbd></td><td>角标 = 今日三件事未完成数</td></tr>
          <tr><td>📂 各工作台</td><td><kbd>Alt</kbd>+<kbd>2…9</kbd></td><td>设置 → 快捷键设置可逐个自定义</td></tr>
          <tr><td>⌨ 快捷键速查</td><td><kbd>?</kbd></td><td>任意页面呼出全量速查表</td></tr>
        </table>
        <div class="mc-tip">💡 无论停在哪一页，刷新固定回首页——方向优先，是知源的第一设计。</div>
      ` },
      { id: 'basic-2', title: '三键采集', html: `
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
          <li>穿透三卡与全部工作台；空查询时显示<strong>快捷操作 + 最近打开</strong>。</li>
          <li>结果按 📄 资源 / ✅ 任务 / 💡 好奇 <b>分组</b>呈现，关键词<b>高亮</b>；支持<b>拼音与首字母</b>（输入 sj 能命中「设计」）。</li>
          <li><kbd>Tab</kbd> 循环过滤类型，或输入「任务」「资源」「好奇」+ Tab 直达。</li>
          <li>选中结果按 <kbd>Ctrl</kbd>+<kbd>C</kbd> 复制 Markdown 引用（标题+链接）。</li>
        </ul>
        <div class="mc-warn">⚠ chrome:// 等不可注入页面会自动改用独立小窗，体验一致。</div>
      ` },
      { id: 'basic-3', title: '工作台策展', html: `
        <h4>单击看详情 · 双击开链接（三卡一致）</h4>
        <div class="mc-flow">单击卡片 → 详情抽屉 ｜ 双击卡片 → 打开链接（网页 / 本地文件 / Obsidian）</div>
        <h4>分类：最多 2 级的树</h4>
        <ul>
          <li>「＋ 新建分类」弹窗输入即建；hover 出 <b>📌 置顶 / ✎ 重命名 / 🗑 删除</b>，也可右键呼出菜单。</li>
          <li>拖拽三语义：上下沿=同级排序（有插入线）；拖到根分类中间=成为子分类；拖到底部「⬆ 升为一级」区=恢复顶级。</li>
          <li>点父分类聚合显示全部子孙资源；卡片左下角 📂 分类标签可点击跳转。</li>
        </ul>
        <h4>置顶与批量</h4>
        <ul>
          <li>📌 在卡片右上角（资源/好奇/任务三卡一致）；置顶项物理移到列表顶部，拖拽顺序始终以你手动排列为准。</li>
          <li>批量管理：批量打开（>15 确认）/ 批量删除（可撤销）/ 批量移动到任意工作台与分类。</li>
          <li>误删不慌：删除后的 toast 里有<b>「撤销」</b>按钮，5 秒内一键恢复。</li>
        </ul>
        <div class="mc-tip">💡 右键卡片 = 完整操作菜单（打开 / 复制链接 / 移动分类 / 置顶 / 删除），比找小按钮更快。</div>
      ` },
      { id: 'basic-4', title: '今日行动', html: `
        <p>按 <kbd>Alt</kbd>+<kbd>1</kbd> 进入罗盘，默认停在今日行动。</p>
        <h4>🕯 今日三件事</h4>
        <ul>
          <li>空槽「＋ 从库选取」：已完成与已选入的任务自动置灰；置顶任务排在最前。</li>
          <li>勾选 = 同步完成任务状态；「复制昨日」一键延续；<kbd>Ctrl</kbd>+<kbd>←</kbd>/<kbd>→</kbd> 快速切日期。</li>
          <li>「导出」弹窗自选时间范围，CSV 六字段：任务内容 / 所属项目 / 项目→成功指标 / 任务状态 / 安排时间 / 创建时间。</li>
        </ul>
        <h4>📋 全域任务管理</h4>
        <ul>
          <li>列表 / 看板双视图；拖拽排序有<strong>插入位置线</strong>，拖到哪落哪；看板跨列拖拽改状态。</li>
          <li>「📂 按项目分组」：跨组拖拽 = 改项目归属；看板列内按项目分小节。</li>
          <li>任务详情抽屉：级联选 项目→成功指标、状态三选 chips、链接字段、备注（可拖拽调高）、标签；抽屉左缘可拖拽调宽并记忆。</li>
          <li>键盘流：列表内 <kbd>↑↓</kbd> 选择、<kbd>Enter</kbd> 开抽屉、<kbd>空格</kbd> 批量勾选。</li>
        </ul>
        <div class="mc-tip">💡 三件事的意义不在多，而在少——每天最多 3 件。它是承诺，不是清单。</div>
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
          <tr><td>被找到</td><td>Ctrl+K（拼音首字母）· 标签树 · 分类树</td><td>收录时打对标签、放进合适分类</td></tr>
          <tr><td>被及时调用</td><td>双击直达 · Alt+数字 · 📌 置顶 · 最近打开</td><td>高频资源置顶，快捷键炼成肌肉记忆</td></tr>
          <tr><td>被正确使用</td><td>我的注解 · 采集时选中文字自动入描述</td><td>采集那一刻写一句「为什么留它」</td></tr>
        </table>
        <h4>用 🔥 做月度复用复盘</h4>
        <p>每张卡片的 🔥 = 被打开次数，北极星 <b>WRR</b> 是它们的周期总和。每月看一次：0 次调用的卡片，要么给它一个被找到的位置，要么诚实删掉——回收站永远兜底，而且删除后有 5 秒撤销。</p>
      ` },
      { id: 'mid-2', title: '六层思维链', html: `
        <div class="mc-flow">1 愿景 Why → 2 使命 How → 3 战略目标 → 4 攻坚项目 → 5 成功指标 → 6 任务</div>
        <ul>
          <li>全部节点点击即编辑（Enter 保存 / Esc 取消）；默认全局展开，可逐层折叠。</li>
          <li>四层 📡 投射至灯塔——首页只显示你此刻认定的方向。灯塔放不下，说明你想要的太多。</li>
          <li>🎯 主攻（最多 2 个）直通今日行动速览条；14 天无推进自动亮 ⚠ 停滞。</li>
          <li>愿景/使命可「🔗 关联卡片」挂资源与好奇——为方向配上策展证据。</li>
        </ul>
        <div class="mc-tip">💡 不必一次写完六层。今天只有一个模糊愿景加一个项目，也完全合法——方向是长出来的，不是填出来的。</div>
      ` },
      { id: 'mid-3', title: '项目策展', html: `
        <div class="mc-flow">全景墙（每项目一块展板卡）→ 点击进入全屏展板 → 就地策展指标与任务</div>
        <ul>
          <li>「新建 / 规划项目」弹窗里展示<b>愿景→使命→战略目标</b>视觉链，选择归属后一键创建并直接进入展板。</li>
          <li>展板内就地添加指标与任务；任务拖拽排序、跨指标拖拽归属；删除指标时任务自动转入「⚠ 未归类任务」，永不丢失。</li>
          <li>项目详情抽屉（首页灯塔/北极星点入的是同一个）就地编辑一切，实时同步罗盘。</li>
        </ul>
        <div class="mc-tip">💡 建议每周进一次展板做「策展式回顾」——这是给你自己看的，不是给老板看的。</div>
      ` },
      { id: 'mid-4', title: '北极星与未归档任务', html: `
        <table class="mc-table">
          <tr><th>指标</th><th>口径</th><th>照见什么</th></tr>
          <tr><td>DHI 方向健康度</td><td>活跃项目 14 天内有推进=清晰</td><td>项目是否集体沉默</td></tr>
          <tr><td>WCE 好奇探索</td><td>探索中 + 已求证的好奇数</td><td>认知活力</td></tr>
          <tr><td>WRR 有效复用</td><td>周期内资源被打开次数</td><td>调度系统是否真在被用</td></tr>
          <tr><td>📥 未归档任务</td><td>未挂成功指标的任务数（含未挂项目）</td><td>散落任务是否需要归位</td></tr>
        </table>
        <p>六卡全部可下钻：未归档任务抽屉里<strong>级联选择项目→指标即完成归档</strong>，任务当场从清单消失。</p>
        <div class="mc-tip">💡 每周一早上看一次「周」口径。数字不好看先别自责——问是方向错了，还是节奏断了。</div>
      ` },
      { id: 'mid-5', title: '标签与字段', html: `
        <ul>
          <li>设置 → 标签管理：3 级树状标签，行内新建、拖拽挂层级、重命名<b>级联同步所有卡片</b>；新建的标签会高亮闪烁确认。</li>
          <li>三卡打标签统一走详情抽屉的标签选择器（读取标签树、显示完整路径）；体系为空时会引导你先去创建。</li>
          <li>设置 → 卡片字段：三卡独立字段设计，拖拽即排序、👁 控显隐、支持自定义字段，右侧实时预览三视图。</li>
        </ul>
        <div class="mc-tip">💡 索引哲学：先少后多。标签 5 个以内、字段 6 个以内时系统最顺手。</div>
      ` }
    ]
  },
  {
    title: '理念篇 · 知源哲学',
    sections: [
      { id: 'adv-1', title: '知源哲学', html: `
        <div class="mc-quote">「知」，是深刻地明白；「源」，是万物的起点。<br>真正有力量的人，不是信息最多的人，而是始终<b>知道自己源头在哪里</b>的人。</div>
        <p>AI 把个人生产力放大了百倍，也带来了工具爆炸与节奏失控。知源不做「又一个 AI 助手」，而做<b>资源调度层与认知控制塔</b>——AI 是被调度的工具，人才是判断与行动的主体。八大关键词：</p>
        <table class="mc-table">
          <tr><th>关键词</th><th>主张</th></tr>
          <tr><td>知源</td><td>知道自己源头在哪里</td></tr>
          <tr><td>好奇心</td><td>不是待办清单，是与认知未来签下的温柔约定</td></tr>
          <tr><td>源头</td><td>长期核验的一手来源，不可被 AI 复制的认知壁垒</td></tr>
          <tr><td>调度</td><td>在正确的时刻调用正确的资源</td></tr>
          <tr><td>看见</td><td>无法调用看不见的资源，无法深化看不见的好奇</td></tr>
          <tr><td>无摩擦</td><td>每一毫秒延迟都是对认知节奏的打断</td></tr>
          <tr><td>策展</td><td>不是管理资源，是为认知生活做郑重选择</td></tr>
          <tr><td>美</td><td>界面之美，是你愿意每天回来照料系统的唯一理由</td></tr>
        </table>
      ` },
      { id: 'adv-2', title: '理论支柱', html: `
        <table class="mc-table">
          <tr><th>层级</th><th>思想家</th><th>在知源中的戒律</th></tr>
          <tr><td>价值伦理</td><td>伊万·伊里奇 · 共生工具</td><td>绝不强制转化好奇心；数据本地可导出</td></tr>
          <tr><td>系统架构</td><td>恩格尔巴特 · 智力增强</td><td>六层思维链是脚手架不是牢笼；双向透射</td></tr>
          <tr><td>交互媒介</td><td>布雷特·维克多 · 动态媒介</td><td>毫秒级响应、直接操纵、拒绝隐藏导航</td></tr>
          <tr><td>资源组织</td><td>维纳·布什 · Memex</td><td>关联而非文件夹；允许杂乱</td></tr>
          <tr><td>成长反馈</td><td>唐纳德·舍恩 · 反思性实践</td><td>北极星提供镜子而非评分</td></tr>
          <tr><td>意义生成</td><td>卡尔·维克 · 意义建构</td><td>支持自下而上修正愿景；允许模糊</td></tr>
        </table>
        <div class="mc-tip">💡 延伸阅读：布什 1945 年《As We May Think》——Memex 的联想路径就是今天你的方向树与关联卡片。</div>
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
        <div class="mc-flow">刷新 → 首页 30 秒 → <kbd>Alt+1</kbd> 今日行动 → 干活中 <kbd>J</kbd>/<kbd>I</kbd>/<kbd>K</kbd> 随手采集 → 睡前照 1 分钟北极星</div>
        <h4>② 工作台即人生域</h4>
        <p>按人生项目或资源类型建工作台均可；⌘ 图标与名称随点随改；<kbd>Alt</kbd>+数字炼成肌肉记忆——<b>当你不再思考「工具在哪」，工具才真正消失</b>。</p>
        <h4>③ 数据主权演练</h4>
        <ul>
          <li>设置 → 导出数据：JSON 全量 / CSV / Markdown，建议每月一次。</li>
          <li>换电脑：新机装扩展 → 导入 JSON，一切如初；删除的卡片在回收站，且有 5 秒撤销兜底。</li>
        </ul>
        <h4>④ 留给你的探索题</h4>
        <ul>
          <li>把好奇心看板当创意漏斗：每周只转化一张卡，一个月后观察 WCE 与方向树的变化。</li>
          <li>每个战略目标只投射 1 个项目上灯塔——放不下时，不是灯塔太小，是你想要的太多。</li>
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
          <tr><td rowspan="4">全局（任意网页）</td><td><kbd>Ctrl+Shift+J</kbd></td><td>快速采集资源卡</td></tr>
          <tr><td><kbd>Ctrl+Shift+I</kbd></td><td>采集好奇心（选中文字附带来源）</td></tr>
          <tr><td><kbd>Ctrl+K</kbd></td><td>全局搜索（空查询=快捷操作+最近打开）</td></tr>
          <tr><td><kbd>Ctrl+Shift+K</kbd></td><td>打开工作台</td></tr>
          <tr><td rowspan="3">应用内</td><td><kbd>Alt</kbd>+<kbd>1</kbd> / <kbd>2…9</kbd></td><td>知源罗盘 / 各工作台（可自定义）</td></tr>
          <tr><td><kbd>?</kbd></td><td>快捷键速查面板</td></tr>
          <tr><td><kbd>Ctrl</kbd>+<kbd>←</kbd>/<kbd>→</kbd></td><td>今日三件事切换日期</td></tr>
          <tr><td rowspan="4">编辑与列表</td><td><kbd>Ctrl+Enter</kbd></td><td>保存并关闭（所有弹窗/抽屉）</td></tr>
          <tr><td><kbd>Esc</kbd></td><td>逐层关闭</td></tr>
          <tr><td><kbd>↑↓</kbd> / <kbd>Enter</kbd> / <kbd>空格</kbd></td><td>任务列表：选择 / 开抽屉 / 批量勾选</td></tr>
          <tr><td><kbd>Tab</kbd></td><td>搜索内循环过滤类型</td></tr>
          <tr><td rowspan="3">鼠标</td><td>单击 / 双击</td><td>三卡一致：单击详情，双击打开链接</td></tr>
          <tr><td>右键</td><td>卡片操作菜单</td></tr>
          <tr><td>拖拽</td><td>排序 / 跨列改状态 / 跨组改归属（有插入线）</td></tr>
        </table>
        <div class="mc-warn">⌨ 系统级四键在 <code>chrome://extensions/shortcuts</code> 自定义——高效使用知源的第一步。</div>
      ` },
      { id: 'ref-2', title: '数据与安全', html: `
        <ul>
          <li>所有数据 100% 存储在本机（chrome.storage.local），无账号、无云端、无「同步中」的谎言。</li>
          <li>设置 → 导出数据：JSON 全量 / 按工作台 CSV / Markdown，建议每月备份。</li>
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
<title>知源工作台 · 使用手册</title>
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
  <header><div class="t">📖 知源工作台 · 使用手册</div><div class="s">速览 / 基础 / 方法 / 理念 / 附录 · 从好奇出发，向源头求证</div></header>
  <div class="wrap"><nav>${toc}</nav><main>${body}</main></div>
  <footer>— 由知源工作台导出分享 —</footer>
</body>
</html>`
}
