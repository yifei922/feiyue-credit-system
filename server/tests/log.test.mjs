// 指令6 核心：操作日志前后快照写入 + 回查
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeAll } from 'vitest';

// 必须在导入 db 之前指定临时库，避免触碰真实数据
process.env.DB_PATH = path.join(os.tmpdir(), `credit-log-test-${Date.now()}.db`);

const dbMod = await import('../src/db.js');
const { db } = dbMod;
const logMod = await import('../src/services/log.js');
const { recordLog } = logMod;

describe('operate_log 审计快照', () => {
  it('写入前后快照并可按字段回查', () => {
    recordLog(
      { id: 1, name: '杨老师' },
      'UPDATE',
      'task',
      5,
      { title: '原作业', status: 'OPEN' },
      { title: '修改后的作业', status: 'DONE' }
    );

    const rows = db.prepare('SELECT * FROM operate_log ORDER BY id DESC').all();
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const r = rows[0];

    expect(r.operate_type).toBe('UPDATE');
    expect(r.table_name).toBe('task');
    expect(r.record_id).toBe(5);
    expect(r.operator_name).toBe('杨老师');
    expect(JSON.parse(r.before_snapshot)).toEqual({ title: '原作业', status: 'OPEN' });
    expect(JSON.parse(r.after_snapshot)).toEqual({ title: '修改后的作业', status: 'DONE' });
  });

  it('空 operator 时静默跳过（不写入）', () => {
    const before = db.prepare('SELECT COUNT(*) AS c FROM operate_log').get().c;
    recordLog(null, 'UPDATE', 'task', 9, {}, {});
    const after = db.prepare('SELECT COUNT(*) AS c FROM operate_log').get().c;
    expect(after).toBe(before);
  });
});
