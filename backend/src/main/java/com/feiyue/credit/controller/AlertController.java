package com.feiyue.credit.controller;

import com.feiyue.credit.common.Result;
import com.feiyue.credit.dto.AlertVO;
import com.feiyue.credit.service.AlertService;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** 预警中心：教师查询本班预警、手动触发扫描、标记已处理。 */
@RestController
@RequestMapping("/alerts")
@RequiredArgsConstructor
public class AlertController {

    private final AlertService alertService;

    @Operation(summary = "按班级查询预警列表（行级隔离）")
    @GetMapping
    public Result<List<AlertVO>> listByClass(@RequestParam(required = false) Long classId) {
        return Result.ok(alertService.listByClass(classId));
    }

    @Operation(summary = "手动触发预警扫描（定时任务每天凌晨也会执行）")
    @PostMapping("/scan")
    public Result<Void> scan() {
        alertService.scanAndGenerate();
        return Result.ok();
    }

    @Operation(summary = "标记预警为已处理（RESOLVED）")
    @PostMapping("/{id}/resolve")
    public Result<Void> resolve(@PathVariable Long id) {
        alertService.resolve(id);
        return Result.ok();
    }
}
