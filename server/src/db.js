// 持久层：MySQL（腾讯云数据库 TencentDB for MySQL / 本地 Docker MySQL 均可）
// 通过 mysql2/promise 连接池 + 兼容 shim，使上层代码只需在调用处加 await 即可从 node:sqlite 平滑迁移。
// 关键差异（已在 shim 内抹平）：
//   - node:sqlite 同步 API  -> 这里全部 Promise 化（db.prepare().get/run/all 返回 Promise）
//   - 上层只需 `await db.prepare(...).get(...)` 即可，返回结构与原先一致（row / {lastInsertRowid,changes} / rows[]）
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
const { hashPassword } = require('./auth');
const { calcCredit } = require('./services/credit');

const DB_NAME = process.env.DB_NAME || process.env.MYSQL_DATABASE || 'credit';

// ── 兼容云托管 MYSQL_* 命名 ──
// 云托管控制台默认用 MYSQL_ADDRESS / MYSQL_USERNAME / MYSQL_PASSWORD
// 本地/.env 用 DB_HOST / DB_USER / DB_PASSWORD
// 优先读 DB_*，fallback 到 MYSQL_*
function resolveDbConfig() {
  const host = process.env.DB_HOST || '';
  const port = process.env.DB_PORT || '';
  const user = process.env.DB_USER || '';
  const password = process.env.DB_PASSWORD || '';

  // 如果 DB_* 全没填，尝试从云托管的 MYSQL_* 解析
  if (!host && !user) {
    const addr = process.env.MYSQL_ADDRESS || ''; // 格式 "10.18.108.46:3306"
    const [mysqlHost, mysqlPort] = addr.split(':');
    return {
      host: mysqlHost || '127.0.0.1',
      port: Number(mysqlPort) || 3306,
      user: process.env.MYSQL_USERNAME || 'root',
      password: process.env.MYSQL_PASSWORD || '',
    };
  }
  return {
    host: host || '127.0.0.1',
    port: Number(port) || 3306,
    user: user || 'root',
    password: password || '',
  };
}

// ── 连接池（require 时同步创建，真正的查询才是异步）──
function buildPool() {
  const dbc = resolveDbConfig();
  const cfg = {
    host: dbc.host,
    port: dbc.port,
    user: dbc.user,
    password: dbc.password,
    database: DB_NAME,
    charset: 'utf8mb4',
    dateStrings: true, // 日期以 'YYYY-MM-DD HH:MM:SS' 字符串返回，与 node:sqlite 的 TEXT 行为一致
    connectionLimit: Number(process.env.DB_POOL_SIZE) || 10,
    waitForConnections: true,
    enableKeepAlive: true,
    connectTimeout: 15000,
  };
  if (process.env.DB_SSL === '1') {
    cfg.ssl = { rejectUnauthorized: process.env.DB_SSL_VERIFY !== '0' };
  }
  return mysql.createPool(cfg);
}

const pool = buildPool();

