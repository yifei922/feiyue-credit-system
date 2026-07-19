package com.feiyue.credit.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.feiyue.credit.common.BizException;
import com.feiyue.credit.common.SecurityUtils;
import com.feiyue.credit.dto.CompletionRecordVO;
import com.feiyue.credit.dto.CompletionRegisterRequest;
import com.feiyue.credit.entity.CompletionRecord;
import com.feiyue.credit.entity.CreditFlow;
import com.feiyue.credit.entity.Student;
import com.feiyue.credit.entity.Task;
import com.feiyue.credit.mapper.CompletionRecordMapper;
import com.feiyue.credit.mapper.CreditFlowMapper;
import com.feiyue.credit.mapper.StudentMapper;
import com.feiyue.credit.mapper.TaskMapper;
import com.feiyue.credit.service.CompletionService;
import com.feiyue.credit.service.OperateLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 完成登记核心服务。
 *
 * 学分计算规则（在 register 中落地）：
 *  - DONE_ONTIME  ：按时完成，得满分 creditValue；流水类型按任务类型映射
 *                   （BACKING -> BACKING_DONE，其余 HOMEWORK/EXAM -> HOMEWORK_DONE）。
 *  - DONE_OVERDUE ：逾期完成，按规则扣减，实际得分 = floor(creditValue * 0.5)（满分的一半，向下取整）；
 *                   记为一条 OVERDUE_DEDUCT 流水，credit_change 为实际入账学分（即已扣减后的净值）。
 *  - UNFINISHED / FAILED：不加分，creditChange = 0。
 *
 * 每次登记计算 delta = 本次得分 - 上次得分，写一条 credit_flow（delta 可为负，表示回退/扣分），
 * 并将 student.total_credits += delta。同时记录 completion_record 的 operate_log 前后快照。
 */
@Service
@RequiredArgsConstructor
public class CompletionServiceImpl implements CompletionService {

    private final CompletionRecordMapper completionRecordMapper;
    private final TaskMapper taskMapper;
    private final StudentMapper studentMapper;
    private final CreditFlowMapper creditFlowMapper;
    private final OperateLogService operateLogService;

    @Override
    @Transactional
    public int register(CompletionRegisterRequest request) {
        Task task = taskMapper.selectById(request.getTaskId());
        if (task == null) {
            throw new BizException(404, "任务不存在");
        }
        // 行级隔离：非 ADMIN 仅能操作本班任务
        Long eff = SecurityUtils.resolveClassId(task.getClassId());
        if (eff != null && !eff.equals(task.getClassId())) {
            throw new BizException(403, "无权操作其他班级的任务");
        }
        int affected = 0;
        for (Long studentId : request.getStudentIds()) {
            registerOne(task, studentId, request.getStatus(), request.getOperatorId());
            affected++;
        }
        return affected;
    }

    private void registerOne(Task task, Long studentId, String status, Long operatorId) {
        CompletionRecord existing = completionRecordMapper.selectOne(
                new QueryWrapper<CompletionRecord>()
                        .eq("task_id", task.getId())
                        .eq("student_id", studentId));
        int oldCredit = (existing != null && existing.getCreditChange() != null) ? existing.getCreditChange() : 0;

        CompletionRecord record = existing != null ? existing : new CompletionRecord();
        record.setTaskId(task.getId());
        record.setStudentId(studentId);
        record.setSubjectId(task.getSubjectId());
        record.setStatus(status);
        record.setOperatorId(operatorId != null ? operatorId : SecurityUtils.currentUserId());

        int newCredit;
        String flowType;
        if ("DONE_ONTIME".equals(status)) {
            newCredit = task.getCreditValue();
            flowType = "BACKING".equals(task.getType()) ? "BACKING_DONE" : "HOMEWORK_DONE";
            record.setCompletionTime(LocalDateTime.now());
        } else if ("DONE_OVERDUE".equals(status)) {
            // 逾期完成：实际得分 = 满分向下取整的一半（扣分规则）
            newCredit = (int) Math.floor(task.getCreditValue() * 0.5);
            flowType = "OVERDUE_DEDUCT";
            record.setCompletionTime(LocalDateTime.now());
        } else {
            // UNFINISHED / FAILED 不加分
            newCredit = 0;
            flowType = "MANUAL";
            record.setCompletionTime(null);
        }
        record.setCreditChange(newCredit);

        if (existing == null) {
            completionRecordMapper.insert(record);
        } else {
            completionRecordMapper.updateById(record);
        }

        // 学分变动 delta（可能为 0 / 正 / 负）
        int delta = newCredit - oldCredit;
        if (delta != 0) {
            CreditFlow flow = new CreditFlow();
            flow.setUserId(studentId);
            flow.setTaskId(task.getId());
            flow.setCreditChange(delta);
            flow.setFlowType(flowType);
            creditFlowMapper.insert(flow);

            Student student = studentMapper.selectById(studentId);
            if (student != null) {
                student.setTotalCredits(student.getTotalCredits() + delta);
                studentMapper.updateById(student);
            }
        }
        // 记录操作日志（前后快照）
        operateLogService.log(existing == null ? "INSERT" : "UPDATE",
                "completion_record", record.getId(), existing, record);
    }

    @Override
    public List<CompletionRecordVO> listByTask(Long taskId) {
        return completionRecordMapper.selectVoByTask(taskId);
    }
}
