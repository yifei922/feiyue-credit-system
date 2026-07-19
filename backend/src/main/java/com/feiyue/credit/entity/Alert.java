package com.feiyue.credit.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/** 预警表。 */
@Data
@TableName("alert")
public class Alert {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("student_id")
    private Long studentId;

    @TableField("class_id")
    private Long classId;

    /** CONSECUTIVE_MISS / OVERDUE_SOON */
    private String type;

    private String reason;

    /** PENDING / RESOLVED */
    private String status;

    @TableField("create_time")
    private LocalDateTime createTime;
}
