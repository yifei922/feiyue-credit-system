package com.feiyue.credit.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.feiyue.credit.dto.CreditFlowVO;

import java.time.LocalDateTime;

/** 积分流水服务：按学生/班级分页查询，支持时间范围与流水类型筛选。 */
public interface CreditFlowService {

    /**
     * 分页查询积分流水。
     * @param userId  学生 ID（可空）
     * @param classId 班级 ID（可空，行级隔离）
     * @param start   起始时间（可空）
     * @param end     结束时间（可空）
     * @param flowType 流水类型（可空）
     */
    IPage<CreditFlowVO> page(Long userId, Long classId, LocalDateTime start,
                             LocalDateTime end, String flowType, int page, int size);
}
