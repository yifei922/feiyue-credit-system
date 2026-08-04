// 广告位配置（环境变量驱动，未配置时降级为友好提示）
// - banner: 首页 / 资料详情页底部常驻
// - reward: 资料解锁 / 积分奖励（用户主动触发的激励视频）
//
// ⚠ adUnitId 需在微信公众平台 → 流量主 → 广告位管理 申请获取。
//    申请要求：累计独立访客 ≥ 1000 UV（个人主体）/ 商业主体无门槛。
//    申请通过后把 ID 配置到环境变量即可，本模块无需改代码。

const BANNER_AD_UNIT_ID = '__WX_AD_BANNER__'  // 替换为真实 adunit-xxx
const REWARD_AD_UNIT_ID = '__WX_AD_REWARD__'  // 替换为真实 adunit-xxx

const REWARD_PLACEMENTS = {
  // 各位置可单独打开/关闭，避免某个位置广告异常影响整体体验
  homeBanner: false,
  resourceBanner: false,
  resourceReward: true,   // 资料超额时解锁
  dailyBonus: true,       // 每日看广告赚积分入口
}

function envFlag(key, def = false) {
  try {
    // 微信小程序可通过 wx.env 读取（但只能读自己定义的环境变量）
    return typeof getApp === 'function' ? getApp().globalData?.env?.[key] ?? def : def
  } catch (_) { return def }
}

module.exports = {
  BANNER_AD_UNIT_ID,
  REWARD_AD_UNIT_ID,
  REWARD_PLACEMENTS,
  // 未配置 adUnitId 时降级：banner 显示提示，reward 显示"功能待开通"
  isReady: BANNER_AD_UNIT_ID.startsWith('__') === false,
}