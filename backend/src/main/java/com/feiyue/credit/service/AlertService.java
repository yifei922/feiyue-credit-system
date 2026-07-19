package com.feiyue.credit.service;

import com.feiyue.credit.dto.AlertVO;

import java.util.List;

/** 预警服务：定时扫描生成、教师查询、标记已处理。 */
public interface AlertService {

    /** 扫描并生成预警（定时任务每天凌晨调用，也可手动触发）。 */
    void scanAndGenerate();

    /** 教师预警中心列表（按班级行级隔离）。 */
    List<AlertVO> listByClass(Long classId);

    /** 标记预警为已处理（RESOLVED）。 */
    void resolve(Long alertId);
}
