// 广告位配置（流量主）
// - SPLASH_AD_UNIT_ID：开屏/插屏广告（app 启动后由首页展示，每日一次）
// - REWARD_AD_UNIT_ID：激励视频（打开推荐资料时的悬浮窗广告，看完才能看资料）
//
// ⚠ adUnitId 需在微信公众平台 → 流量主 → 广告位管理 申请获取。
//    申请要求：累计独立访客 ≥ 1000 UV（个人主体）/ 商业主体无门槛。
//    申请通过后把真实 ID 填到下方即可，组件已做「未配置则优雅跳过」处理，
//    因此没有流量主账号也能正常预览（开发阶段广告位会直接放行）。
const SPLASH_AD_UNIT_ID = '__WX_AD_SPLASH__';  // 替换为真实 adunit-xxx（插屏广告位）
const REWARD_AD_UNIT_ID = '__WX_AD_REWARD__';  // 替换为真实 adunit-xxx（激励视频广告位）

function isReady(id) {
  return typeof id === 'string' && id.length > 0 && !id.startsWith('__');
}

module.exports = {
  SPLASH_AD_UNIT_ID,
  REWARD_AD_UNIT_ID,
  isReady,
  // 是否已有可用广告位（用于前端判断是否展示「看广告」入口
  hasSplash: isReady(SPLASH_AD_UNIT_ID),
  hasReward: isReady(REWARD_AD_UNIT_ID),
};
