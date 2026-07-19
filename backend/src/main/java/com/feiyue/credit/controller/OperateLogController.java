package com.feiyue.credit.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.feiyue.credit.common.Result;
import com.feiyue.credit.dto.OperateLogQueryRequest;
import com.feiyue.credit.dto.OperateLogVO;
import com.feiyue.credit.service.OperateLogService;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 操作日志查询（审计）：需登录，沿用现有 JWT 过滤器，无需额外放行。 */
@RestController
@RequestMapping("/operate-logs")
@RequiredArgsConstructor
public class OperateLogController {

    private final OperateLogService operateLogService;

    @Operation(summary = "分页查询操作日志（按操作类型/操作人/时间区间筛选）")
    @GetMapping
    public Result<Page<OperateLogVO>> query(@ModelAttribute OperateLogQueryRequest req) {
        return Result.ok(operateLogService.query(req));
    }
}
