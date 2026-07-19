package com.feiyue.credit.controller;

import com.feiyue.credit.common.Result;
import com.feiyue.credit.dto.DashboardVO;
import com.feiyue.credit.service.DashboardService;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** 数据看板：班级概览与两类下钻。 */
@RestController
@RequestMapping("/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    @Operation(summary = "班级概览：各科目完成率 / 任务状态分布 / 学分趋势")
    @GetMapping("/overview")
    public Result<DashboardVO> overview(@RequestParam(required = false) Long classId) {
        return Result.ok(dashboardService.overview(classId));
    }

    @Operation(summary = "下钻：某科目下各任务及完成学生明细")
    @GetMapping("/subject")
    public Result<DashboardVO.SubjectDrillDownVO> drillDownSubject(@RequestParam Long classId,
                                                                   @RequestParam Long subjectId) {
        return Result.ok(dashboardService.drillDownSubject(classId, subjectId));
    }

    @Operation(summary = "下钻：某状态下各完成明细（UNFINISHED/DONE_ONTIME/DONE_OVERDUE/FAILED）")
    @GetMapping("/status")
    public Result<List<DashboardVO.StatusDrillDownVO>> drillDownStatus(@RequestParam Long classId,
                                                                       @RequestParam String status) {
        return Result.ok(dashboardService.drillDownStatus(classId, status));
    }
}
