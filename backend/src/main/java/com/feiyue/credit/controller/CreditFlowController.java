package com.feiyue.credit.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.feiyue.credit.common.Result;
import com.feiyue.credit.dto.CreditFlowVO;
import com.feiyue.credit.service.CreditFlowService;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;

/** 积分流水：分页查询，支持学生/班级、时间范围、流水类型筛选（行级隔离）。 */
@RestController
@RequestMapping("/credit-flow")
@RequiredArgsConstructor
public class CreditFlowController {

    private final CreditFlowService creditFlowService;

    @Operation(summary = "分页查询积分流水（行级隔离，支持学生/班级、时间范围、流水类型筛选）")
    @GetMapping
    public Result<IPage<CreditFlowVO>> page(
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) Long classId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime start,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime end,
            @RequestParam(required = false) String flowType,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size) {
        return Result.ok(creditFlowService.page(userId, classId, start, end, flowType, page, size));
    }
}
