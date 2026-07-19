package com.feiyue.credit.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/** 班级表。`class` 为 MySQL 保留字，表名用反引号包裹。 */
@Data
@TableName("`class`")
public class Clazz {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String name;

    private String grade;

    @TableField("create_time")
    private LocalDateTime createTime;
}
