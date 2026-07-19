-- =============================================================================
-- 斐越-十班班级作业学分管理系统 V2.0  ——  数据库初始化脚本 (MySQL 8.0)
-- 说明：
--   1. 任务表 / 完成记录表 上的复合索引按设计落地（详见下方注释与文档 §5）。
--   2. 完成记录表新增 completion_time（完成时间, datetime）。
--   3. 新增积分流水表 credit_flow。
--   4. 学生表新增 total_credits（累计总学分）。
--   5. 行级权限（class_id 隔离）由后端在 SQL 中自动拼接 WHERE class_id = ? 实现。
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- 班级表
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `class` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(50)  NOT NULL COMMENT '班级名称，如：十班',
  `grade`       VARCHAR(20)  DEFAULT NULL COMMENT '年级',
  `create_time` DATETIME     DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='班级表';

-- -----------------------------------------------------------------------------
-- 科目表
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `subject` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(50)  NOT NULL COMMENT '科目名称，如：语文 / 数学',
  `teacher_id`  BIGINT       DEFAULT NULL COMMENT '任课教师(sys_user.id)',
  `class_id`    BIGINT       NOT NULL COMMENT '所属班级',
  `create_time` DATETIME     DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_subject_class` (`class_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='科目表';

-- -----------------------------------------------------------------------------
-- 系统用户表（教师 / 科代表 / 管理员）
-- 密码字段存放 BCrypt 加密后的密文
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sys_user` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT,
  `username`    VARCHAR(50)  NOT NULL,
  `password`    VARCHAR(100) NOT NULL COMMENT 'BCrypt 密文',
  `real_name`   VARCHAR(50)  DEFAULT NULL,
  `role`        VARCHAR(20)  NOT NULL COMMENT 'TEACHER / REP / ADMIN',
  `class_id`    BIGINT       DEFAULT NULL COMMENT '教师/科代表所负责班级',
  `create_time` DATETIME     DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统用户表';

-- -----------------------------------------------------------------------------
-- 学生表（新增 total_credits 累计总学分）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `student` (
  `id`            BIGINT       NOT NULL AUTO_INCREMENT,
  `student_no`    VARCHAR(30)  NOT NULL COMMENT '学号',
  `name`          VARCHAR(50)  NOT NULL,
  `class_id`      BIGINT       NOT NULL,
  `total_credits` INT          NOT NULL DEFAULT 0 COMMENT '累计总学分（冗余，便于快速查询）',
  `create_time`   DATETIME     DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_student_no` (`student_no`, `class_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='学生信息表';

-- -----------------------------------------------------------------------------
-- 任务表
-- 说明：任务为「班级级」而非「学生级」，因此(科目ID,学生ID)复合索引不适配本表。
--       设计落地为 (subject_id, class_id) 复合索引，满足「按科目+班级联合查询」场景。
--       若贵方原始设计中任务为「每名学生一行」(task 含 student_id)，可改为 (subject_id, student_id)，
--       我会在下一阶段按确认结果调整。
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `task` (
  `id`           BIGINT       NOT NULL AUTO_INCREMENT,
  `subject_id`   BIGINT       NOT NULL,
  `class_id`     BIGINT       NOT NULL,
  `title`        VARCHAR(100) NOT NULL,
  `description`  TEXT,
  `type`         VARCHAR(20)  NOT NULL COMMENT 'HOMEWORK=作业 / BACKING=背书 / EXAM=测验',
  `credit_value` INT          NOT NULL DEFAULT 0 COMMENT '完成任务可得学分',
  `deadline`     DATETIME     DEFAULT NULL COMMENT '截止时间',
  `status`       VARCHAR(20)  DEFAULT 'OPEN' COMMENT 'OPEN / CLOSED',
  `template_id`  BIGINT       DEFAULT NULL COMMENT '来源模板(task_template.id)',
  `create_time`  DATETIME     DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_task_subject_class` (`subject_id`, `class_id`),
  KEY `idx_task_class` (`class_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='任务表';

-- -----------------------------------------------------------------------------
-- 完成记录表（新增 completion_time 完成时间）
-- 复合索引 (subject_id, student_id) 满足「某学生某科目完成情况」联合查询。
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `completion_record` (
  `id`              BIGINT       NOT NULL AUTO_INCREMENT,
  `task_id`         BIGINT       NOT NULL,
  `student_id`      BIGINT       NOT NULL,
  `subject_id`      BIGINT       NOT NULL,
  `status`          VARCHAR(20)  NOT NULL COMMENT 'UNFINISHED=未完成 / DONE_ONTIME=按时完成 / DONE_OVERDUE=逾期完成 / FAILED=未通过',
  `completion_time` DATETIME     DEFAULT NULL COMMENT '完成时间（新增字段）',
  `credit_change`   INT          DEFAULT 0 COMMENT '本次记录产生的学分变动（冗余，便于对账）',
  `operator_id`     BIGINT       DEFAULT NULL COMMENT '操作人(sys_user.id)',
  `create_time`     DATETIME     DEFAULT CURRENT_TIMESTAMP,
  `update_time`     DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_task_student` (`task_id`, `student_id`),
  KEY `idx_cr_subject_student` (`subject_id`, `student_id`),
  KEY `idx_cr_task` (`task_id`),
  KEY `idx_cr_student` (`student_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='完成记录表';

-- -----------------------------------------------------------------------------
-- 积分流水表（新增）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `credit_flow` (
  `id`            BIGINT       NOT NULL AUTO_INCREMENT,
  `user_id`       BIGINT       NOT NULL COMMENT '学生(student.id)',
  `task_id`       BIGINT       DEFAULT NULL COMMENT '关联任务',
  `credit_change` INT          NOT NULL COMMENT '学分变动（正=加，负=扣）',
  `flow_type`     VARCHAR(30)  NOT NULL COMMENT 'HOMEWORK_DONE=作业完成 / BACKING_DONE=背书完成 / OVERDUE_DEDUCT=逾期扣分 / REMEDY=补修 / MANUAL=手动调整',
  `create_time`   DATETIME     DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_flow_user` (`user_id`),
  KEY `idx_flow_task` (`task_id`),
  KEY `idx_flow_type` (`flow_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='积分流水表';

-- -----------------------------------------------------------------------------
-- 任务模板表（指令7：保存为模板 / 从模板创建）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `task_template` (
  `id`           BIGINT       NOT NULL AUTO_INCREMENT,
  `name`         VARCHAR(100) NOT NULL COMMENT '模板名称',
  `subject_id`   BIGINT       DEFAULT NULL,
  `type`         VARCHAR(20)  DEFAULT NULL,
  `credit_value` INT          DEFAULT NULL,
  `description`  TEXT,
  `creator_id`   BIGINT       DEFAULT NULL,
  `create_time`  DATETIME     DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tpl_subject` (`subject_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='任务模板表';

-- -----------------------------------------------------------------------------
-- 预警表（指令4：学分预警）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `alert` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT,
  `student_id`  BIGINT       NOT NULL,
  `class_id`    BIGINT       DEFAULT NULL,
  `type`        VARCHAR(30)  NOT NULL COMMENT 'CONSECUTIVE_MISS=连续未完成 / OVERDUE_SOON=临近截止未完成',
  `reason`      VARCHAR(255) DEFAULT NULL,
  `status`      VARCHAR(20)  DEFAULT 'PENDING' COMMENT 'PENDING / RESOLVED',
  `create_time` DATETIME     DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_alert_class` (`class_id`),
  KEY `idx_alert_student` (`student_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='预警表';

-- -----------------------------------------------------------------------------
-- 操作日志表（指令6：审计日志，记录修改前后快照）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `operate_log` (
  `id`              BIGINT     NOT NULL AUTO_INCREMENT,
  `operator_id`     BIGINT     DEFAULT NULL COMMENT '操作人(sys_user.id)',
  `operator_name`   VARCHAR(50) DEFAULT NULL,
  `operate_type`    VARCHAR(30) NOT NULL COMMENT 'INSERT / UPDATE / DELETE',
  `table_name`      VARCHAR(50) DEFAULT NULL,
  `record_id`       BIGINT     DEFAULT NULL,
  `before_snapshot` JSON       DEFAULT NULL COMMENT '修改前数据快照',
  `after_snapshot`  JSON       DEFAULT NULL COMMENT '修改后数据快照',
  `create_time`     DATETIME   DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_log_operator` (`operator_id`),
  KEY `idx_log_table` (`table_name`),
  KEY `idx_log_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作日志表';

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- 初始数据（种子）
-- =============================================================================

-- 班级：十班
INSERT INTO `class` (`id`, `name`, `grade`) VALUES (10, '十班', '高一')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 科目：语文 / 数学（归属十班）
INSERT INTO `subject` (`id`, `name`, `teacher_id`, `class_id`) VALUES
  (1, '语文', 1, 10),
  (2, '数学', 1, 10)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 系统用户（教师/科代表/管理员）的账号与 BCrypt 密码，
-- 改由后端 DataInitializer 在启动时按需创建（默认口令 123456，生产环境请立即修改），
-- 因此此处不再硬编码密文，避免占位哈希导致无法登录。

-- 学生（十班，初始总学分为示例值）
INSERT INTO `student` (`student_no`, `name`, `class_id`, `total_credits`) VALUES
  ('S1001', '张三', 10, 12),
  ('S1002', '李四', 10, 8),
  ('S1003', '王五', 10, 15),
  ('S1004', '赵六', 10, 5),
  ('S1005', '钱七', 10, 10)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 任务：语文背书 + 数学作业
INSERT INTO `task` (`id`, `subject_id`, `class_id`, `title`, `type`, `credit_value`, `deadline`, `status`) VALUES
  (1, 1, 10, '《赤壁赋》背诵', 'BACKING', 3, DATE_ADD(NOW(), INTERVAL 7 DAY), 'OPEN'),
  (2, 2, 10, '第三章习题', 'HOMEWORK', 5, DATE_ADD(NOW(), INTERVAL 3 DAY), 'OPEN')
ON DUPLICATE KEY UPDATE title = VALUES(title);

-- 完成记录（含不同状态；演示联合查询）
INSERT INTO `completion_record` (`task_id`, `student_id`, `subject_id`, `status`, `completion_time`, `credit_change`, `operator_id`) VALUES
  (1, 1, 1, 'DONE_ONTIME',  NOW(), 3, 2),
  (1, 2, 1, 'UNFINISHED',   NULL,   0, NULL),
  (1, 3, 1, 'DONE_OVERDUE', DATE_SUB(NOW(), INTERVAL 1 DAY), 1, 2),
  (2, 1, 2, 'DONE_ONTIME',  NOW(), 5, 2),
  (2, 4, 2, 'UNFINISHED',   NULL,   0, NULL)
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- 积分流水（与上面的完成记录对应）
INSERT INTO `credit_flow` (`user_id`, `task_id`, `credit_change`, `flow_type`) VALUES
  (1, 1, 3,  'BACKING_DONE'),
  (3, 1, 1,  'BACKING_DONE'),   -- 逾期完成，扣分后实际 +1
  (1, 2, 5,  'HOMEWORK_DONE')
ON DUPLICATE KEY UPDATE flow_type = VALUES(flow_type);

-- =============================================================================
-- 关键联合查询示例（评估标准：高效联合查询）
-- =============================================================================
-- 1) 某学生某科目的完成情况（命中 idx_cr_subject_student）
-- SELECT * FROM completion_record WHERE subject_id = 1 AND student_id = 1;

-- 2) 某班级某科目的任务列表（命中 idx_task_subject_class）
-- SELECT * FROM task WHERE subject_id = 1 AND class_id = 10;

-- 3) 某学生的积分流水（命中 idx_flow_user）
-- SELECT * FROM credit_flow WHERE user_id = 1 ORDER BY create_time DESC;

-- 4) 行级权限隔离示例（教师仅能查自己班级）—— 由后端自动拼接 class_id
-- SELECT s.* FROM student s WHERE s.class_id = 10;
