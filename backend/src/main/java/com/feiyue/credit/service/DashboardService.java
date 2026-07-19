package com.feiyue.credit.service;

import com.feiyue.credit.dto.DashboardVO;

import java.util.List;

/** 数据看板服务：概览与下钻。 */
public interface DashboardService {

    /** 班级概览：各科目完成率、状态分布、学分趋势。 */
    DashboardVO overview(Long classId);

    /** 下钻：某科目下各任务及完成学生明细。 */
    DashboardVO.SubjectDrillDownVO drillDownSubject(Long classId, Long subjectId);

    /** 下钻：某状态下各完成明细。 */
    List<DashboardVO.StatusDrillDownVO> drillDownStatus(Long classId, String status);
}
