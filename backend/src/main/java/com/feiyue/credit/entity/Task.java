package com.feiyue.credit.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/** 任务表。任务为班级级，关联科目与班级。 */
@Data
@TableName("task")
public class Task {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("subject_id")
    private Long subjectId;

    @TableField("class_id")
    private Long classId;

    private String title;

    private String description;

    /** HOMEWORK / BACKING / EXAM */
    private String type;

    @TableField("credit_value")
    private Integer creditValue;

    private LocalDateTime deadline;

    /** OPEN / CLOSED */
    private String status;

    @TableField("template_id")
    private Long templateId;

    @TableField("create_time")
    private LocalDateTime createTime;
}
