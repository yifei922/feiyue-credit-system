package com.feiyue.credit.dto;

import lombok.Data;

import java.time.LocalDateTime;

/** 预警视图对象，携带学生姓名与班级名称。 */
@Data
public class AlertVO {

    private Long id;
    private Long studentId;
    private Long classId;
    /** CONSECUTIVE_MISS / OVERDUE_SOON */
    private String type;
    private String reason;
    /** PENDING / RESOLVED */
    private String status;
    private LocalDateTime createTime;

    private String studentName;
    private String className;
}
