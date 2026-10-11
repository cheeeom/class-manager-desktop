/* Microsoft Store 版构建配置（electron-builder --win --config store.config.js）
   与 package.json 的 build 段同源，仅叠加：
   - appx 目标 + 商店身份四要素（与 Partner Center 预登记逐字一致，2026-10-11 老板提供）
   - 本地安装测试用自签证书（subject 匹配商店 Publisher；商店上架包由微软重签）
   - 禁 NSIS、禁 publish（商店版更新由商店托管） */
const base = require('./package.json').build;

module.exports = Object.assign({}, base, {
  win: Object.assign({}, base.win, {
    target: [{ target: 'appx', arch: ['x64'] }],
    certificateSubjectName: '490FE7CA-7868-47E8-A72A-471E4DC9D956'
  }),
  appx: {
    identityName: 'chee777.5391106D84753',
    publisher: 'CN=490FE7CA-7868-47E8-A72A-471E4DC9D956',
    publisherDisplayName: 'chee777',
    applicationId: 'CMDesktop',
    displayName: '班主任工作台·班级管理',
    languages: ['zh-CN'],
    showNameOnTiles: true,
    addAutoLaunchExtension: false
  },
  publish: null,
  nsis: undefined
});
