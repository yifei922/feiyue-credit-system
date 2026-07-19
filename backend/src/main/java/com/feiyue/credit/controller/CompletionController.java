package com.feiyue.credit.controller;

import com.feiyue.credit.common.Result;
import com.feiyue.credit.dto.CompletionRecordVO;
import com.feiyue.credit.dto.CompletionRegisterRequest;
import com.feiyue.credit.service.CompletionService;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** 完成登记：批量登记完成情况（核心事务），并按任务查询明细。 */
@RestController
@RequestMapping("/completion")
@RequiredArgsConstructor
public class CompletionController {

    private final CompletionService completionService;

    @Operation(summary = "批量登记完成（upsert 完成记录 + 学分计算 + 写流水/操作日志），返回受影响学生数")
    @PostMapping
    public Result<Integer> register(@Valid @RequestBody CompletionRegisterRequest request) {
        return Result.ok(completionService.register(request));
    }

    @Operation(summary = "查询某任务下所有完成记录（含学生姓名/任务标题）")
    @GetMapping("/task/{taskId}")
    public Result<List<CompletionRecordVO>> listByTask(@PathVariable Long taskId) {
        return Result.ok(completionService.listByTask(taskId));
    }
}
