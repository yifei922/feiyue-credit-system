// 附件压缩流水线：按类型选择“保清晰度 / 视觉无损 / 完全无损”的策略压体积。
// - 图片：保留原分辨率（仅超大图才缩到 4096px），高质量重编码（q92），肉眼无损、体积更小。
// - 视频：ffmpeg 重编码 H.264 CRF23，分辨率/帧率不变，视觉无损、体积通常显著下降。
// - PDF：pdf-lib 对象流无损重存 + gzip 无损兜底，画质 100% 不变。
// - 其他文档（Word/Excel/PPT/zip/txt…）：gzip 无损存储，下载时透明还原，字节完全一致。
// 任一步骤失败都回退原文件，绝不影响上传成功；仅当结果更小才采用压缩版。
const sharp = require('sharp');
const zlib = require('zlib');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

// ffmpeg / pdf-lib 均为可选依赖：安装缺失时自动降级，不会导致上传失败或服务崩溃
let ffmpegPath = null;
try { ffmpegPath = require('ffmpeg-static'); } catch (_) { ffmpegPath = null; }
let PDFDocument = null;
try { PDFDocument = require('pdf-lib').PDFDocument; } catch (_) { PDFDocument = null; }

const IMG_MAX_SIDE = 4096;                 // 仅超大图才缩放，日常照片分辨率完全保留
const IMG_QUALITY = 92;                    // 高质量，肉眼无损
const VIDEO_MAX_INPUT = 300 * 1024 * 1024; // 超过则跳过转码（避免免费层 OOM/超时）
const VIDEO_TIMEOUT_MS = 8 * 60 * 1000;    // 单个视频转码超时保护

const isImage = (m) => /^image\//.test(m || '');
const isVideo = (m, name = '') => /^video\//.test(m || '') || /\.(mp4|mov|m4v|webm|avi|mkv|flv|3gp|wmv)$/i.test(name);
const isPdf = (m, name = '') => (m === 'application/pdf') || /\.pdf$/i.test(name);

// progress 回调签名：onProgress(percent|null, message, indeterminate=false)
// - percent 为数字时显示具体百分比；为 null 时由 indeterminate 决定显示转圈动画

// ── 图片：保清晰度压缩 ──
async function optimizeImage(buf, mime, onProgress) {
  if (mime === 'image/svg+xml' || mime === 'image/gif') return null; // 矢量/动图保持原样
  try {
    if (onProgress) onProgress(null, '图片压缩中…', true);
    const img = sharp(buf, { failOn: 'none' });
    const meta = await img.metadata();
    if (meta.width && meta.height) {
      const long = Math.max(meta.width, meta.height);
      if (long > IMG_MAX_SIDE) {
        img.resize(meta.width >= meta.height ? { width: IMG_MAX_SIDE } : { height: IMG_MAX_SIDE });
      }
    }
    let outMime, ext;
    if (meta.hasAlpha) { img.webp({ quality: IMG_QUALITY, effort: 5 }); outMime = 'image/webp'; ext = '.webp'; }
    else { img.jpeg({ quality: IMG_QUALITY, mozjpeg: true }); outMime = 'image/jpeg'; ext = '.jpg'; }
    const out = await img.toBuffer();
    const m2 = await sharp(out).metadata().catch(() => ({}));
    return { buf: out, outMime, ext, width: m2.width || null, height: m2.height || null };
  } catch (_) { return null; }
}

// ── 视频：ffmpeg 视觉无损重编码（带进度）──
function runFfmpeg(inPath, outPath, onProgress) {
  return new Promise((resolve, reject) => {
    const args = [
      '-y', '-i', inPath,
      '-c:v', 'libx264', '-crf', '23', '-preset', 'veryfast', // veryfast 降低 CPU 占用（免费层 0.1 核）
      '-c:a', 'aac', '-b:a', '128k',
      '-movflags', '+faststart',
      '-progress', 'pipe:1',                 // 机器可读进度写入 stdout
      outPath
    ];
    const p = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let durationMs = null;
    let lastPct = -1;
    // 从 stderr 解析总时长
    p.stderr.on('data', (d) => {
      if (durationMs != null) return;
      const m = d.toString().match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (m) durationMs = (parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3])) * 1000;
    });
    // 从 stdout 解析 out_time_ms 计算百分比
    p.stdout.on('data', (d) => {
      if (!onProgress) return;
      const lines = d.toString().split(/\r?\n/);
      for (const line of lines) {
        const ms = line.match(/^out_time_ms=(\d+)/);
        if (ms && durationMs) {
          const pct = Math.min(99, Math.max(1, Math.round((parseInt(ms[1]) / durationMs) * 100)));
          if (pct !== lastPct) { lastPct = pct; onProgress(pct, '视频转码中…'); }
        }
      }
    });
    const timer = setTimeout(() => { try { p.kill('SIGKILL'); } catch (_) {} reject(new Error('ffmpeg timeout')); }, VIDEO_TIMEOUT_MS);
    p.on('error', (e) => { clearTimeout(timer); reject(e); });
    p.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) { if (onProgress) onProgress(100, '视频转码完成'); resolve(); }
      else reject(new Error('ffmpeg exit ' + code));
    });
  });
}