// ── 兼容 shim：node:sqlite 风格 API（全部异步）──
//   db.prepare(sql) 返回语句对象 { get/run/all }，每个方法接收参数并返回 Promise。
//   run() 的返回值抹平为 { lastInsertRowid, changes }，与原 node:sqlite 一致。
const db = {
  // prepare(sql, conn?) — 第二个参数为某事务内的连接，让 run/get/all 走该连接以共享事务
  prepare(sql, conn) {
    const exec = conn ? conn.query.bind(conn) : pool.query.bind(pool);
    return {
      async get(...params) {
        const [rows] = await exec(sql, params);
        return rows[0];
      },
      async run(...params) {
        const [result] = await exec(sql, params);
        return { lastInsertRowid: result.insertId, changes: result.affectedRows };
      },
      async all(...params) {
        const [rows] = await exec(sql, params);
        return rows;
      },
    };
  },
  // 兼容：支持多条语句（以 ; 分隔）。逐条执行，避免依赖 multipleStatements。
  // 单条 DDL（CREATE/ALTER）失败仅 warn 不中断，确保后续表仍能创建（云托管兼容）
  async exec(sql) {
    const stmts = String(sql)
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s); // 注释与空语句已在 mysql 层被忽略，这里仅去空
    for (const stmt of stmts) {
      if (!stmt) continue;
      try {
        await pool.query(stmt);
      } catch (e) {
        // DDL 幂等语句（IF NOT EXISTS / IF NOT EXISTS / ADD COLUMN IF NOT）在并发或部分执行场景可能报错
        // 仅记录警告，不中断后续建表流程
        console.warn('[db.exec] 语句执行警告（已跳过）:', e.message.slice(0, 200));
        console.warn('[db.exec] 对应 SQL:', stmt.slice(0, 150));
      }
    }
  },
  async query(sql, params) {
    const [rows] = await pool.query(sql, params || []);
    return rows;
  },
  // ── 事务包装：与 node:sqlite 的 db.transaction(fn) 同语义，回调里可用 await ──
  // 失败自动 ROLLBACK，成功 COMMIT。回调抛错即视为整体失败。
  async transaction(fn) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      try {
        const result = await fn(conn);
        await conn.commit();
        return result;
      } catch (innerErr) {
        try { await conn.rollback(); } catch (_) { /* rollback 失败不掩盖原错 */ }
        throw innerErr;
      }
    } finally {
      conn.release();
    }
  },
  async close() {
    await pool.end();
  },
};

