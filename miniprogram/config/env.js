// ============================================================
//  后端服务地址配置 · 环境切换（上线前只改这一处）
// ============================================================
//  切换方法：把 IS_PROD 改为 true 即进入生产环境。
//
//  生产环境二选一（先把 IS_PROD 改成 true，再选一种）：
//    A) 自有大陆备案域名（轻量云 / 云服务器方案）
//       → USE_CLOUD_RUN = false，并把 API_BASE 改成你的 https 域名
//    B) 微信云托管 CallContainer（免域名、免 ICP 备案方案，推荐）
//       → USE_CLOUD_RUN = true，并填 CLOUD_RUN_ENV（环境ID）与
//         CLOUD_RUN_PUBLIC_HOST（默认公网域名，供文件上传/静态资源用）
//
//  开发环境默认 http://localhost:3001，无需改动。
//
//  ⚠ 若选方案 B（云托管），调用层会自动改用 wx.callContainer（见 utils/api.js / app.js），
//    本文件只负责提供配置，不负责切换网络调用方式。
// ============================================================

const IS_PROD = false;

const DEV = {
  USE_CLOUD_RUN: false,
  API_BASE: 'http://localhost:3001',
  CLOUD_RUN_ENV: '',
  CLOUD_RUN_PUBLIC_HOST: '',
};

const PROD = {
  // —— 方案 A：自有大陆备案域名（如 https://mp.example.com）——
  USE_CLOUD_RUN: false,
  API_BASE: 'https://你的备案域名.com',
  // —— 方案 B：微信云托管（免备案）——
  CLOUD_RUN_ENV: '你的云托管环境ID',
  // 云托管默认公网域名（如 xxxx.ap-shanghai.run.tcloudbase.com），
  // 用于 wx.uploadFile 文件上传 与 /study 静态资源；生产建议绑定备案自定义域名或直传COS
  CLOUD_RUN_PUBLIC_HOST: '你的云托管默认公网域名',
};

const cfg = IS_PROD ? PROD : DEV;

module.exports = {
  IS_PROD,
  USE_CLOUD_RUN: cfg.USE_CLOUD_RUN,
  API_BASE: cfg.API_BASE,
  PROD_API_BASE: PROD.API_BASE,
  CLOUD_RUN_ENV: cfg.CLOUD_RUN_ENV,
  CLOUD_RUN_PUBLIC_HOST: cfg.CLOUD_RUN_PUBLIC_HOST,
};
