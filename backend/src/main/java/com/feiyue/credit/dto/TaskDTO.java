package com.feiyue.credit.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.time.LocalDateTime;

/** 任务创建/更新入参。templateId 非空时创建会复制模板字段。 */
@Data
public class TaskDTO {

    /** 更新时使用的主键（创建时为空）。 */
    private Long id;

    @NotBlank(message = "任务标题不能为空")
    private String title;

    private Long subjectId;

    /** 班级 ID；教师/科代表会被强制替换为自身班级（行级隔离）。 */
    private Long classId;

    /** HOMEWORK / BACKING / EXAM */
    private String type;

    private Integer creditValue;

    private LocalDateTime deadline;

    private String description;

    /** OPEN / CLOSED；为空默认 OPEN。 */
    private String status;

    /** 来源模板，非空则复制 type/creditValue/description/name。 */
    private Long templateId;
}
