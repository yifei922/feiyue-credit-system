const express = require('express');
const router = express.Router();
const multer = require('multer');
const zlib = require('zlib');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { db } = require('../db');
const { ok, fail } = require('../util');
const { processUpload } = require('../lib/compressor');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'data', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// 内存模式：先收进 buffer，压缩后再落盘（避免先写大文件再压缩的浪费）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 300 * 1024 * 1024 } // 单文件 300MB 上限（视频类允许较大，转码后落盘更小）
});

// 上传（任意登录用户均可；学生提交作业时 student_id 取自登录身份）
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return fail(res, 400, '未收到文件');
    const taskId = req.body.taskId ? Number(req.body.taskId) : null;
    const studentId = req.user.studentId ?? null;
    const originalName = req.file.originalname || 'file';
    const sizeOriginal = req.file.size;

    const { buf, outMime, ext, storageEnc, width, height, method } =
      await processUpload(req.file.buffer, req.file.mimetype, originalName);

    const storedName = crypto.randomBytes(12).toString('hex') + ext;
    fs.writeFileSync(path.join(UPLOAD_DIR, storedName), buf);

    const info = db.prepare(`INSERT INTO attachment
      (completion_record_id, task_id, student_id, uploader_id, original_name, stored_name, mime, size_original, size_compressed, width, height, storage_enc)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(null, taskId, studentId, req.user.id, originalName, storedName, outMime, sizeOriginal, buf.length, width, height, storageEnc);

    ok(res, {
      id: info.lastInsertRowid,
      url: `/api/uploads/${storedName}`,
      originalName,
      mime: outMime,
      sizeOriginal,
      sizeCompressed: buf.length,     // 实际占用磁盘的字节
      width, height,
      method,                          // image / video / pdf / gzip / none
      compressed: buf.length < sizeOriginal,
      ratio: sizeOriginal ? Math.round((1 - buf.length / sizeOriginal) * 100) : 0
    });
  } catch (e) {
    if (e.code === 'LIMIT_FILE_SIZE') return fail(res, 413, '文件超过 300MB 上限');
    console.error('[upload] error', e);
    fail(res, 500, '上传失败：' + (e.message || ''));
  }
});

// 存储用量统计（管理端展示 + 回答“能存多大/多久”）
router.get('/stats/usage', (req, res) => {
  if (!['ADMIN', 'TEACHER', 'REP'].includes(req.user.role)) return fail(res, 403, '无权查看');
  const agg = db.prepare(`SELECT COUNT(*) AS files,
      COALESCE(SUM(size_compressed),0) AS used,
      COALESCE(SUM(size_original),0) AS original
    FROM attachment`).get();
  // 免费层临时磁盘约 1GB 可用（保守取 1GB 作为展示配额）
  const QUOTA = 1024 * 1024 * 1024;
  ok(res, {
    files: agg.files,
    usedBytes: agg.used,
    originalBytes: agg.original,
    savedBytes: Math.max(0, agg.original - agg.used),
    quotaBytes: QUOTA,
    ephemeral: true,          // 临时磁盘：重新部署 / 长时间休眠后会重置
    note: '免费层为临时磁盘，重新部署或实例重建后附件会被清空；如需长期保存请接入对象存储（R2/OSS）。'
  });
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
  const stream = fs.createReadStream(fp);
  stream.on('error', () => { if (!res.headersSent) fail(res, 500, '读取失败'); });
  // gzip 无损存储：下载时透明解压，还原为与上传完全一致的字节
  if (row.storage_enc === 'gzip') {
    const gunzip = zlib.createGunzip();
    gunzip.on('error', () => { if (!res.headersSent) res.status(500).end(); });
    stream.pipe(gunzip).pipe(res);
  } else {
    stream.pipe(res);
  }
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
