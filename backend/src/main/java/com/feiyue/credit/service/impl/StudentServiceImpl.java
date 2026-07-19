package com.feiyue.credit.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.feiyue.credit.common.SecurityUtils;
import com.feiyue.credit.dto.StudentVO;
import com.feiyue.credit.entity.Clazz;
import com.feiyue.credit.entity.Student;
import com.feiyue.credit.mapper.ClazzMapper;
import com.feiyue.credit.mapper.StudentMapper;
import com.feiyue.credit.service.StudentService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** 学生服务实现：按班级列表（含班级名称与总学分），行级隔离。 */
@Service
@RequiredArgsConstructor
public class StudentServiceImpl implements StudentService {

    private final StudentMapper studentMapper;
    private final ClazzMapper clazzMapper;

    @Override
    public List<StudentVO> listByClass(Long classId) {
        Long eff = SecurityUtils.resolveClassId(classId);
        List<Student> students = studentMapper.selectList(
                new QueryWrapper<Student>().eq(eff != null, "class_id", eff).orderByAsc("student_no"));
        Map<Long, String> classNames = new HashMap<>();
        List<StudentVO> vos = new ArrayList<>();
        for (Student s : students) {
            StudentVO vo = new StudentVO();
            vo.setId(s.getId());
            vo.setStudentNo(s.getStudentNo());
            vo.setName(s.getName());
            vo.setClassId(s.getClassId());
            vo.setTotalCredits(s.getTotalCredits());
            if (!classNames.containsKey(s.getClassId())) {
                Clazz c = clazzMapper.selectById(s.getClassId());
                classNames.put(s.getClassId(), c != null ? c.getName() : null);
            }
            vo.setClassName(classNames.get(s.getClassId()));
            vos.add(vo);
        }
        return vos;
    }
}
