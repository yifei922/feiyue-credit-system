package com.feiyue.credit.dto;

import lombok.Data;

/** 完成状态计数映射（看板统计用）：某科目下某状态的记录数。 */
@Data
public class CompletionStatusCount {

    private Long subjectId;
    private String status;
    /** COUNT(*) 结果（Long，避免类型转换问题） */
    private Long cnt;
}
