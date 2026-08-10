// ============================================================
//  后端服务地址配置 · 环境切换（上线前只改这一处）
// ============================================================
//  切换方法：把 IS_PROD 改为 true 即进入生产环境。
//
//  生产环境使用云托管公网域名走 wx.request（标准 HTTP 方式）：
//    → USE_CLOUD_RUN = false，API_BASE 填云托管公网域名即可
//
//  开发环境默认 http://localhost:3001，无需改动。
//
//  ⚠ wx.callContainer 是云开发（Cloud Base）专属 API，本项目用云托管（Cloud Run），
//    不依赖该 API，所有请求统一走 wx.request + 公网域名。
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
  // —— 使用云托管公网域名走 wx.request（wx.callContainer 需云开发环境，真机不可用）——
  USE_CLOUD_RUN: false,
  API_BASE: 'https://express-fzw2-294081-6-1465570426.sh.run.tcloudbase.com',

  // —— 云托管环境信息（保留备用）——
  CLOUD_RUN_ENV: 'prod-d8gu13a84a2b62eed',
  CLOUD_RUN_SERVICE: 'express-fzw2',
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