// ── MySQL 表结构（与原 sqlite schema 字段一一对应）──
// 约定：
//   - 自增主键用 INT PRIMARY KEY AUTO_INCREMENT
//   - 时间戳列用 DATETIME DEFAULT CURRENT_TIMESTAMP（配合 dateStrings:true 以字符串返回）
//   - deadline / completion_time / day 等需保留原始文案或参与字符串比较的列用 VARCHAR
//   - 索引全部内联到建表语句，避免 CREATE INDEX IF NOT EXISTS（MySQL 老版本不支持）
const SCHEMA = `
CREATE TABLE IF NOT EXISTS clazz (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  create_time DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS subject (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  class_id INT,
  teacher_id INT,
  create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_subject_class (class_id),
  KEY idx_subject_teacher (teacher_id)
);
CREATE TABLE IF NOT EXISTS sys_user (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(64) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  role VARCHAR(32) NOT NULL,
  class_id INT,
  student_id INT,
  openid VARCHAR(64) UNIQUE,
  avatar VARCHAR(512),
  must_change_pwd TINYINT DEFAULT 1 COMMENT '首次登录强制改密：1=需要，0=不需要',
  create_time DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS subject_rep (
  subject_id INT,
  user_id INT,
  PRIMARY KEY (subject_id, user_id)
);
CREATE TABLE IF NOT EXISTS student (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT,
  name VARCHAR(255) NOT NULL,
  student_no VARCHAR(64),
  class_id INT,
  total_credits INT DEFAULT 0,
  create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_student_class (class_id)
);
CREATE TABLE IF NOT EXISTS task (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(512) NOT NULL,
  subject_id INT,
  class_id INT,
  credit_value INT DEFAULT 0,
  type VARCHAR(32) DEFAULT 'HOMEWORK',
  status VARCHAR(32) DEFAULT 'OPEN',
  deadline VARCHAR(32),
  description TEXT,
  creator_id INT,
  create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_task_subject (subject_id),
  KEY idx_task_class (class_id)
);
CREATE TABLE IF NOT EXISTS completion_record (
  id INT PRIMARY KEY AUTO_INCREMENT,
  task_id INT,
  student_id INT,
  status VARCHAR(32),
  completion_time DATETIME DEFAULT NULL,
  credit_earned INT DEFAULT 0,
  operator_id INT,
  create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_completion_task (task_id),
  KEY idx_completion_student (student_id)
);
CREATE TABLE IF NOT EXISTS credit_flow (
  id INT PRIMARY KEY AUTO_INCREMENT,
  student_id INT,
  task_id INT,
  change_amount INT DEFAULT 0,
  flow_type VARCHAR(32),
  reason TEXT,
  create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_creditflow_student (student_id)
);
CREATE TABLE IF NOT EXISTS alert (
  id INT PRIMARY KEY AUTO_INCREMENT,
  student_id INT,
  type VARCHAR(32),
  level VARCHAR(32),
  message TEXT,
  status VARCHAR(32) DEFAULT 'PENDING',
  create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_alert_student (student_id)
);
CREATE TABLE IF NOT EXISTS operate_log (
  id INT PRIMARY KEY AUTO_INCREMENT,
  operator_id INT,
  operator_name VARCHAR(255),
  operate_type VARCHAR(32),
  table_name VARCHAR(64),
  record_id INT,
  before_snapshot TEXT,
  after_snapshot TEXT,
  create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_operatelog_operator (operator_id)
);

-- ── 微信小程序专用表（社交 + 兴趣资料 + 积分 + 广告）──
CREATE TABLE IF NOT EXISTS post (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  text TEXT,
  images TEXT,
  video_url TEXT,
  resource_id INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_post_created (created_at),
  KEY idx_post_user (user_id, created_at)
);
CREATE TABLE IF NOT EXISTS post_like (
  post_id INT NOT NULL,
  user_id INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id, user_id)
);
CREATE TABLE IF NOT EXISTS post_comment (
  id INT PRIMARY KEY AUTO_INCREMENT,
  post_id INT NOT NULL,
  user_id INT NOT NULL,
  text TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_comment_post (post_id, created_at)
);
CREATE TABLE IF NOT EXISTS resource (
  id INT PRIMARY KEY AUTO_INCREMENT,
  grade VARCHAR(32) NOT NULL,
  subject VARCHAR(64) NOT NULL,
  title VARCHAR(512) NOT NULL,
  cover TEXT,
  type VARCHAR(32) NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  source TEXT,
  tags TEXT,
  content TEXT,
  sort_order INT DEFAULT 0,
  view_count INT DEFAULT 0,
  unlock_count INT DEFAULT 0,
  created_by INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_resource_gs (grade, subject, sort_order)
);
CREATE TABLE IF NOT EXISTS user_points (
  user_id INT PRIMARY KEY,
  points INT DEFAULT 0,
  total_earned INT DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS user_daily_view (
  user_id INT NOT NULL,
  day VARCHAR(20) NOT NULL,
  view_count INT DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
CREATE TABLE IF NOT EXISTS ad_view_log (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  resource_id INT NOT NULL,
  day VARCHAR(20) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_adview_user_day (user_id, day)
);
CREATE TABLE IF NOT EXISTS task_template (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255),
  subject_id INT,
  type VARCHAR(32) DEFAULT 'HOMEWORK',
  credit_value INT DEFAULT 0,
  description TEXT,
  KEY idx_tpl_subject (subject_id)
);
CREATE TABLE IF NOT EXISTS attachment (
  id INT PRIMARY KEY AUTO_INCREMENT,
  completion_record_id INT,
  task_id INT,
  student_id INT,
  uploader_id INT,
  original_name VARCHAR(512),
  stored_name VARCHAR(512) NOT NULL,
  mime VARCHAR(128),
  size_original INT,
  size_compressed INT,
  width INT,
  height INT,
  storage_enc VARCHAR(16) DEFAULT 'raw',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_attachment_task_stu (task_id, student_id)
);
`;

