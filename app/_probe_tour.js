/* 一次性视觉探针：新手示例体验全链（v1.0.9）
   隔离 userData → 不写 onboarded（让首启向导出现）→ 跳过各步到完成页 → 点「带示例体验」
   → 等过渡+指引出现 → 截图 → 连点下一步到完成 → 验证示例数据自动清除。
   运行：env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron _probe_tour.js
   绝不写真实数据（userData 指向系统临时目录）。 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');

app.setPath('userData', path.join(os.tmpdir(), 'cm_desk_probe_tour_' + Date.now()));
app.whenReady().then(function () {
  const win = new BrowserWindow({
    width: 1280, height: 820, show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: false, spellcheck: false, preload: path.join(__dirname, 'preload.js') }
  });
  win.webContents.on('console-message', function (e, level, message) {
    if (level >= 3) console.log('[PROBE][console-err] ' + String(message).slice(0, 160));
  });
  win.loadFile(path.join(__dirname, 'dist', 'index.html'));

  const click = (id) => 'var b=document.getElementById("' + id + '");b?(b.click(),1):0;';
  const steps = [
    ['wizard', click('cmWizNext')],                       // 开始配置 → 登录密码步
    ['w2', click('cmWizSkipPwd')],                        // 跳过登录密码 → 管理员密码步
    ['w3', click('cmWizSkipPwd')],                        // 跳过管理员密码 → 班级信息步
    ['w4', click('cmWizSkip')],                           // 跳过班级保存 → 导入步
    ['w5', click('cmWizSkip')],                           // 跳过导入 → 模块速览步
    ['w6', click('cmWizNext')],                           // → 完成页
    ['sample', click('cmWizSample')],                     // 带示例体验
    ['waitEnter', null],                                  // 等过渡 + watch + 首个指引
    ['shotTour', null],
    ['g1', click('cmGuideNext')],
    ['g2', click('cmGuideNext')],
    ['g3', click('cmGuideNext')],
    ['g4', click('cmGuideNext')],
    ['waitStep', null],
    ['shotStep5', null],
    ['g5', click('cmGuideNext')],                         // 完成体验 → 自动清除
    ['verify', '(function(){var r={};r.flag=localStorage.getItem("cmSampleTour");' +
      'r.students=state.students.filter(function(s){return s.id>=990001&&s.id<=990999;}).length;' +
      'r.allStudents=state.students.length;' +
      'r.ops=state.operations.filter(function(o){return o.id>=990001&&o.id<=990999;}).length;' +
      'r.className=state.className;r.bubbleGone=!document.getElementById("cmDeskGuide");' +
      'r.toast=(document.querySelector(".toast,.cm-toast")||{}).textContent||"";return JSON.stringify(r);})()'],
    ['shotFinal', null]
  ];

  async function shot(name) {
    const img = await win.webContents.capturePage();
    const out = path.join(__dirname, 'out', name);
    fs.writeFileSync(out, img.toPNG());
    console.log('[PROBE] shot=' + out);
  }

  win.webContents.once('did-finish-load', async function () {
    try {
      win.show();
      await new Promise(r => setTimeout(r, 600));
      for (const [name, js] of steps) {
        if (js === null) {
          const wait = name === 'waitEnter' ? 3200 : (name === 'waitStep' ? 700 : 500);
          await new Promise(r => setTimeout(r, wait));
          console.log('[PROBE] ' + name + ' ok');
          if (name === 'shotTour') await shot('_probe_tour.png');
          if (name === 'shotStep5') await shot('_probe_tour_step5.png');
          if (name === 'shotFinal') await shot('_probe_tour_final.png');
          continue;
        }
        try {
          const out = await win.webContents.executeJavaScript(js);
          console.log('[PROBE] ' + name + ' = ' + String(out).slice(0, 200));
        } catch (e) {
          console.log('[PROBE] ' + name + ' FAIL: ' + String(e && (e.message || e)).slice(0, 200));
        }
        await new Promise(r => setTimeout(r, 350));
      }
      console.log('[PROBE] done');
      app.exit(0);
    } catch (e) {
      console.log('[PROBE] fatal ' + (e && e.message));
      app.exit(1);
    }
  });
});
