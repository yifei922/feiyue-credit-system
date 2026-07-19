package com.feiyue.credit.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/** 学生信息表。total_credits 为累计总学分（冗余）。 */
@Data
@TableName("student")
public class Student {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("student_no")
    private String studentNo;

    private String name;

    @TableField("class_id")
    private Long classId;

    @TableField("total_credits")
    private Integer totalCredits;

    @TableField("create_time")
    private LocalDateTime createTime;
}
