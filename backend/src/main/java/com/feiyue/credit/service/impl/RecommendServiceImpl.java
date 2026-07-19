package com.feiyue.credit.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.feiyue.credit.common.BizException;
import com.feiyue.credit.common.SecurityUtils;
import com.feiyue.credit.dto.RecommendVO;
import com.feiyue.credit.entity.Alert;
import com.feiyue.credit.entity.CompletionRecord;
import com.feiyue.credit.entity.Student;
import com.feiyue.credit.entity.Subject;
import com.feiyue.credit.entity.Task;
import com.feiyue.credit.mapper.AlertMapper;
import com.feiyue.credit.mapper.CompletionRecordMapper;
import com.feiyue.credit.mapper.StudentMapper;
import com.feiyue.credit.mapper.SubjectMapper;
import com.feiyue.credit.mapper.TaskMapper;
import com.feiyue.credit.service.RecommendService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/** 补修推荐服务实现：基于未完成记录、临近截止与学分缺口推荐任务。 */
@Service
@RequiredArgsConstructor
public class RecommendServiceImpl implements RecommendService {

    private final StudentMapper studentMapper;
    private final TaskMapper taskMapper;
    private final CompletionRecordMapper completionRecordMapper;
    private final AlertMapper alertMapper;
    private final SubjectMapper subjectMapper;

    @Override
    public List<RecommendVO> forStudent(Long studentId, Integer targetCredits) {
        Student student = studentMapper.selectById(studentId);
        if (student == null) {
            throw new BizException(404, "学生不存在");
        }
        Long classId = student.getClassId();
        // 行级隔离：非 ADMIN 仅能查本班学生
        Long eff = SecurityUtils.resolveClassId(classId);
        if (eff != null && !eff.equals(classId)) {
            throw new BizException(403, "无权访问其他班级学生");
        }
        List<Task> tasks = taskMapper.selectList(
                new QueryWrapper<Task>().eq("class_id", classId).eq("status", "OPEN"));

        boolean gap = targetCredits != null
                && student.getTotalCredits() != null
                && student.getTotalCredits() < targetCredits;

        List<RecommendVO> result = new ArrayList<>();
        for (Task task : tasks) {
            CompletionRecord rec = completionRecordMapper.selectOne(
                    new QueryWrapper<CompletionRecord>()
                            .eq("task_id", task.getId())
                            .eq("student_id", studentId));
            boolean need = rec == null || "UNFINISHED".equals(rec.getStatus()) || "FAILED".equals(rec.getStatus());
            if (!need) {
                continue; // 已完成（含逾期完成）不推荐
            }
            RecommendVO vo = new RecommendVO();
            vo.setTaskId(task.getId());
            vo.setTitle(task.getTitle());
            vo.setType(task.getType());
            vo.setCreditValue(task.getCreditValue());
            vo.setClassId(classId);
            vo.setDeadline(task.getDeadline());
            Subject sub = subjectMapper.selectById(task.getSubjectId());
            if (sub != null) {
                vo.setSubjectName(sub.getName());
            }
            vo.setReason(reason(studentId, task, gap));
            result.add(vo);
        }
        // 排序：学分价值高者优先，其次临近截止优先
        result.sort(Comparator
                .comparing(RecommendVO::getCreditValue, Comparator.reverseOrder())
                .thenComparing(r -> r.getDeadline() == null ? LocalDateTime.MAX : r.getDeadline()));
        return result;
    }

    @Override
    public List<RecommendVO> forClass(Long classId) {
        Long eff = SecurityUtils.resolveClassId(classId);
        if (eff != null) {
            classId = eff;
        }
        // 取该班所有 PENDING 预警涉及的学生，汇总其补修任务
        List<Alert> alerts = alertMapper.selectList(
                new QueryWrapper<Alert>().eq("class_id", classId).eq("status", "PENDING"));
        Set<Long> studentIds = alerts.stream().map(Alert::getStudentId).collect(Collectors.toSet());
        List<RecommendVO> result = new ArrayList<>();
        for (Long sid : studentIds) {
            result.addAll(forStudent(sid, null));
        }
        return result;
    }

    /** 推荐理由优先级：连续未完成 > 临近截止 > 学分缺口 > 待补修。 */
    private String reason(Long studentId, Task task, boolean gap) {
        Long missCnt = alertMapper.selectCount(new QueryWrapper<Alert>()
                .eq("student_id", studentId)
                .eq("type", "CONSECUTIVE_MISS")
                .eq("status", "PENDING"));
        if (missCnt != null && missCnt > 0) {
            return "连续未完成";
        }
        LocalDateTime now = LocalDateTime.now();
        if (task.getDeadline() != null
                && !task.getDeadline().isBefore(now)
                && task.getDeadline().isBefore(now.plusDays(1))) {
            return "临近截止";
        }
        if (gap) {
            return "学分缺口";
        }
        return "待补修";
    }
}