async function seed() {
  const cntRow = await db.prepare('SELECT COUNT(*) AS c FROM sys_user').get();
  if (cntRow.c > 0) return;

  const CLASS_ID = 1;
  await db.prepare('INSERT INTO clazz(name) VALUES(?)').run('默认圈子');

  // 兴趣分类（合规整改：个人主体小程序禁止 K12 学科类培训，初始兴趣分类改为通用兴趣分类）
  const insSubj = db.prepare('INSERT INTO subject(name, class_id, teacher_id) VALUES(?,?,?)');
  await insSubj.run('阅读', CLASS_ID, 2);
  await insSubj.run('写作', CLASS_ID, 2);
  await insSubj.run('思维', CLASS_ID, 2);

  // 用户：管理员(ADMIN) / 主理人(TEACHER) / 小组长(REP x2) / 成员(STUDENT)
  const insUser = db.prepare(
    'INSERT INTO sys_user(username, password, name, role, class_id, student_id) VALUES(?,?,?,?,?,?)'
  );
  await insUser.run('admin', hashPassword('123456'), '管理员', 'ADMIN', CLASS_ID, null);
  await insUser.run('teacher01', hashPassword('123456'), '主理人', 'TEACHER', CLASS_ID, null);
  await insUser.run('rep01', hashPassword('123456'), '李小组长(阅读)', 'REP', CLASS_ID, null);
  await insUser.run('rep02', hashPassword('123456'), '张小组长(写作)', 'REP', CLASS_ID, null);

  // 显式取 id
  const getUid = async (u) => (await db.prepare('SELECT id FROM sys_user WHERE username=?').get(u)).id;
  const adminId = await getUid('admin');
  const teacherId = await getUid('teacher01');
  const r1 = await getUid('rep01');
  const r2 = await getUid('rep02');

  // 成员档案 + 账号
  const studentsSeed = [
    ['张三', 'S1001'], ['李四', 'S1002'], ['王五', 'S1003'],
    ['赵六', 'S1004'], ['钱七', 'S1005'], ['孙八', 'S1006']
  ];
  const insStu = db.prepare('INSERT INTO student(name, student_no, class_id) VALUES(?,?,?)');
  const insStuUser = db.prepare(
    'INSERT INTO sys_user(username, password, name, role, class_id, student_id) VALUES(?,?,?,?,?,?)'
  );
  for (let i = 0; i < studentsSeed.length; i++) {
    const [name, no] = studentsSeed[i];
    const r = await insStu.run(name, no, CLASS_ID);
    const studentId = r.lastInsertRowid;
    const username = 'student' + String(i + 1).padStart(2, '0');
    await insStuUser.run(username, hashPassword('123456'), name, 'STUDENT', CLASS_ID, studentId);
  }

  // 小组长兴趣分类关联
  await db.prepare('INSERT IGNORE INTO subject_rep(subject_id, user_id) VALUES(?,?)').run(1, r1);
  await db.prepare('INSERT IGNORE INTO subject_rep(subject_id, user_id) VALUES(?,?)').run(2, r2);

  // 示例任务（合规整改：内容改为通识/兴趣类，与前端契约一致）
  const insTask = db.prepare(
    'INSERT INTO task(title, subject_id, class_id, credit_value, type, status, deadline, description, creator_id) VALUES(?,?,?,?,?,?,?,?,?)'
  );
  await insTask.run('一周阅读笔记打卡', 1, CLASS_ID, 3, 'BACKING', 'OPEN', '2026-07-26 23:59', '选一本感兴趣的书，每天记录一段感想', r1);
  await insTask.run('结构化写作练习', 2, CLASS_ID, 5, 'HOMEWORK', 'OPEN', '2026-07-22 23:59', '用 PREP 模板写一段 200 字自我介绍', r2);
  await insTask.run('逻辑思维打卡', 3, CLASS_ID, 8, 'EXAM', 'OPEN', '2026-07-20 23:59', '完成 10 道推理选择题', teacherId);
  await insTask.run('一周错题回顾', 2, CLASS_ID, 4, 'HOMEWORK', 'OPEN', '2026-07-30 23:59', '整理本周错题并写心得', r2);

  // 完成记录 + 流水（与前端 Mock 数据一致，便于对照）
  const taskMeta = {
    1: { credit: 3, type: 'BACKING', title: '一周阅读笔记打卡' },
    2: { credit: 5, type: 'HOMEWORK', title: '结构化写作练习' },
    3: { credit: 8, type: 'EXAM', title: '逻辑思维打卡' },
    4: { credit: 4, type: 'HOMEWORK', title: '一周错题回顾' }
  };
  const seedComp = [
    [1, 1, 'DONE_ONTIME'], [1, 2, 'UNFINISHED'], [1, 3, 'DONE_OVERDUE'], [1, 4, 'UNFINISHED'], [1, 5, 'DONE_ONTIME'],
    [2, 1, 'DONE_ONTIME'], [2, 2, 'DONE_ONTIME'], [2, 3, 'DONE_ONTIME'], [2, 4, 'UNFINISHED'], [2, 5, 'DONE_OVERDUE'],
    [3, 1, 'UNFINISHED'], [3, 2, 'UNFINISHED'], [3, 3, 'UNFINISHED'], [3, 4, 'FAILED'], [3, 5, 'UNFINISHED'],
    [4, 1, 'DONE_ONTIME'], [4, 2, 'UNFINISHED'], [4, 3, 'DONE_ONTIME'], [4, 4, 'UNFINISHED'], [4, 5, 'UNFINISHED']
  ];
  const insComp = db.prepare(
    'INSERT INTO completion_record(task_id, student_id, status, completion_time, credit_earned, operator_id) VALUES(?,?,?,?,?,?)'
  );
  const insFlow = db.prepare(
    'INSERT INTO credit_flow(student_id, task_id, change_amount, flow_type, reason) VALUES(?,?,?,?,?)'
  );
  for (const [taskId, studentId, status] of seedComp) {
    const meta = taskMeta[taskId];
    const { credit, flowType } = calcCredit(meta.credit, meta.type, status);
    const ctime = (status === 'UNFINISHED' || status === 'FAILED') ? null : '2026-07-19 10:00';
    await insComp.run(taskId, studentId, status, ctime, credit, teacherId);
    if (credit > 0) {
      await insFlow.run(studentId, taskId, credit, flowType, meta.title);
    }
  }
  // 重算各成员总积分（MySQL 不允许在 UPDATE 子查询中引用同一张表，改为按成员汇总后逐条更新）
  const sums = await db.prepare('SELECT student_id, COALESCE(SUM(change_amount),0) AS s FROM credit_flow GROUP BY student_id').all();
  const updStuCredit = db.prepare('UPDATE student SET total_credits=? WHERE id=?');
  for (const { student_id, s } of sums) {
    await updStuCredit.run(s, student_id);
  }

  // 预警（文案同步改为中性）
  await db.prepare("INSERT INTO alert(student_id, type, level, message) VALUES(?,?,?,?)").run(4, 'CONSECUTIVE_MISS', 'DANGER', '连续 3 个任务未完成（错题回顾/逻辑打卡/写作练习）');
  await db.prepare("INSERT INTO alert(student_id, type, level, message) VALUES(?,?,?,?)").run(2, 'OVERDUE_SOON', 'WARN', '《逻辑思维打卡》将于 2026-07-20 截止且尚未完成');

  // 操作日志
  await db.prepare("INSERT INTO operate_log(operator_id, operator_name, operate_type, table_name, record_id, before_snapshot, after_snapshot) VALUES(?,?,?,?,?,?,?)")
    .run(teacherId, '主理人', 'INSERT', 'task', 3, null, '{"title":"逻辑思维打卡","credit_value":8}');
  await db.prepare("INSERT INTO operate_log(operator_id, operator_name, operate_type, table_name, record_id, before_snapshot, after_snapshot) VALUES(?,?,?,?,?,?,?)")
    .run(r1, '李小组长(阅读)', 'UPDATE', 'completion_record', 1, '{"status":"UNFINISHED","credit_change":0}', '{"status":"DONE_ONTIME","credit_change":3}');

  // 任务模板
  await db.prepare('INSERT INTO task_template(name, subject_id, type, credit_value, description) VALUES(?,?,?,?,?)')
    .run('一周阅读笔记·模板', 1, 'BACKING', 3, '选一本感兴趣的书，每天记录一段感想');
  await db.prepare('INSERT INTO task_template(name, subject_id, type, credit_value, description) VALUES(?,?,?,?,?)')
    .run('结构化写作练习·模板', 2, 'HOMEWORK', 5, '用 PREP 模板写一段 200 字自我介绍');

  console.log('[seed] 初始数据已写入（通用兴趣类）');
}

