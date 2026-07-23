// 持久层：Node 内置 node:sqlite（真文件数据库，零依赖、零编译）
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const { hashPassword } = require('./auth');
const { calcCredit } = require('./services/credit');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'credit.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');
// 开启 WAL：写不阻塞读，提升并发上传时附件记录的写入吞吐
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA synchronous = NORMAL;'); // WAL 模式下 NORMAL 比 FULL 快很多，掉电风险极低可接受

const SCHEMA = `
CREATE TABLE IF NOT EXISTS clazz (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  create_time TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS subject (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  class_id INTEGER,
  teacher_id INTEGER,
  create_time TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sys_user (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL,
  class_id INTEGER,
  student_id INTEGER,
  create_time TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS subject_rep (
  subject_id INTEGER,
  user_id INTEGER,
  PRIMARY KEY(subject_id, user_id)
);
CREATE TABLE IF NOT EXISTS student (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  name TEXT NOT NULL,
  student_no TEXT,
  class_id INTEGER,
  total_credits INTEGER DEFAULT 0,
  create_time TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS task (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  subject_id INTEGER,
  class_id INTEGER,
  credit_value INTEGER DEFAULT 0,
  type TEXT DEFAULT 'HOMEWORK',
  status TEXT DEFAULT 'OPEN',
  deadline TEXT,
  description TEXT,
  creator_id INTEGER,
  create_time TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS completion_record (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER,
  student_id INTEGER,
  status TEXT,
  completion_time TEXT,
  credit_earned INTEGER DEFAULT 0,
  operator_id INTEGER,
  create_time TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS credit_flow (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER,
  task_id INTEGER,
  change_amount INTEGER DEFAULT 0,
  flow_type TEXT,
  reason TEXT,
  create_time TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS alert (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER,
  type TEXT,
  level TEXT,
  message TEXT,
  status TEXT DEFAULT 'PENDING',
  create_time TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS operate_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operator_id INTEGER,
  operator_name TEXT,
  operate_type TEXT,
  table_name TEXT,
  record_id INTEGER,
  before_snapshot TEXT,
  after_snapshot TEXT,
  create_time TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS task_template (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  subject_id INTEGER,
  type TEXT DEFAULT 'HOMEWORK',
  credit_value INTEGER DEFAULT 0,
  description TEXT
);
CREATE INDEX IF NOT EXISTS idx_task_subject ON task(subject_id);
CREATE INDEX IF NOT EXISTS idx_task_class ON task(class_id);
CREATE INDEX IF NOT EXISTS idx_completion_task ON completion_record(task_id);
CREATE INDEX IF NOT EXISTS idx_completion_student ON completion_record(student_id);
CREATE INDEX IF NOT EXISTS idx_creditflow_student ON credit_flow(student_id);
CREATE INDEX IF NOT EXISTS idx_alert_student ON alert(student_id);
CREATE INDEX IF NOT EXISTS idx_operatelog_operator ON operate_log(operator_id);

CREATE TABLE IF NOT EXISTS attachment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  completion_record_id INTEGER,
  task_id INTEGER,
  student_id INTEGER,
  uploader_id INTEGER,
  original_name TEXT,
  stored_name TEXT NOT NULL,
  mime TEXT,
  size_original INTEGER,
  size_compressed INTEGER,
  width INTEGER,
  height INTEGER,
  storage_enc TEXT DEFAULT 'raw',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_attachment_task_stu ON attachment(task_id, student_id);
`;

db.exec(SCHEMA);

