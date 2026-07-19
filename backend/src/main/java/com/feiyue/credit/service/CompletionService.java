package com.feiyue.credit.service;

import com.feiyue.credit.dto.CompletionRecordVO;
import com.feiyue.credit.dto.CompletionRegisterRequest;

import java.util.List;

/** 完成登记服务：核心事务，处理 upsert、学分计算与流水/student 累计更新。 */
public interface CompletionService {

    /**
     * 批量登记完成。返回受影响的学生记录数。
     * 事务内完成：upsert completion_record、写 credit_flow、更新 student.total_credits、记 operate_log。
     */
    int register(CompletionRegisterRequest request);

    /** 查询某任务下所有完成记录（含学生姓名/任务标题）。 */
    List<CompletionRecordVO> listByTask(Long taskId);
}