async function optimizeVideo(buf, onProgress) {
  if (!ffmpegPath || buf.length > VIDEO_MAX_INPUT) return null;
  if (onProgress) onProgress(null, '视频转码准备中…', true);
  const tmp = os.tmpdir();
  const inP = path.join(tmp, 'in_' + crypto.randomBytes(6).toString('hex'));
  const outP = path.join(tmp, 'out_' + crypto.randomBytes(6).toString('hex') + '.mp4');
  try {
    fs.writeFileSync(inP, buf);
    await runFfmpeg(inP, outP, onProgress);
    const out = fs.readFileSync(outP);
    return { buf: out, outMime: 'video/mp4', ext: '.mp4' };
  } catch (_) {
    return null;
  } finally {
    try { fs.unlinkSync(inP); } catch (_) {}
    try { fs.unlinkSync(outP); } catch (_) {}
  }
}

// ── PDF：pdf-lib 无损重存 ──
async function optimizePdf(buf, onProgress) {
  if (!PDFDocument) return null;
  try {
    if (onProgress) onProgress(null, 'PDF 优化中…', true);
    const doc = await PDFDocument.load(buf, { updateMetadata: false, ignoreEncryption: true });
    const out = await doc.save({ useObjectStreams: true });
    return Buffer.from(out);
  } catch (_) { return null; }
}

const gzip = (buf) => zlib.gzipSync(buf, { level: 9 });
const gunzip = (buf) => zlib.gunzipSync(buf);

/**
 * 处理上传字节，返回落盘信息。
 * @param {(percent:number|null, message:string, indeterminate?:boolean)=>void} [onProgress] 进度回调
 * @returns {{ buf:Buffer, outMime:string, ext:string, storageEnc:'raw'|'gzip', width:number|null, height:number|null, method:string }}
 */
async function processUpload(buffer, mime, originalName, onProgress) {
  const size0 = buffer.length;
  const ext0 = path.extname(originalName || '').toLowerCase();
  // 默认：原样存储
  let result = { buf: buffer, outMime: mime, ext: ext0, storageEnc: 'raw', width: null, height: null, method: 'none' };

  if (isImage(mime)) {
    const r = await optimizeImage(buffer, mime, onProgress);
    if (r && r.buf.length < size0) result = { ...r, storageEnc: 'raw', method: 'image' };
  } else if (isVideo(mime, originalName)) {
    const r = await optimizeVideo(buffer, onProgress);
    if (r && r.buf.length < size0) result = { buf: r.buf, outMime: r.outMime, ext: r.ext, storageEnc: 'raw', width: null, height: null, method: 'video' };
  } else if (isPdf(mime, originalName)) {
    let best = buffer;
    const opt = await optimizePdf(buffer, onProgress);
    if (opt && opt.length < best.length) best = opt;
    if (onProgress) onProgress(null, 'PDF 打包中…', true);
    const gz = gzip(best);
    if (gz.length < best.length) {
      result = { buf: gz, outMime: 'application/pdf', ext: '.pdf', storageEnc: 'gzip', width: null, height: null, method: 'pdf+gzip' };
    } else if (best.length < size0) {
      result = { buf: best, outMime: 'application/pdf', ext: '.pdf', storageEnc: 'raw', width: null, height: null, method: 'pdf' };
    }
  } else {
    // 其他任意格式：gzip 无损（仅当有意义收益时采用）
    if (onProgress) onProgress(null, '文档压缩中…', true);
    const gz = gzip(buffer);
    if (gz.length < size0 * 0.98) {
      result = { buf: gz, outMime: mime, ext: ext0, storageEnc: 'gzip', width: null, height: null, method: 'gzip' };
    }
  }
  return result;
}

module.exports = {
  processUpload, gunzip,
  ffmpegAvailable: !!ffmpegPath,
  pdfLibAvailable: !!PDFDocument,
};
