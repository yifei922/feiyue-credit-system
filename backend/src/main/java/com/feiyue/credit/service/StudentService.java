package com.feiyue.credit.service;

import com.feiyue.credit.dto.StudentVO;

import java.util.List;

/** 学生服务：按班级列表（含班级名称与总学分）。 */
public interface StudentService {

    /** 按班级查询学生列表；classId 为空且当前用户为 ADMIN 时返回全部。 */
    List<StudentVO> listByClass(Long classId);
}
