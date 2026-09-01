/**
 * 写给用户的一封信（donge 哥）· 内容数据
 * 用于：设置 → 一封信（v-html 渲染）+ 独立 HTML 导出分享。
 */

export const LETTER_HTML = `
<div class="lp-saluta">亲爱的朋友：</div>
<div class="lp-body">
  <p>见字如面。这封信我写了很多遍，删了很多遍——不是因为辞藻，而是因为要承认下面这件事，需要一点勇气：</p>
  <p class="lp-h"><b>我也焦虑。</b></p>
  <p>我是 donge，一名在教育科技行业深耕了十余年的产品人，也是一名和你一样的知识工作者——这两年，也在一线探索 AI 如何真正赋能学习与工作。过去两年，我和你一样，眼看着自己的工具箱从两三个软件膨胀成三十个入口；眼看着新模型一个接一个地发布，每一个都声称能解决你的问题；眼看着自己一天能产出过去一周的东西，却在月底复盘时发现——那份关键的分析报告，随着浏览器标签页的关闭，再也找不到了。</p>
  <p class="lp-turn">你也经历过吧。</p>
  <p>也许是汇报现场的三秒钟沉默：你确信三个月前研究过那份文件，它就在你的书签、硬盘、或者某次对话记录里——但当着所有人的面，你只能说"我稍后找给您"。也许是收藏夹里躺着的十几个工具入口，每个都试过，没有一个用深。也许是深夜加班后合上电脑，突然被一个问题击中：</p>
  <p class="lp-h"><b>我今天做的这些，和我真正想成为的那个人，有什么关系？</b></p>
  <p>这个问题，工具回答不了。</p>
  <p>我后来想明白了一件事：这不是自律问题，也不是工具不够强。一个知识工作者每天同时站在三个现场——获取信息的现场、调用资源的现场、确认方向的现场。流行的工具各自守着一个现场，而焦虑，恰恰发生在现场的断裂处。一件收藏的真实价值，从来不取决于它本身有多好，而在于你需要的那一刻，能不能找到它、用上它、用对它。</p>
  <p class="lp-turn">所以，我做了知源工作台。</p>
  <p>它不长在云端，就住在你的浏览器里。三秒钟，把一个网页、一份本地文件、一个灵感，收进属于你自己的地方；需要的时候，一次搜索，秒级直达——哪怕你只记得拼音的首字母。它把你的愿景和使命摆在每天打开的第一屏，把今天最重要的三件事放在手边；它收下你的每一个好奇心，却不催促它们变成任务——问题可以长期悬置，等你，也等你准备好。</p>
  <p>它同样重要的，是它<b>不做什么</b>。我向你保证：它绝不用红点和警报逼迫你，绝不上传你的任何数据，绝不内置什么"AI 替你思考"，绝不给你的好奇心打分、设截止日期——来源可信与否，也永远由你判断。工具应当扩大人的自主性，而不是让人依赖它——这句话是一位叫伊里奇的思想家说的，我把它当作这个产品的底线。还有一位叫舍恩的学者说，反馈应该是一面镜子，而不是一张考卷。知源里的每一个数字，都是镜子。</p>
  <p>有位咨询顾问跟我讲过他的变化。从前他被客户问住，只能尴尬地说稍后回复；用了知源之后，每次查资料他都顺手标记来源、写下一句话备注。又一次汇报，同样的问题被问起，他按下搜索，卡片浮出——"官方原文，您看第三条。"他说，底气不是天生的，<b>底气来自对源头的掌控</b>。</p>
  <p>我想看见的你，也是这样：先是打开新标签页时不再被推送牵着走；然后是拥有了一份属于自己的、越用越可信的资产网络；最后是——工具在变，算法在变，但你始终知道，自己真正想问的问题是什么，自己的源头在哪里。</p>
  <p>AI 可以在几秒钟内给出答案，但它不会替你保留真正想问的问题，也不会替你承担判断的责任。在快时代里，找到属于自己的慢节奏，是我们最核心的竞争力，也是我们最珍贵的权利。</p>
  <p>愿你在某一天睡前，感到你知道自己在做什么、为什么做、正在成为你想成为的那个人。</p>
  <p class="lp-creed">从好奇出发，向源头求证。</p>
</div>
<div class="lp-sign">
  <div class="lp-name">你的同路人<br><b>donge 哥</b></div>
  <div class="lp-date">2026 年 · 写于知源工作台发布之际</div>
</div>
`

/** 独立分享版 HTML（自包含样式，任何浏览器打开即可阅读） */
export function buildLetterStandaloneHtml(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>写给用户的一封信 · 知源工作台</title>
<style>
  body { margin: 0; background: #F3F1EC; font-family: "Songti SC", "Noto Serif SC", "SimSun", Georgia, serif; color: #2B2B28; }
  .paper { max-width: 640px; margin: 72px auto; background: #FFFDF8; border: 1px solid #EBE7DD; border-radius: 2px; box-shadow: 0 1px 32px rgba(60,50,30,.06); padding: 88px 76px; box-sizing: border-box; }
  .brand { text-align: center; font-size: 11px; letter-spacing: .4em; color: #A8A399; margin-bottom: 64px; }
  .lp-saluta { font-size: 16px; margin-bottom: 40px; }
  .lp-body p { font-size: 15px; line-height: 2.8; margin: 0 0 36px; text-align: justify; }
  .lp-body b { color: #1F1E1A; }
  .lp-sign { margin-top: 88px; text-align: right; font-size: 14px; line-height: 2.2; color: #55524A; }
  .lp-sign b { font-size: 15px; color: #2B2B28; }
  .lp-date { font-size: 12px; color: #9B968A; margin-top: 10px; letter-spacing: .05em; }
  /* 第卅轮：模块化分节——节头/停顿/信念行（与应用内同构） */
  .lp-body p.lp-h { margin: 64px 0 36px; font-size: 16.5px; color: #2B2B28; }
  .lp-body p.lp-turn { margin: 24px 0 36px; color: #2B2B28; }
  .lp-body p.lp-creed { margin: 56px 0 0; letter-spacing: .08em; color: #2B2B28; font-weight: 600; }
  .foot { text-align: center; font-size: 10px; color: #B4AFA4; margin: 36px 0 48px; letter-spacing: .15em; }
  @media print { body { background: #fff; } .paper { border: none; box-shadow: none; margin: 0 auto; } }
</style>
</head>
<body>
  <div class="brand">知源工作台 · 从好奇出发，向源头求证</div>
  <div class="paper">${LETTER_HTML}</div>
  <div class="foot">— 由知源工作台导出分享 —</div>
</body>
</html>`
}
