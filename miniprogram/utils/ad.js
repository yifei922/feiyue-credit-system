// 广告组件封装：开屏插屏 + 激励视频（悬浮窗）
// 未配置真实 adUnitId 时自动「放行」（开发预览阶段可直接跳过），不阻塞业务。
const adCfg = require('../config/ad-config.js');

// 展示激励视频（悬浮窗广告）。onReward 在用户完整看完后回调。
// 返回 Promise<boolean>：true=看完(或开发放行)，false=未看完/失败
function showRewardedVideo(adUnitId, onReward) {
  return new Promise((resolve) => {
    if (!wx.createRewardedVideoAd || !adCfg.isReady(adUnitId)) {
      // 未开通广告位：开发阶段直接视为看完，保证流程可走通
      if (onReward) onReward();
      return resolve(true);
    }
    let ad = null;
    try { ad = wx.createRewardedVideoAd({ adUnitId }); } catch (e) { if (onReward) onReward(); return resolve(true); }
    ad.onError(() => { wx.showToast({ title: '广告加载失败', icon: 'none' }); resolve(false); });
    ad.onClose((res) => {
      if (res && res.isEnded) { if (onReward) onReward(); resolve(true); }
      else { wx.showToast({ title: '需看完广告才能查看', icon: 'none' }); resolve(false); }
    });
    ad.load().then(() => ad.show()).catch(() => {
      wx.showToast({ title: '广告展示失败', icon: 'none' }); resolve(false);
    });
  });
}

// 展示开屏插屏广告（每日一次由调用方控制频次）
function showInterstitial(adUnitId) {
  if (!wx.createInterstitialAd || !adCfg.isReady(adUnitId)) return;
  try {
    const ad = wx.createInterstitialAd({ adUnitId });
    ad.onError(() => {});
    ad.show().catch(() => {});
  } catch (_) {}
}

module.exports = { showRewardedVideo, showInterstitial, adCfg };
