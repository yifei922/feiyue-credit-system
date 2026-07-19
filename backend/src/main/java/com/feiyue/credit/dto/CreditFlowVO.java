package com.feiyue.credit.dto;

import lombok.Data;

import java.time.LocalDateTime;

/** 积分流水视图对象，携带学生姓名与任务标题。 */
@Data
public class CreditFlowVO {

    private Long id;
    private Long userId;
    private Long taskId;
    private Integer creditChange;
    /** HOMEWORK_DONE / BACKING_DONE / OVERDUE_DEDUCT / REMEDY / MANUAL */
    private String flowType;
    private LocalDateTime createTime;

    /** 学生姓名 */
    private String studentName;
    /** 任务标题 */
    private String taskTitle;
}