function seed() {
  const cnt = db.prepare('SELECT COUNT(*) AS c FROM sys_user').get().c;
  if (cnt > 0) return;

  const CLASS_ID = 1;
  db.prepare('INSERT INTO clazz(name) VALUES(?)').run('洛一高附中八（十）班');

  // 科目（teacher_id 指向王老师）
  const insSubj = db.prepare('INSERT INTO subject(name, class_id, teacher_id) VALUES(?,?,?)');
  insSubj.run('语文', CLASS_ID, 2);
  insSubj.run('数学', CLASS_ID, 2);
  insSubj.run('英语', CLASS_ID, 2);

  // 用户：管理员(ADMIN) / 老师(TEACHER) / 课代表(REP x2) / 学生(STUDENT)
  const insUser = db.prepare(
    'INSERT INTO sys_user(username, password, name, role, class_id, student_id) VALUES(?,?,?,?,?,?)'
  );
  insUser.run('admin', hashPassword('123456'), '管理员', 'ADMIN', CLASS_ID, null);
  insUser.run('teacher01', hashPassword('123456'), '杨老师', 'TEACHER', CLASS_ID, null);
  insUser.run('rep01', hashPassword('123456'), '李课代(语文)', 'REP', CLASS_ID, null);
  insUser.run('rep02', hashPassword('123456'), '张课代(数学)', 'REP', CLASS_ID, null);

  // 显式取 id
  const getUid = (u) => db.prepare('SELECT id FROM sys_user WHERE username=?').get(u).id;
  const adminId = getUid('admin');
  const teacherId = getUid('teacher01');
  const r1 = getUid('rep01');
  const r2 = getUid('rep02');

  // 学生档案 + 账号
  const studentsSeed = [
    ['张三', 'S1001'], ['李四', 'S1002'], ['王五', 'S1003'],
    ['赵六', 'S1004'], ['钱七', 'S1005'], ['孙八', 'S1006']
  ];
  const insStu = db.prepare('INSERT INTO student(name, student_no, class_id) VALUES(?,?,?)');
  const insStuUser = db.prepare(
    'INSERT INTO sys_user(username, password, name, role, class_id, student_id) VALUES(?,?,?,?,?,?)'
  );
  studentsSeed.forEach(([name, no], i) => {
    insStu.run(name, no, CLASS_ID);
    const studentId = db.prepare('SELECT last_insert_rowid() AS id').get().id;
    const username = 'student' + String(i + 1).padStart(2, '0');
    insStuUser.run(username, hashPassword('123456'), name, 'STUDENT', CLASS_ID, studentId);
  });

  // 课代表科目关联
  db.prepare('INSERT INTO subject_rep(subject_id, user_id) VALUES(?,?)').run(1, r1);
  db.prepare('INSERT INTO subject_rep(subject_id, user_id) VALUES(?,?)').run(2, r2);

  // 示例任务（type/deadline 与前端契约一致）
  const insTask = db.prepare(
    'INSERT INTO task(title, subject_id, class_id, credit_value, type, status, deadline, description, creator_id) VALUES(?,?,?,?,?,?,?,?,?)'
  );
  insTask.run('《赤壁赋》背诵', 1, CLASS_ID, 3, 'BACKING', 'OPEN', '2026-07-26 23:59', '默写并背诵全文', r1);
  insTask.run('第三章习题', 2, CLASS_ID, 5, 'HOMEWORK', 'OPEN', '2026-07-22 23:59', '完成课后习题 1-10', r2);
  insTask.run('单元测试卷', 1, CLASS_ID, 8, 'EXAM', 'OPEN', '2026-07-20 23:59', '语文综合测验', teacherId);
  insTask.run('错题整理', 2, CLASS_ID, 4, 'HOMEWORK', 'OPEN', '2026-07-30 23:59', '整理本周错题', r2);

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
  seedComp.forEach(([taskId, studentId, status]) => {
    const meta = taskMeta[taskId];
    const { credit, flowType } = calcCredit(meta.credit, meta.type, status);
    const ctime = status === 'UNFINISHED' || status === 'FAILED' ? null : '2026-07-19 10:00';
    insComp.run(taskId, studentId, status, ctime, credit, teacherId);
    if (credit > 0) {
      insFlow.run(studentId, taskId, credit, flowType, meta.title);
    }
  });
  // 重算各学生总学分
  db.prepare(`UPDATE student SET total_credits = (
    SELECT COALESCE(SUM(change_amount),0) FROM credit_flow WHERE student_id=student.id
  )`).run();

  // 预警
  db.prepare("INSERT INTO alert(student_id, type, level, message) VALUES(?,?,?,?)").run(4, 'CONSECUTIVE_MISS', 'DANGER', '连续 3 个任务未完成（错题整理/单元测试卷/第三章习题）');
  db.prepare("INSERT INTO alert(student_id, type, level, message) VALUES(?,?,?,?)").run(2, 'OVERDUE_SOON', 'WARN', '《单元测试卷》将于 2026-07-20 截止且尚未完成');

  // 操作日志
  db.prepare("INSERT INTO operate_log(operator_id, operator_name, operate_type, table_name, record_id, before_snapshot, after_snapshot) VALUES(?,?,?,?,?,?,?)")
    .run(teacherId, '杨老师', 'INSERT', 'task', 3, null, '{"title":"单元测试卷","credit_value":8}');
  db.prepare("INSERT INTO operate_log(operator_id, operator_name, operate_type, table_name, record_id, before_snapshot, after_snapshot) VALUES(?,?,?,?,?,?,?)")
    .run(r1, '李课代(语文)', 'UPDATE', 'completion_record', 1, '{"status":"UNFINISHED","credit_change":0}', '{"status":"DONE_ONTIME","credit_change":3}');

  // 任务模板
  db.prepare('INSERT INTO task_template(name, subject_id, type, credit_value, description) VALUES(?,?,?,?,?)')
    .run('《赤壁赋》背诵·模板', 1, 'BACKING', 3, '默写并背诵全文');
  db.prepare('INSERT INTO task_template(name, subject_id, type, credit_value, description) VALUES(?,?,?,?,?)')
    .run('第三章习题·模板', 2, 'HOMEWORK', 5, '完成课后习题 1-10');

  console.log('[seed] 初始数据已写入');
}

