// 统一后端「文件上传 / 静态资源」基址解析
// 根据 config/env.js 的 USE_CLOUD_RUN 决定：
//  - 非云托管：直接用 API_BASE（localhost 或备案域名）
//  - 云托管：用默认公网域名 CLOUD_RUN_PUBLIC_HOST
//    ⚠ 默认公网域名仅适合接口测试；生产请绑定备案自定义域名，或小程序直传 COS
const { API_BASE, USE_CLOUD_RUN, CLOUD_RUN_PUBLIC_HOST } = require('../config/env.js');

function assetBase() {
  if (USE_CLOUD_RUN) return 'https://' + CLOUD_RUN_PUBLIC_HOST;
  return API_BASE;
}

module.exports = { assetBase };
