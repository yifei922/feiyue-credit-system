package com.feiyue.credit.dto;

import lombok.Data;

import java.time.LocalDateTime;

/** 操作日志查询筛选条件（所有字段均可选）。 */
@Data
public class OperateLogQueryRequest {

    /** 操作类型，精确匹配：INSERT / UPDATE / DELETE（可选） */
    private String operateType;

    /** 操作人姓名，模糊匹配（可选） */
    private String operatorName;

    /** 起始时间（可选），含边界 */
    private LocalDateTime startTime;

    /** 结束时间（可选），含边界 */
    private LocalDateTime endTime;

    /** 页码，默认 1 */
    private Integer pageNum = 1;

    /** 每页条数，默认 10 */
    private Integer pageSize = 10;
}