// ── 幂等迁移：每次启动都执行，用于给「已存在的库」补齐新功能所需的数据 ──
async function migrate() {
  const CLASS_ID = 1;

  // 确保存在圈子（极端情况下空库场景）
  const hasClass = await db.prepare('SELECT id FROM clazz WHERE id=?').get(CLASS_ID);
  if (!hasClass) {
    await db.prepare('INSERT INTO clazz(id, name) VALUES(?,?)').run(CLASS_ID, '默认圈子');
  }

  // 1) 超级管理员（单独给管理者本人的最高权限账号）
  const SUPER_USER = 'superadmin';
  const existSuper = await db.prepare('SELECT id FROM sys_user WHERE username=?').get(SUPER_USER);
  if (!existSuper) {
    await db.prepare('INSERT INTO sys_user(username, password, name, role, class_id, student_id) VALUES(?,?,?,?,?,?)')
      .run(SUPER_USER, hashPassword('Feiyue@2026'), '超级管理员', 'ADMIN', CLASS_ID, null);
    // 仅在 DEBUG 模式下打印账号创建事件，避免生产环境日志泄露账号名
    if (process.env.DEBUG_MIGRATE === '1') console.log('[migrate] 超级管理员账号已创建: superadmin / (密码已设置，请及时修改)');
  }

  // 2) 兴趣分类兴趣分类补齐（合规整改：个人主体小程序禁止 K12 学科类培训，改通用兴趣标签）
  const FULL_SUBJECTS = [
    '阅读', '写作', '思维', '编程', '艺术', '手工',
    '科普', '语言', '历史人文', '运动健康', '其他'
  ];
  const teacherRow = await db.prepare("SELECT id FROM sys_user WHERE role='TEACHER' ORDER BY id LIMIT 1").get();
  const teacherId = teacherRow ? teacherRow.id : null;
  const insSubj = db.prepare('INSERT INTO subject(name, class_id, teacher_id) VALUES(?,?,?)');
  for (const name of FULL_SUBJECTS) {
    const exist = await db.prepare('SELECT id FROM subject WHERE name=? AND class_id=?').get(name, CLASS_ID);
    if (!exist) await insSubj.run(name, CLASS_ID, teacherId);
  }

  // 3) 成员账号用户名规范化：stu01 -> student01（修复 student01 登录失败问题）
  const stuUsers = await db.prepare("SELECT id, username FROM sys_user WHERE role='STUDENT' AND username LIKE 'stu_%' AND username NOT LIKE 'student%'").all();
  const updStu = db.prepare('UPDATE sys_user SET username=? WHERE id=?');
  const chkStu = db.prepare('SELECT id FROM sys_user WHERE username=?');
  for (const u of stuUsers) {
    const newName = 'student' + u.username.slice(3); // 'stu01' -> 'student01'
    if (!(await chkStu.get(newName))) await updStu.run(newName, u.id);
  }

  // 4) 历史种子账号名称脱敏：曾用教学类称谓的账号统一更名为主理人（幂等，重启只跑一次）
  await db.prepare("UPDATE sys_user SET name='主理人' WHERE name LIKE '%老师'").run();
  await db.prepare("UPDATE operate_log SET operator_name='主理人' WHERE operator_name LIKE '%老师'").run();

  // 5) 附件存储编码列（raw/gzip）：用于视频/PDF/文档的无损存储压缩，下载时按此透明解压
  const [attCols] = await pool.query(
    "SELECT COLUMN_NAME AS name FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='attachment'",
    [DB_NAME]
  );
  if (!attCols.some((c) => c.name === 'storage_enc')) {
    await db.prepare("ALTER TABLE attachment ADD COLUMN storage_enc VARCHAR(16) DEFAULT 'raw'").run();
  }

  // 6) 微信小程序登录字段
  const [userCols] = await pool.query(
    "SELECT COLUMN_NAME AS name FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='sys_user'",
    [DB_NAME]
  );
  if (!userCols.some((c) => c.name === 'openid')) {
    await db.prepare("ALTER TABLE sys_user ADD COLUMN openid VARCHAR(64) UNIQUE").run();
  }
  if (!userCols.some((c) => c.name === 'avatar')) {
    await db.prepare("ALTER TABLE sys_user ADD COLUMN avatar VARCHAR(512)").run();
  }
  // 9.1) 首次登录强制改密标记列
  if (!userCols.some((c) => c.name === 'must_change_pwd')) {
    await db.prepare("ALTER TABLE sys_user ADD COLUMN must_change_pwd TINYINT DEFAULT 1").run();
  }
  // 超级管理员使用强密码，无需强制改密；其余默认账号(123456)首次登录必须改密
  await db.prepare("UPDATE sys_user SET must_change_pwd=0 WHERE username='superadmin'").run();

  // 7) 初始积分赠送：给所有尚无 user_points 的用户赠送 INIT_POINTS（前期活动，默认 100）
  const INIT_POINTS = Number(process.env.INIT_POINTS) || 100;
  const noPoints = await db.prepare('SELECT id FROM sys_user WHERE id NOT IN (SELECT user_id FROM user_points)').all();
  if (noPoints.length) {
    const insPts = db.prepare('INSERT INTO user_points(user_id, points, total_earned) VALUES(?,?,?)');
    for (const u of noPoints) {
      await insPts.run(u.id, INIT_POINTS, INIT_POINTS);
    }
    console.log(`[migrate] 已为 ${noPoints.length} 位用户初始化赠送 ${INIT_POINTS} 积分`);
  }

  // 8) resource 表 content 字段（存储结构化内容 JSON，供小程序内联展示）
  const [resCols] = await pool.query(
    "SELECT COLUMN_NAME AS name FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='resource'",
    [DB_NAME]
  );
  if (!resCols.some((c) => c.name === 'content')) {
    await db.prepare("ALTER TABLE resource ADD COLUMN content TEXT").run();
  }

  // 9) 兴趣资料自动播种：仅当 resource 表为空时填充示例资料（与数据库 id 解耦，刷新/新环境均可复现）
  await require('./seed_resources').writeAll(db);

  // 10) 合规整改：把历史遗留的 K12 学科/难度字段重命名为中性兴趣标签（幂等，重启只跑一次）
  //     个人主体小程序禁止 K12 学科类校外培训；旧数据若被审核员看到会被驳回。
  await normalizeK12ToNeutral();
}

