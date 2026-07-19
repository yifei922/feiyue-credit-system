package com.feiyue.credit.controller;

import com.feiyue.credit.common.Result;
import com.feiyue.credit.dto.RecommendVO;
import com.feiyue.credit.service.RecommendService;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** 补修推荐：为学生或班级推荐待补修任务。 */
@RestController
@RequestMapping("/recommend")
@RequiredArgsConstructor
public class RecommendController {

    private final RecommendService recommendService;

    @Operation(summary = "为学生推荐待补修任务（targetCredits 用于判断学分缺口）")
    @GetMapping("/student")
    public Result<List<RecommendVO>> forStudent(@RequestParam Long studentId,
                                                @RequestParam(required = false) Integer targetCredits) {
        return Result.ok(recommendService.forStudent(studentId, targetCredits));
    }

    @Operation(summary = "按班级取有预警学生的补修任务集合")
    @GetMapping("/class")
    public Result<List<RecommendVO>> forClass(@RequestParam(required = false) Long classId) {
        return Result.ok(recommendService.forClass(classId));
    }
}
