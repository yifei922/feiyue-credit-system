package com.feiyue.credit.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/** 操作日志表。记录数据修改前后的 JSON 快照，用于审计。 */
@Data
@TableName("operate_log")
public class OperateLog {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("operator_id")
    private Long operatorId;

    @TableField("operator_name")
    private String operatorName;

    @TableField("operate_type")
    private String operateType;

    @TableField("table_name")
    private String tableName;

    @TableField("record_id")
    private Long recordId;

    @TableField("before_snapshot")
    private String beforeSnapshot;

    @TableField("after_snapshot")
    private String afterSnapshot;

    @TableField("create_time")
    private LocalDateTime createTime;
}