/**
 * 把现有 DB 中的 K12 学科/难度字段一次性重命名为通用兴趣标签。
 * - 仅在首次运行时迁移（通过 _k12_migrated 标记；如不存在则创建）
 * - 幂等：多次调用结果一致；不会破坏非 K12 的现有数据
 */
async function normalizeK12ToNeutral() {
  // 检查迁移标记表
  await db.exec(`CREATE TABLE IF NOT EXISTS _schema_migration (
    id VARCHAR(64) PRIMARY KEY,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).catch(() => {}); // 兼容 SQLite 旧库

  const applied = await db.prepare("SELECT id FROM _schema_migration WHERE id='k12_to_neutral_v1'").get();
  if (applied) return;

  const K12_TO_NEUTRAL = {
    '语文': '阅读', '数学': '思维', '英语': '语言',
    '物理': '科普', '化学': '手工', '生物': '科普',
    '道德与法治': '阅读', '政治': '阅读',
    '历史': '历史人文', '地理': '科普',
    '体育与健康': '运动健康', '体育': '运动健康',
    '音乐': '艺术', '美术': '艺术',
    '信息科技': '编程', '信息技术': '编程',
  };
  const GRADE_TO_LEVEL = { '初一': '入门', '初二': '进阶', '初三': '挑战', '初四': '挑战' };

  let changed = 0;
  const updSubj = db.prepare('UPDATE subject SET name=? WHERE name=?');
  for (const [from, to] of Object.entries(K12_TO_NEUTRAL)) {
    const r = await updSubj.run(to, from);
    if (r.changes) changed += r.changes;
  }

  const updRes = db.prepare('UPDATE resource SET subject=? WHERE subject=?');
  const updResG = db.prepare('UPDATE resource SET grade=? WHERE grade=?');
  for (const [from, to] of Object.entries(K12_TO_NEUTRAL)) {
    const r = await updRes.run(to, from);
    if (r.changes) changed += r.changes;
  }
  for (const [from, to] of Object.entries(GRADE_TO_LEVEL)) {
    const r = await updResG.run(to, from);
    if (r.changes) changed += r.changes;
  }

  // 小组长姓名带"(语文)/(数学)"也顺手清理
  const updUser = db.prepare('UPDATE sys_user SET name=? WHERE name=?');
  for (const [from, to] of Object.entries(K12_TO_NEUTRAL)) {
    // 仅清理 "(K12)" 后缀，避免误伤其他数据
    await updUser.run(`李小组长(阅读)`, '李小组长(语文)');
    await updUser.run(`张小组长(思维)`, '张小组长(数学)');
    await updUser.run(`王小组长(语言)`, '王小组长(英语)');
  }
  const updLog = db.prepare('UPDATE operate_log SET operator_name=REPLACE(operator_name, ?, ?, ?)');
  // 简化：用直接 replace 处理
  await db.prepare("UPDATE operate_log SET operator_name='李小组长(阅读)' WHERE operator_name LIKE '%李小组长(语文)%'").run();
  await db.prepare("UPDATE operate_log SET operator_name='张小组长(思维)' WHERE operator_name LIKE '%张小组长(数学)%'").run();
  await db.prepare("UPDATE operate_log SET operator_name='王小组长(语言)' WHERE operator_name LIKE '%王小组长(英语)%'").run();
  await db.prepare("UPDATE alert SET message=REPLACE(message,'语文','阅读') WHERE message LIKE '%语文%'").run();
  await db.prepare("UPDATE alert SET message=REPLACE(message,'数学','思维') WHERE message LIKE '%数学%'").run();
  await db.prepare("UPDATE alert SET message=REPLACE(message,'英语','语言') WHERE message LIKE '%英语%'").run();
  await db.prepare("UPDATE alert SET message=REPLACE(message,'物理','科普') WHERE message LIKE '%物理%'").run();
  await db.prepare("UPDATE alert SET message=REPLACE(message,'化学','手工') WHERE message LIKE '%化学%'").run();
  await db.prepare("UPDATE alert SET message=REPLACE(message,'历史','历史人文') WHERE message LIKE '%历史%'").run();

  await db.prepare("INSERT INTO _schema_migration(id) VALUES('k12_to_neutral_v1')").run();
  if (changed) console.log(`[migrate] K12→中性数据迁移完成，影响 ${changed} 条记录`);
}

// ── 自动建库：云托管/新环境首次启动时，若目标库不存在则自动创建 ──
// 避免 "Unknown database 'credit'" 导致启动直接崩溃（无需手动建库）。
async function ensureDatabase() {
  const dbc = resolveDbConfig();
  if (!/^[A-Za-z0-9_]+$/.test(DB_NAME)) {
    throw new Error(`非法数据库名: ${DB_NAME}`);
  }
  // 不带 database 的连接，仅用于执行 CREATE DATABASE
  const conn = await mysql.createConnection({
    host: dbc.host,
    port: dbc.port,
    user: dbc.user,
    password: dbc.password,
    charset: 'utf8mb4',
    connectTimeout: 15000,
  });
  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`
    );
    console.log(`[db] 数据库 '${DB_NAME}' 已就绪（不存在则已自动创建）`);
  } finally {
    await conn.end();
  }
}

// ── 启动初始化：建表 + 种子 + 迁移（由 index.js 在 app.listen 之前 await 调用）──
async function init() {
  await ensureDatabase();      // 先确保库存在（不存在则自动创建）
  await db.query('SELECT 1'); // 探活：确保数据库可达
  await db.exec(SCHEMA);      // 建表（幂等）
  await seed();
  await migrate();
  console.log('[db] MySQL 初始化完成（schema + seed + migrate）');
}

module.exports = { db, init, pool, resolveDbConfig };
