package com.feiyue.credit.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/** 积分流水表。记录每一次学分变动。 */
@Data
@TableName("credit_flow")
public class CreditFlow {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("user_id")
    private Long userId;

    @TableField("task_id")
    private Long taskId;

    @TableField("credit_change")
    private Integer creditChange;

    /** HOMEWORK_DONE / BACKING_DONE / OVERDUE_DEDUCT / REMEDY / MANUAL */
    private String flowType;

    @TableField("create_time")
    private LocalDateTime createTime;
}
