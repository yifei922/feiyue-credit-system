package com.feiyue.credit.controller;

import com.feiyue.credit.common.Result;
import com.feiyue.credit.dto.StudentVO;
import com.feiyue.credit.service.StudentService;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** 学生管理：按班级列表（含班级名称与总学分），行级隔离。 */
@RestController
@RequestMapping("/students")
@RequiredArgsConstructor
public class StudentController {

    private final StudentService studentService;

    @Operation(summary = "按班级查询学生列表（行级隔离；ADMIN 可查全部）")
    @GetMapping
    public Result<List<StudentVO>> list(@RequestParam(required = false) Long classId) {
        return Result.ok(studentService.listByClass(classId));
    }
}