seed();

// ── 幂等迁移：每次启动都执行，用于给「已存在的库」补齐新功能所需的数据 ──
// 不受 seed() 的空库守卫限制，保证线上老库/新库都能获得：初中全科科目 + 超级管理员
function migrate() {
  const CLASS_ID = 1;

  // 确保存在班级（极端情况下空库场景）
  const hasClass = db.prepare('SELECT id FROM clazz WHERE id=?').get(CLASS_ID);
  if (!hasClass) db.prepare('INSERT INTO clazz(id, name) VALUES(?,?)').run(CLASS_ID, '洛一高附中八（十）班');

  // 1) 超级管理员（单独给管理者本人的最高权限账号）
  const SUPER_USER = 'superadmin';
  const existSuper = db.prepare('SELECT id FROM sys_user WHERE username=?').get(SUPER_USER);
  if (!existSuper) {
    db.prepare('INSERT INTO sys_user(username, password, name, role, class_id, student_id) VALUES(?,?,?,?,?,?)')
      .run(SUPER_USER, hashPassword('Feiyue@2026'), '超级管理员', 'ADMIN', CLASS_ID, null);
    console.log('[migrate] 超级管理员账号已创建: superadmin / Feiyue@2026');
  }

  // 2) 初中全科科目补齐（缺哪科补哪科，默认挂王老师 teacher_id=2）
  const FULL_SUBJECTS = [
    '语文', '数学', '英语', '物理', '化学', '生物',
    '道德与法治', '历史', '地理', '体育与健康', '音乐', '美术', '信息科技',
    '其他'   // 自定义任务分类（用户可自由创建各类非学科任务）
  ];
  const teacher = db.prepare("SELECT id FROM sys_user WHERE role='TEACHER' ORDER BY id LIMIT 1").get();
  const teacherId = teacher ? teacher.id : null;
  const insSubj = db.prepare('INSERT INTO subject(name, class_id, teacher_id) VALUES(?,?,?)');
  FULL_SUBJECTS.forEach((name) => {
    const exist = db.prepare('SELECT id FROM subject WHERE name=? AND class_id=?').get(name, CLASS_ID);
    if (!exist) insSubj.run(name, CLASS_ID, teacherId);
  });

  // 3) 学生账号用户名规范化：stu01 -> student01（修复 student01 登录失败问题）
  const stuUsers = db.prepare("SELECT id, username FROM sys_user WHERE role='STUDENT' AND username LIKE 'stu_%' AND username NOT LIKE 'student%'").all();
  const updStu = db.prepare('UPDATE sys_user SET username=? WHERE id=?');
  const chkStu = db.prepare('SELECT id FROM sys_user WHERE username=?');
  stuUsers.forEach((u) => {
    const newName = 'student' + u.username.slice(3); // 'stu01' -> 'student01'
    if (!chkStu.get(newName)) updStu.run(newName, u.id);
  });

  // 4) 测试教师 王老师 -> 杨老师（仅改种子默认教师账号与日志）
  db.prepare("UPDATE sys_user SET name='杨老师' WHERE username='teacher01' AND name='王老师'").run();
  db.prepare("UPDATE operate_log SET operator_name='杨老师' WHERE operator_name='王老师'").run();

  // 5) 附件存储编码列（raw/gzip）：用于视频/PDF/文档的无损存储压缩，下载时按此透明解压
  const attCols = db.prepare("PRAGMA table_info(attachment)").all();
  if (!attCols.some((c) => c.name === 'storage_enc')) {
    db.prepare("ALTER TABLE attachment ADD COLUMN storage_enc TEXT DEFAULT 'raw'").run();
  }
}

migrate();

module.exports = { db };
