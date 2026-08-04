# 微信小程序广告位申请 + 接入手册

> 目标：开通 banner（首页 / 资料详情）+ 激励视频（资料解锁 / 积分兑换），使小程序具备变现能力。

## 一、申请前置条件（微信官方门槛）

| 广告位类型 | 准入门槛 | 说明 |
|---|---|---|
| **Banner（横幅）** | 无门槛 | 注册即开通 |
| **激励视频** | 累计独立访客 ≥ 1000 UV | 个人主体需积累真实用户 |
| **插屏 / 视频广告** | 累计独立访客 ≥ 1000 UV | 同上 |

**0–1000 UV 阶段**：仅用 Banner；激励视频入口留空 + 友好提示"功能即将上线"。
**1000+ UV 后**：申请激励视频，按本手册接入。

## 二、申请步骤（图文版）

### 第 1 步：开通流量主
1. 浏览器打开 https://mp.weixin.qq.com → 用小程序管理员微信扫码登录
2. 左侧菜单 → **推广与变现** → **流量主**
3. 阅读《微信小程序流量主服务协议》→ 勾选"已阅读"→ **开通**
4. 填写主体信息（个人/企业）→ 提交

### 第 2 步：申请广告位
1. 流量主页面 → **广告位管理**
2. 选择"Banner 广告位"→ **申请开通**（即时通过）
3. 选择"激励视频广告位"→ **申请开通**（需审核 1–3 个工作日）
4. 申请通过后，每个广告位会生成 `adunit-xxxxxxxx` 形式的 **广告位 ID**

### 第 3 步：嵌入代码
1. 打开 `miniprogram/pages/resource-detail/resource-detail.js`
2. 把 `adunit-please-replace` 替换为真实激励视频广告位 ID：
   ```js
   const ad = wx.createRewardedVideoAd({ adUnitId: 'adunit-abcd1234' })
   ```
3. 打开 `miniprogram/pages/index/index.wxml`
4. 在底部 `<view class="container">` 内加：
   ```html
   <ad unit-id="adunit-efgh5678" ad-type="banner" />
   ```
5. `wx.request` 提交新版小程序审核（**广告组件首次上线必须走审核**）

## 三、代码位置清单

| 文件 | 用途 | 广告位 ID 替换 |
|---|---|---|
| `miniprogram/config/ad-config.js` | 集中配置 | `BANNER_AD_UNIT_ID` / `REWARD_AD_UNIT_ID` |
| `miniprogram/pages/resource-detail/resource-detail.js` | 资料超额解锁激励视频 | `REWARD_AD_UNIT_ID` |
| `miniprogram/pages/index/index.wxml` | 首页底部 banner | `BANNER_AD_UNIT_ID` |
| `miniprogram/pages/study/study.wxml` | 学习页 banner（可选） | `BANNER_AD_UNIT_ID` |

> ⚠ adUnitId 严禁硬编码在多个文件里——全部从 `ad-config.js` 读取，方便运营修改。

## 四、广告反滥用策略（服务端已实现）

后端 `mp_resources.js` + `mp_points.js` 已写入防刷：

```js
// 1) 每日每资料广告解锁上限 20 次（AD_UNLOCK_DAILY_LIMIT）
// 2) 每日积分激励上限 20 次（AD_DAILY_LIMIT）
// 3) 同一资源当日已解锁，再次进入仍消耗免费配额（不重复触发广告）
// 4) 所有记录写入 ad_view_log 表，便于运营审计
```

如需调整阈值，改 `server/src/routes/mp_resources.js` 第 14 行。

## 五、上线后运营要点

| 指标 | 监控方式 |
|---|---|
| 广告曝光量（impression） | 微信公众平台 → 流量主 → 数据报表 |
| 点击率（CTR） | 同上 |
| eCPM / 收益 | 同上（次日更新） |
| 用户投诉率 | 微信公众平台 → 反馈管理 |
| 每日广告解锁次数 | 后端 `SELECT COUNT(*) FROM ad_view_log WHERE day=?` |

> 如果 CTR < 0.5%，建议调整 banner 位置或换 banner 样式；
> 如果用户反馈频繁出现"广告与功能混淆"，立即把 banner 调小或换成文字链。

## 六、审核驳回常见原因

1. **广告遮挡主要内容**（banner 盖住按钮）→ 调整位置 + 增加底部 padding
2. **激励视频前未明示** → 在按钮文案加"看完视频后"
3. **未成年人保护模式缺失** → 小程序游戏类目必填，本项目为工具类不受限
4. **未提供关闭按钮** → Banner 自带关闭图标，无需额外处理

## 七、完整接入代码示例

```js
// miniprogram/pages/resource-detail/resource-detail.js
const { REWARD_AD_UNIT_ID, isReady } = require('../../config/ad-config.js');

onWatchAd() {
  if (!isReady) {
    return wx.showModal({
      title: '功能即将上线',
      content: '广告位正在申请中，暂时无法解锁，请明天再来',
      showCancel: false,
    });
  }
  const ad = wx.createRewardedVideoAd({ adUnitId: REWARD_AD_UNIT_ID });
  ad.onLoad(() => {});
  ad.onError((e) => wx.showToast({ title: '广告加载失败，请稍后重试', icon: 'none' }));
  ad.onClose((res) => {
    if (res && res.isEnded) {
      // 完整观看，调用后端解锁接口
      app.apiPost('/api/mp/resources/' + this.data.id + '/unlock', {})
        .then((r) => {
          this.setData({ 'res.url': r.data.url, requiresAd: false });
          wx.showToast({ title: '已解锁，请查看', icon: 'success' });
        })
        .catch((e) => wx.showToast({ title: e.message, icon: 'none' }));
    } else {
      wx.showToast({ title: '需看完视频才能解锁', icon: 'none' });
    }
  });
  ad.load().then(() => ad.show()).catch(() => {
    wx.showToast({ title: '广告展示失败', icon: 'none' });
  });
}
```