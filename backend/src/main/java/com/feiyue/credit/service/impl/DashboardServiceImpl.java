package com.feiyue.credit.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.feiyue.credit.common.SecurityUtils;
import com.feiyue.credit.dto.CompletionRecordVO;
import com.feiyue.credit.dto.CompletionStatusCount;
import com.feiyue.credit.dto.CreditDaily;
import com.feiyue.credit.dto.DashboardVO;
import com.feiyue.credit.entity.Subject;
import com.feiyue.credit.entity.Task;
import com.feiyue.credit.mapper.CompletionRecordMapper;
import com.feiyue.credit.mapper.CreditFlowMapper;
import com.feiyue.credit.mapper.SubjectMapper;
import com.feiyue.credit.mapper.TaskMapper;
import com.feiyue.credit.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** 数据看板服务实现：概览（完成率/状态分布/学分趋势）与下钻。 */
@Service
@RequiredArgsConstructor
public class DashboardServiceImpl implements DashboardService {

    private final SubjectMapper subjectMapper;
    private final TaskMapper taskMapper;
    private final CompletionRecordMapper completionRecordMapper;
    private final CreditFlowMapper creditFlowMapper;
    private final StudentMapper studentMapper;

    @Override
    public DashboardVO overview(Long classId) {
        Long eff = SecurityUtils.resolveClassId(classId);
        if (eff != null) {
            classId = eff;
        }
        DashboardVO vo = new DashboardVO();

        // 1) 各科目完成率
        List<CompletionStatusCount> counts = completionRecordMapper.selectStatusCountByClass(classId);
        Map<Long, Integer> doneMap = new HashMap<>();
        Map<Long, Integer> totalMap = new HashMap<>();
        Map<Long, String> subjectNames = new HashMap<>();
        subjectMapper.selectList(new QueryWrapper<Subject>().eq("class_id", classId))
                .forEach(s -> subjectNames.put(s.getId(), s.getName()));
        for (CompletionStatusCount c : counts) {
            int cnt = c.getCnt() == null ? 0 : c.getCnt().intValue();
            totalMap.merge(c.getSubjectId(), cnt, Integer::sum);
            if ("DONE_ONTIME".equals(c.getStatus()) || "DONE_OVERDUE".equals(c.getStatus())) {
                doneMap.merge(c.getSubjectId(), cnt, Integer::sum);
            }
        }
        List<DashboardVO.SubjectCompletionRate> rates = new ArrayList<>();
        for (Long sid : subjectNames.keySet()) {
            int total = totalMap.getOrDefault(sid, 0);
            int done = doneMap.getOrDefault(sid, 0);
            double rate = total == 0 ? 0.0 : (done * 100.0 / total);
            DashboardVO.SubjectCompletionRate r = new DashboardVO.SubjectCompletionRate();
            r.setSubjectName(subjectNames.get(sid));
            r.setCompletionRate(Math.round(rate * 100.0) / 100.0);
            r.setDone(done);
            r.setTotal(total);
            rates.add(r);
        }
        vo.setSubjectCompletionRate(rates);

        // 2) 状态分布
        DashboardVO.StatusDistribution dist = new DashboardVO.StatusDistribution();
        for (CompletionStatusCount c : counts) {
            int cnt = c.getCnt() == null ? 0 : c.getCnt().intValue();
            switch (c.getStatus()) {
                case "UNFINISHED" -> dist.setUnfinished(dist.getUnfinished() + cnt);
                case "DONE_ONTIME" -> dist.setOntime(dist.getOntime() + cnt);
                case "DONE_OVERDUE" -> dist.setOverdue(dist.getOverdue() + cnt);
                case "FAILED" -> dist.setFailed(dist.getFailed() + cnt);
                default -> { /* 忽略未知状态 */ }
            }
        }
        vo.setStatusDistribution(dist);

        // 3) 学分趋势（按日累计）
        List<CreditDaily> dailies = creditFlowMapper.selectDailyCreditByClass(classId);
        List<DashboardVO.CreditTrendPoint> trend = new ArrayList<>();
        int cumulative = 0;
        for (CreditDaily d : dailies) {
            cumulative += d.getDaily() == null ? 0 : d.getDaily().intValue();
            DashboardVO.CreditTrendPoint p = new DashboardVO.CreditTrendPoint();
            p.setDate(d.getDay());
            p.setCredits(cumulative);
            trend.add(p);
        }
        vo.setCreditTrend(trend);
        return vo;
    }

    @Override
    public DashboardVO.SubjectDrillDownVO drillDownSubject(Long classId, Long subjectId) {
        Long eff = SecurityUtils.resolveClassId(classId);
        if (eff != null) {
            classId = eff;
        }
        DashboardVO.SubjectDrillDownVO vo = new DashboardVO.SubjectDrillDownVO();
        Subject sub = subjectMapper.selectById(subjectId);
        vo.setSubjectId(subjectId);
        vo.setSubjectName(sub != null ? sub.getName() : null);

        List<Task> tasks = taskMapper.selectList(
                new QueryWrapper<Task>().eq("class_id", classId).eq("subject_id", subjectId));
        List<DashboardVO.TaskDrillItemVO> items = new ArrayList<>();
        for (Task t : tasks) {
            DashboardVO.TaskDrillItemVO item = new DashboardVO.TaskDrillItemVO();
            item.setTaskId(t.getId());
            item.setTitle(t.getTitle());
            item.setType(t.getType());
            item.setDeadline(t.getDeadline());
            item.setCreditValue(t.getCreditValue());
            List<DashboardVO.CompletionDetailVO> details = new ArrayList<>();
            for (CompletionRecordVO cr : completionRecordMapper.selectVoByTask(t.getId())) {
                DashboardVO.CompletionDetailVO d = new DashboardVO.CompletionDetailVO();
                d.setStudentId(cr.getStudentId());
                d.setStudentName(cr.getStudentName());
                d.setStatus(cr.getStatus());
                d.setCompletionTime(cr.getCompletionTime());
                d.setCreditChange(cr.getCreditChange());
                details.add(d);
            }
            item.setCompletions(details);
            items.add(item);
        }
        vo.setTasks(items);
        return vo;
    }

    @Override
    public List<DashboardVO.StatusDrillDownVO> drillDownStatus(Long classId, String status) {
        Long eff = SecurityUtils.resolveClassId(classId);
        if (eff != null) {
            classId = eff;
        }
        return completionRecordMapper.selectStatusDrillDown(classId, status);
    }
}
