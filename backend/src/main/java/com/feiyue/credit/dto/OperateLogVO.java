package com.feiyue.credit.dto;

import lombok.Data;

import java.time.LocalDateTime;

/** 操作日志视图对象，before/after 直接携带 JSON 快照字符串。 */
@Data
public class OperateLogVO {

    private Long id;
    private String operatorName;
    private String operateType;
    private String tableName;
    private Long recordId;
    private String beforeSnapshot;
    private String afterSnapshot;
    private LocalDateTime createTime;
}
