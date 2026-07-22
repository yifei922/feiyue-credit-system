// 冒烟测试：验证 ffmpeg 进度解析 + processUpload 进度回调
import fs from 'fs'
const { processUpload, ffmpegAvailable } = await import('./src/lib/compressor.js')
console.log('ffmpegAvailable:', ffmpegAvailable)

const buf = fs.readFileSync('C:/Users/20242/test_src.mp4')
const events = []
const r = await processUpload(buf, 'video/mp4', 'test_src.mp4', (pct, msg, ind) => {
  events.push({ pct, msg, ind })
  console.log('  progress:', pct, msg, 'indeterminate=' + ind)
})
console.log('result method:', r.method, 'size', buf.length, '->', r.buf.length)
const percents = events.filter(e => e.pct != null).map(e => e.pct)
console.log('percent events:', percents.length, 'first/last:', percents[0], percents[percents.length-1])
console.log('OK')
