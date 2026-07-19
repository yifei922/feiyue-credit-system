package com.feiyue.credit.dto;

import lombok.Data;

/** 学生视图对象，携带班级名称。 */
@Data
public class StudentVO {

    private Long id;
    private String studentNo;
    private String name;
    private Long classId;
    private String className;
    private Integer totalCredits;
}
