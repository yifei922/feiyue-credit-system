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
  prepare(sql) {
    return {
      async get(...params) {
        const [rows] = await pool.query(sql, params);
        return rows[0];
      },
      async run(...params) {
        const [result] = await pool.query(sql, params);
        return { lastInsertRowid: result.insertId, changes: result.affectedRows };
      },
      async all(...params) {
        const [rows] = await pool.query(sql, params);
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

-- ── 微信小程序专用表（社交 + 课程资料 + 积分 + 广告）──
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
  await db.prepare('INSERT INTO clazz(name) VALUES(?)').run('默认班级');

  // 科目（teacher_id 指向默认教师）
  const insSubj = db.prepare('INSERT INTO subject(name, class_id, teacher_id) VALUES(?,?,?)');
  await insSubj.run('语文', CLASS_ID, 2);
  await insSubj.run('数学', CLASS_ID, 2);
  await insSubj.run('英语', CLASS_ID, 2);

  // 用户：管理员(ADMIN) / 老师(TEACHER) / 课代表(REP x2) / 学生(STUDENT)
  const insUser = db.prepare(
    'INSERT INTO sys_user(username, password, name, role, class_id, student_id) VALUES(?,?,?,?,?,?)'
  );
  await insUser.run('admin', hashPassword('123456'), '管理员', 'ADMIN', CLASS_ID, null);
  await insUser.run('teacher01', hashPassword('123456'), '杨老师', 'TEACHER', CLASS_ID, null);
  await insUser.run('rep01', hashPassword('123456'), '李课代(语文)', 'REP', CLASS_ID, null);
  await insUser.run('rep02', hashPassword('123456'), '张课代(数学)', 'REP', CLASS_ID, null);

  // 显式取 id
  const getUid = async (u) => (await db.prepare('SELECT id FROM sys_user WHERE username=?').get(u)).id;
  const adminId = await getUid('admin');
  const teacherId = await getUid('teacher01');
  const r1 = await getUid('rep01');
  const r2 = await getUid('rep02');

  // 学生档案 + 账号
  const studentsSeed = [
    ['张三', 'S1001'], ['李四', 'S1002'], ['王五', 'S1003'],
    ['赵六', 'S1004'], ['钱七', 'S1005'], ['孙八', 'DuplicatesGuard']
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

  // 课代表科目关联
  await db.prepare('INSERT IGNORE INTO subject_rep(subject_id, user_id) VALUES(?,?)').run(1, r1);
  await db.prepare('INSERT IGNORE INTO subject_rep(subject_id, user_id) VALUES(?,?)').run(2, r2);

  // 示例任务（type/deadline 与前端契约一致）
  const insTask = db.prepare(
    'INSERT INTO task(title, subject_id, class_id, credit_value, type, status, deadline, description, creator_id) VALUES(?,?,?,?,?,?,?,?,?)'
  );
  await insTask.run('《赤壁赋》背诵', 1, CLASS_ID, 3, 'BACKING', 'OPEN', '2026-07-26 23:59', '默写并背诵全文', r1);
  await insTask.run('第三章习题', 2, CLASS_ID, 5, 'HOMEWORK', 'OPEN', '2026-07-22 23:59', '完成课后习题 1-10', r2);
  await insTask.run('单元测试卷', 1, CLASS_ID, 8, 'EXAM', 'OPEN', '2026-07-20 23:59', '语文综合测验', teacherId);
  await insTask.run('错题整理', 2, CLASS_ID, 4, 'HOMEWORK', 'OPEN', '2026-07-30 23:59', '整理本周错题', r2);

  // 完成记录 + 流水（与前端 Mock 数据一致，便于对照）
  const taskMeta = {
    1: { credit: 3, type: 'BACKING', title: '《赤壁赋》背诵' },
    2: { credit: 5, type: 'HOMEWORK', title: '第三章习题' },
    3: { credit: 8, type: 'EXAM', title: '单元测试卷' },
    4: { credit: 4, type: 'HOMEWORK', title: '错题整理' }
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
  // 重算各学生总积分（MySQL 不允许在 UPDATE 子查询中引用同一张表，改为按学生汇总后逐条更新）
  const sums = await db.prepare('SELECT student_id, COALESCE(SUM(change_amount),0) AS s FROM credit_flow GROUP BY student_id').all();
  const updStuCredit = db.prepare('UPDATE student SET total_credits=? WHERE id=?');
  for (const { student_id, s } of sums) {
    await updStuCredit.run(s, student_id);
  }

  // 预警
  await db.prepare("INSERT INTO alert(student_id, type, level, message) VALUES(?,?,?,?)").run(4, 'CONSECUTIVE_MISS', 'DANGER', '连续 3 个任务未完成（错题整理/单元测试卷/第三章习题）');
  await db.prepare("INSERT INTO alert(student_id, type, level, message) VALUES(?,?,?,?)").run(2, 'OVERDUE_SOON', 'WARN', '《单元测试卷》将于 2026-07-20 截止且尚未完成');

  // 操作日志
  await db.prepare("INSERT INTO operate_log(operator_id, operator_name, operate_type, table_name, record_id, before_snapshot, after_snapshot) VALUES(?,?,?,?,?,?,?)")
    .run(teacherId, '杨老师', 'INSERT', 'task', 3, null, '{"title":"单元测试卷","credit_value":8}');
  await db.prepare("INSERT INTO operate_log(operator_id, operator_name, operate_type, table_name, record_id, before_snapshot, after_snapshot) VALUES(?,?,?,?,?,?,?)")
    .run(r1, '李课代(语文)', 'UPDATE', 'completion_record', 1, '{"status":"UNFINISHED","credit_change":0}', '{"status":"DONE_ONTIME","credit_change":3}');

  // 任务模板
  await db.prepare('INSERT INTO task_template(name, subject_id, type, credit_value, description) VALUES(?,?,?,?,?)')
    .run('《赤壁赋》背诵·模板', 1, 'BACKING', 3, '默写并背诵全文');
  await db.prepare('INSERT INTO task_template(name, subject_id, type, credit_value, description) VALUES(?,?,?,?,?)')
    .run('第三章习题·模板', 2, 'HOMEWORK', 5, '完成课后习题 1-10');

  console.log('[seed] 初始数据已写入');
}

// ── 幂等迁移：每次启动都执行，用于给「已存在的库」补齐新功能所需的数据 ──
async function migrate() {
  const CLASS_ID = 1;

  // 确保存在班级（极端情况下空库场景）
  const hasClass = await db.prepare('SELECT id FROM clazz WHERE id=?').get(CLASS_ID);
  if (!hasClass) {
    await db.prepare('INSERT INTO clazz(id, name) VALUES(?,?)').run(CLASS_ID, '默认班级');
  }

  // 1) 超级管理员（单独给管理者本人的最高权限账号）
  const SUPER_USER = 'superadmin';
  const existSuper = await db.prepare('SELECT id FROM sys_user WHERE username=?').get(SUPER_USER);
  if (!existSuper) {
    await db.prepare('INSERT INTO sys_user(username, password, name, role, class_id, student_id) VALUES(?,?,?,?,?,?)')
      .run(SUPER_USER, hashPassword('Feiyue@2026'), '超级管理员', 'ADMIN', CLASS_ID, null);
    console.log('[migrate] 超级管理员账号已创建: superadmin / (密码已设置，请及时修改)');
  }

  // 2) 初中全科科目补齐（缺哪科补哪科，默认挂默认教师 teacher_id=2）
  const FULL_SUBJECTS = [
    '语文', '数学', '英语', '物理', '化学', '生物',
    '道德与法治', '历史', '地理', '体育与健康', '音乐', '美术', '信息科技',
    '其他'
  ];
  const teacherRow = await db.prepare("SELECT id FROM sys_user WHERE role='TEACHER' ORDER BY id LIMIT 1").get();
  const teacherId = teacherRow ? teacherRow.id : null;
  const insSubj = db.prepare('INSERT INTO subject(name, class_id, teacher_id) VALUES(?,?,?)');
  for (const name of FULL_SUBJECTS) {
    const exist = await db.prepare('SELECT id FROM subject WHERE name=? AND class_id=?').get(name, CLASS_ID);
    if (!exist) await insSubj.run(name, CLASS_ID, teacherId);
  }

  // 3) 学生账号用户名规范化：stu01 -> student01（修复 student01 登录失败问题）
  const stuUsers = await db.prepare("SELECT id, username FROM sys_user WHERE role='STUDENT' AND username LIKE 'stu_%' AND username NOT LIKE 'student%'").all();
  const updStu = db.prepare('UPDATE sys_user SET username=? WHERE id=?');
  const chkStu = db.prepare('SELECT id FROM sys_user WHERE username=?');
  for (const u of stuUsers) {
    const newName = 'student' + u.username.slice(3); // 'stu01' -> 'student01'
    if (!(await chkStu.get(newName))) await updStu.run(newName, u.id);
  }

  // 4) 测试教师 王老师 -> 杨老师（仅改种子默认教师账号与日志）
  await db.prepare("UPDATE sys_user SET name='杨老师' WHERE username='teacher01' AND name='王老师'").run();
  await db.prepare("UPDATE operate_log SET operator_name='杨老师' WHERE operator_name='王老师'").run();

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

  // 9) 课程资料自动播种：仅当 resource 表为空时填充示例资料（与数据库 id 解耦，刷新/新环境均可复现）
  await require('./seed_resources').seedResources(db);
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
