package com.feiyue.credit.dto;

import lombok.Data;

import java.time.LocalDateTime;

/** 完成记录视图对象，携带学生姓名与任务标题。 */
@Data
public class CompletionRecordVO {

    private Long id;
    private Long taskId;
    private Long studentId;
    private Long subjectId;
    private String status;
    private LocalDateTime completionTime;
    private Integer creditChange;
    private Long operatorId;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;

    /** 关联学生姓名 */
    private String studentName;
    /** 关联任务标题 */
    private String taskTitle;
}
