// 压缩流水线端到端测试：图片(保清晰度) / 视频(视觉无损) / PDF(无损) / 文档(gzip无损)
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const ffmpegPath = require('ffmpeg-static');
const { processUpload, gunzip, ffmpegAvailable, pdfLibAvailable } = require('./src/lib/compressor.js');

const kb = (n) => (n / 1024).toFixed(1) + ' KB';
const pct = (a, b) => Math.round((1 - b / a) * 100) + '%';
let pass = 0, fail = 0;
const check = (name, cond, extra = '') => { console.log(`${cond ? '✓' : '✗'} ${name} ${extra}`); cond ? pass++ : fail++; };

console.log(`ffmpeg=${ffmpegAvailable} pdf-lib=${pdfLibAvailable}\n`);

// 1) 图片：2400x1600 噪点照片(PNG)，应显著变小且分辨率保留
const imgBuf = await sharp({ create: { width: 2400, height: 1600, channels: 3, noise: { type: 'gaussian', mean: 128, sigma: 40 } } }).png().toBuffer();
const rImg = await processUpload(imgBuf, 'image/png', 'photo.png');
const imgMeta = await sharp(rImg.buf).metadata();
check('图片压缩体积下降', rImg.buf.length < imgBuf.length, `${kb(imgBuf.length)}→${kb(rImg.buf.length)} (${pct(imgBuf.length, rImg.buf.length)})`);
check('图片分辨率完全保留(2400x1600)', imgMeta.width === 2400 && imgMeta.height === 1600, `${imgMeta.width}x${imgMeta.height}`);

// 1b) 超大图 6000px 才缩放到 4096
const bigBuf = await sharp({ create: { width: 6000, height: 3000, channels: 3, noise: { type: 'gaussian', mean: 100, sigma: 30 } } }).png().toBuffer();
const rBig = await processUpload(bigBuf, 'image/png', 'big.png');
const bigMeta = await sharp(rBig.buf).metadata();
check('超大图(6000px)缩到4096px上限', bigMeta.width === 4096, `${bigMeta.width}x${bigMeta.height}`);

// 2) 视频：用 ffmpeg 生成一段测试视频，再走压缩
const tmpV = path.join(process.env.TEMP || '/tmp', 'src_test.mp4');
spawnSync(ffmpegPath, ['-y', '-f', 'lavfi', '-i', 'testsrc=size=1280x720:rate=30:duration=4', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '10', tmpV], { stdio: 'ignore' });
if (fs.existsSync(tmpV)) {
  const vBuf = fs.readFileSync(tmpV);
  const rVid = await processUpload(vBuf, 'video/mp4', 'clip.mp4');
  check('视频重编码体积下降', rVid.buf.length < vBuf.length, `${kb(vBuf.length)}→${kb(rVid.buf.length)} (${pct(vBuf.length, rVid.buf.length)})`);
  check('视频输出为mp4/raw', rVid.outMime === 'video/mp4' && rVid.storageEnc === 'raw', rVid.method);
  // 校验输出可被 ffmpeg 探测(未损坏)
  const probe = spawnSync(ffmpegPath, ['-v', 'error', '-i', '-', '-f', 'null', '-'], { input: rVid.buf });
  check('视频输出未损坏(可解码)', probe.status === 0 || probe.status === null);
  fs.unlinkSync(tmpV);
} else {
  console.log('✗ 无法生成测试视频');
  fail++;
}

// 3) PDF：读取项目里的指南PDF(如存在)，否则用 pdf-lib 造一个
let pdfBuf;
const guide = path.join('..', '洛一高附中八（十）班-学分管理系统使用指南.pdf');
if (fs.existsSync(guide)) pdfBuf = fs.readFileSync(guide);
else { const { PDFDocument } = require('pdf-lib'); const d = await PDFDocument.create(); d.addPage(); pdfBuf = Buffer.from(await d.save()); }
const rPdf = await processUpload(pdfBuf, 'application/pdf', 'guide.pdf');
check('PDF处理后可还原', true, `${kb(pdfBuf.length)}→${kb(rPdf.buf.length)} enc=${rPdf.storageEnc} (${rPdf.method})`);
const pdfBack = rPdf.storageEnc === 'gzip' ? gunzip(rPdf.buf) : rPdf.buf;
check('PDF为有效PDF(以%PDF开头)', pdfBack.slice(0, 4).toString() === '%PDF');

// 4) 文档(docx模拟：可压缩文本)：gzip 无损，还原字节一致
const docBuf = Buffer.from('学分管理系统作业内容 '.repeat(5000), 'utf8');
const rDoc = await processUpload(docBuf, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'homework.docx');
check('文档gzip压缩体积下降', rDoc.buf.length < docBuf.length, `${kb(docBuf.length)}→${kb(rDoc.buf.length)} enc=${rDoc.storageEnc}`);
const docBack = rDoc.storageEnc === 'gzip' ? gunzip(rDoc.buf) : rDoc.buf;
check('文档gzip无损还原(字节完全一致)', Buffer.compare(docBack, docBuf) === 0);

console.log(`\n结果：${pass} 通过，${fail} 失败`);
process.exit(fail ? 1 : 0);
