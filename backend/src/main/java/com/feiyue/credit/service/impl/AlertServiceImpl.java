package com.feiyue.credit.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.feiyue.credit.common.BizException;
import com.feiyue.credit.common.SecurityUtils;
import com.feiyue.credit.dto.AlertVO;
import com.feiyue.credit.entity.Alert;
import com.feiyue.credit.entity.Clazz;
import com.feiyue.credit.entity.CompletionRecord;
import com.feiyue.credit.entity.Student;
import com.feiyue.credit.mapper.AlertMapper;
import com.feiyue.credit.mapper.ClazzMapper;
import com.feiyue.credit.mapper.CompletionRecordMapper;
import com.feiyue.credit.mapper.StudentMapper;
import com.feiyue.credit.service.AlertService;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** 预警服务实现：定时扫描生成 + 教师查询 + 标记已处理。 */
@Service
@RequiredArgsConstructor
public class AlertServiceImpl implements AlertService {

    private final AlertMapper alertMapper;
    private final ClazzMapper clazzMapper;
    private final CompletionRecordMapper completionRecordMapper;
    private final StudentMapper studentMapper;

    /**
     * 定时扫描生成预警：每天凌晨 1:00 执行。
     * 该方法由调度器直接调用（外部调用，@Transactional 生效，无自调用事务问题）。
     */
    @Override
    @Transactional
    @Scheduled(cron = "0 0 1 * * ?")
    public void scanAndGenerate() {
        List<Clazz> classes = clazzMapper.selectList(null);
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime tomorrow = now.plusDays(1);
        for (Clazz clazz : classes) {
            scanConsecutiveMiss(clazz.getId());
            scanOverdueSoon(clazz.getId(), now, tomorrow);
        }
    }

    /** (a) 同一学生连续 3 个任务 UNFINISHED -> CONSECUTIVE_MISS。 */
    private void scanConsecutiveMiss(Long classId) {
        List<CompletionRecord> records = completionRecordMapper.selectByClassWithTask(classId);
        Map<Long, List<CompletionRecord>> byStudent = new LinkedHashMap<>();
        for (CompletionRecord r : records) {
            byStudent.computeIfAbsent(r.getStudentId(), k -> new ArrayList<>()).add(r);
        }
        for (Map.Entry<Long, List<CompletionRecord>> entry : byStudent.entrySet()) {
            int consecutive = 0;
            boolean hit = false;
            for (CompletionRecord r : entry.getValue()) {
                if ("UNFINISHED".equals(r.getStatus())) {
                    consecutive++;
                    if (consecutive >= 3) {
                        hit = true;
                        break;
                    }
                } else {
                    consecutive = 0;
                }
            }
            if (hit && !existsPending(entry.getKey(), "CONSECUTIVE_MISS")) {
                Alert alert = new Alert();
                alert.setStudentId(entry.getKey());
                alert.setClassId(classId);
                alert.setType("CONSECUTIVE_MISS");
                alert.setReason("连续 3 个任务未完成");
                alert.setStatus("PENDING");
                alertMapper.insert(alert);
            }
        }
    }

    /** (b) 截止日期前 1 天且仍为 UNFINISHED -> OVERDUE_SOON。 */
    private void scanOverdueSoon(Long classId, LocalDateTime start, LocalDateTime end) {
        List<CompletionRecord> records = completionRecordMapper.selectUnfinishedDueSoon(classId, start, end);
        for (CompletionRecord r : records) {
            if (!existsPending(r.getStudentId(), "OVERDUE_SOON")) {
                Alert alert = new Alert();
                alert.setStudentId(r.getStudentId());
                alert.setClassId(classId);
                alert.setType("OVERDUE_SOON");
                alert.setReason("任务临近截止仍未完成");
                alert.setStatus("PENDING");
                alertMapper.insert(alert);
            }
        }
    }

    /** 是否已存在同学生同类型的 PENDING 预警（避免重复插入）。 */
    private boolean existsPending(Long studentId, String type) {
        Long cnt = alertMapper.selectCount(new QueryWrapper<Alert>()
                .eq("student_id", studentId)
                .eq("type", type)
                .eq("status", "PENDING"));
        return cnt != null && cnt > 0;
    }

    @Override
    public List<AlertVO> listByClass(Long classId) {
        Long eff = SecurityUtils.resolveClassId(classId);
        List<Alert> alerts = alertMapper.selectList(
                new QueryWrapper<Alert>().eq(eff != null, "class_id", eff).orderByDesc("create_time"));
        List<AlertVO> vos = new ArrayList<>();
        for (Alert a : alerts) {
            AlertVO vo = new AlertVO();
            vo.setId(a.getId());
            vo.setStudentId(a.getStudentId());
            vo.setClassId(a.getClassId());
            vo.setType(a.getType());
            vo.setReason(a.getReason());
            vo.setStatus(a.getStatus());
            vo.setCreateTime(a.getCreateTime());
            Student s = studentMapper.selectById(a.getStudentId());
            if (s != null) {
                vo.setStudentName(s.getName());
            }
            Clazz c = clazzMapper.selectById(a.getClassId());
            if (c != null) {
                vo.setClassName(c.getName());
            }
            vos.add(vo);
        }
        return vos;
    }

    @Override
    @Transactional
    public void resolve(Long alertId) {
        Alert a = alertMapper.selectById(alertId);
        if (a == null) {
            throw new BizException(404, "预警不存在");
        }
        a.setStatus("RESOLVED");
        alertMapper.updateById(a);
    }
}
