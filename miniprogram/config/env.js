// ============================================================
//  后端服务地址配置 · 环境切换（上线前只改这一处）
// ============================================================
//  切换方法：把 IS_PROD 改为 true 即进入生产环境。
//
//  生产环境（默认）：微信云托管走 wx.callContainer
//    → USE_CLOUD_RUN = true，填 CLOUD_RUN_ENV（环境ID）+ CLOUD_RUN_SERVICE（服务名）
//    → 免域名、免 ICP 备案，无需配置服务器域名白名单
//
//  开发环境默认 http://localhost:3001，无需改动。
//
//  ⚠ 本项目已正确关联云托管环境（正式 AppID），wx.callContainer 可用。
//    切勿切回 wx.request + 公网域名：.sh.run.tcloudbase.com 是测试域名，
//    微信禁止在正式环境使用（会报"云托管域名仅用作测试使用"）。
// ============================================================
//
//  ┌──────────────────────────────────────────────────────┐
//  │ 【上线开关】把下面这行的 false 改成 true 即切到云托管 │
//  └──────────────────────────────────────────────────────┘

const IS_PROD = true;

const DEV = {
  USE_CLOUD_RUN: false,
  API_BASE: 'http://localhost:3001',
  CLOUD_RUN_ENV: '',
  CLOUD_RUN_SERVICE: '',
  CLOUD_RUN_PUBLIC_HOST: '',
};

const PROD = {
  // —— 方案 B：微信云托管（官方推荐，免域名免备案）——
  // 走 wx.callContainer 微信内部通道，无需配置服务器域名白名单。
  // 注意：wx.callContainer 依赖正确 AppID 关联的云托管环境，
  // 之前因用测试号 AppID 导致 is not a function，已修正为正式号。
  USE_CLOUD_RUN: true,
  API_BASE: 'https://express-fzw2-294081-6-1465570426.sh.run.tcloudbase.com',

  // 环境ID：云托管控制台左上角环境下拉框
  CLOUD_RUN_ENV: 'prod-d8gu13a84a2b62eed',
  // 服务名：云托管「服务列表」里的服务名称（callContainer 必须通过 X-WX-SERVICE 指定）
  CLOUD_RUN_SERVICE: 'express-fzw2',
  // 云托管默认公网域名（仅用于 wx.uploadFile 等需真实域名的场景）
  CLOUD_RUN_PUBLIC_HOST: 'express-fzw2-294081-6-1465570426.sh.run.tcloudbase.com',
};

const cfg = IS_PROD ? PROD : DEV;

module.exports = {
  IS_PROD,
  USE_CLOUD_RUN: cfg.USE_CLOUD_RUN,
  API_BASE: cfg.API_BASE,
  PROD_API_BASE: PROD.API_BASE,
  CLOUD_RUN_ENV: cfg.CLOUD_RUN_ENV,
  CLOUD_RUN_SERVICE: cfg.CLOUD_RUN_SERVICE,
  CLOUD_RUN_PUBLIC_HOST: cfg.CLOUD_RUN_PUBLIC_HOST,
};
