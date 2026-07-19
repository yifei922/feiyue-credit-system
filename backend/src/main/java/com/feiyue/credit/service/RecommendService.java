package com.feiyue.credit.service;

import com.feiyue.credit.dto.RecommendVO;

import java.util.List;

/** 补修推荐服务：为学生或班级推荐待补修任务。 */
public interface RecommendService {

    /** 为学生推荐待补修任务；targetCredits 用于判断是否因学分缺口推荐。 */
    List<RecommendVO> forStudent(Long studentId, Integer targetCredits);

    /** 按班级取有预警学生的补修任务集合。 */
    List<RecommendVO> forClass(Long classId);
}
