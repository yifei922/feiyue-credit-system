package com.feiyue.credit.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/** 完成记录表。每位学生对每个任务最多一条（唯一键 task_id+student_id）。 */
@Data
@TableName("completion_record")
public class CompletionRecord {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("task_id")
    private Long taskId;

    @TableField("student_id")
    private Long studentId;

    @TableField("subject_id")
    private Long subjectId;

    /** UNFINISHED / DONE_ONTIME / DONE_OVERDUE / FAILED */
    private String status;

    @TableField("completion_time")
    private LocalDateTime completionTime;

    @TableField("credit_change")
    private Integer creditChange;

    @TableField("operator_id")
    private Long operatorId;

    @TableField("create_time")
    private LocalDateTime createTime;

    @TableField("update_time")
    private LocalDateTime updateTime;
}
