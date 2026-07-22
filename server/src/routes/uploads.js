const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { db } = require('../db');
const { ok, fail } = require('../util');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'data', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// 内存模式：先收进 buffer，压缩后再落盘（避免先写大文件再压缩的浪费）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 80 * 1024 * 1024 } // 单文件 80MB 上限（视频/文档类允许较大）
});

const MAX_SIDE = 1600;   // 图片最长边上限
const JPEG_Q = 82;       // JPEG 质量
const WEBP_Q = 80;       // WebP 质量

// 图片自动压缩：缩放 + 重编码；非图片原样保留
async function optimize(buf, mime, originalName) {
  const ext0 = path.extname(originalName || '').toLowerCase();
  if (!/^image\//.test(mime) || mime === 'image/svg+xml' || mime === 'image/gif') {
    return { buf, outMime: mime, width: null, height: null, ext: ext0 };
  }
  try {
    const img = sharp(buf, { failOn: 'none' });
    const meta = await img.metadata();
    if (meta.width && meta.height) {
      const long = Math.max(meta.width, meta.height);
      if (long > MAX_SIDE) {
        if (meta.width >= meta.height) img.resize({ width: MAX_SIDE });
        else img.resize({ height: MAX_SIDE });
      }
    }
    let outMime = mime, ext = ext0;
    if (meta.hasAlpha) { img.webp({ quality: WEBP_Q }); outMime = 'image/webp'; ext = '.webp'; }
    else { img.jpeg({ quality: JPEG_Q, mozjpeg: true }); outMime = 'image/jpeg'; ext = '.jpg'; }
    const out = await img.toBuffer();
    const m2 = await sharp(out).metadata();
    return { buf: out, outMime, width: m2.width, height: m2.height, ext };
  } catch (e) {
    // 压缩失败则保留原图，不影响上传
    return { buf, outMime: mime, width: null, height: null, ext: ext0 };
  }
}

// 上传（任意登录用户均可；学生提交作业时 student_id 取自登录身份）
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return fail(res, 400, '未收到文件');
    const taskId = req.body.taskId ? Number(req.body.taskId) : null;
    const studentId = req.user.studentId ?? null;
    const originalName = req.file.originalname || 'file';
    const sizeOriginal = req.file.size;

    const { buf, outMime, width, height, ext } = await optimize(req.file.buffer, req.file.mimetype, originalName);
    const storedName = crypto.randomBytes(12).toString('hex') + ext;
    fs.writeFileSync(path.join(UPLOAD_DIR, storedName), buf);

    const info = db.prepare(`INSERT INTO attachment
      (completion_record_id, task_id, student_id, uploader_id, original_name, stored_name, mime, size_original, size_compressed, width, height)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .run(null, taskId, studentId, req.user.id, originalName, storedName, outMime, sizeOriginal, buf.length, width, height);

    ok(res, {
      id: info.lastInsertRowid,
      url: `/api/uploads/${storedName}`,
      originalName,
      mime: outMime,
      sizeOriginal,
      sizeCompressed: buf.length,
      width, height,
      compressed: buf.length < sizeOriginal
    });
  } catch (e) {
    if (e.code === 'LIMIT_FILE_SIZE') return fail(res, 413, '文件超过 80MB 上限');
    console.error('[upload] error', e);
    fail(res, 500, '上传失败：' + (e.message || ''));
  }
});

// 查看/下载（鉴权；学生仅能访问自己的附件）
router.get('/:storedName', (req, res) => {
  const name = req.params.storedName;
  if (/[\/\\]/.test(name) || name.includes('..')) return fail(res, 400, '非法文件名');
  const row = db.prepare('SELECT * FROM attachment WHERE stored_name=?').get(name);
  if (!row) return fail(res, 404, '文件不存在');
  if (req.user.role === 'STUDENT' && row.student_id !== req.user.studentId) {
    return fail(res, 403, '无权访问该附件');
  }
  const fp = path.join(UPLOAD_DIR, name);
  if (!fs.existsSync(fp)) return fail(res, 404, '文件已丢失');
  res.setHeader('Content-Type', row.mime || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(row.original_name || 'file')}"`);
  fs.createReadStream(fp).pipe(res);
});

// 删除（上传者本人或管理员）
router.delete('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM attachment WHERE id=?').get(Number(req.params.id));
  if (!row) return fail(res, 404, '附件不存在');
  if (req.user.role !== 'ADMIN' && row.uploader_id !== req.user.id) {
    return fail(res, 403, '无权删除该附件');
  }
  try { fs.unlinkSync(path.join(UPLOAD_DIR, row.stored_name)); } catch (_) {}
  db.prepare('DELETE FROM attachment WHERE id=?').run(row.id);
  ok(res, { ok: true });
});

module.exports = router;
