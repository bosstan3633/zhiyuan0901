const fs = require('fs');
const f = 'D:/zhiyuan0828 - zp/v2/src/newtab/components/GlobalPopups.vue';
let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

// 修复 saveCapture 中去重确认的括号结构
const bad = `    if (dup) {
      if (!(await useConfirm({ title: '重复采集', message: \`该页面已收录为「\${dup.title.slice(0, 40)}」。\n点击确认将定位到已有卡片。\`, confirmText: '定位到卡片' }))) { return }
        chrome.runtime.sendMessage({ type: 'zy-locate-workspace', wsId: dup.workspaceId, hl: dup.id })
        resetCaptureForm()
        closeAll()
      }
      return
    }
  }
  const r: ResourceCard = {`;

const good = `    if (dup) {
      const okFlag = await useConfirm({ title: '重复采集', message: \`该页面已收录为「\${dup.title.slice(0, 40)}」。\n点击确认将定位到已有卡片。\`, confirmText: '定位到卡片' })
      if (okFlag) {
        chrome.runtime.sendMessage({ type: 'zy-locate-workspace', wsId: dup.workspaceId, hl: dup.id })
        resetCaptureForm()
        closeAll()
      }
      return
    }
  }
  const r: ResourceCard = {`;

if (!s.includes(bad)) { console.error('bad block NOT FOUND'); process.exit(1); }
s = s.replace(bad, good);
fs.writeFileSync(f, s);
console.log('saveCapture dedupe fixed');
