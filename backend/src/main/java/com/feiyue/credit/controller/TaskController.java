package com.feiyue.credit.controller;

import com.feiyue.credit.common.Result;
import com.feiyue.credit.dto.TaskDTO;
import com.feiyue.credit.entity.Task;
import com.feiyue.credit.entity.TaskTemplate;
import com.feiyue.credit.service.TaskService;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** 任务管理：列表、创建、从模板创建、另存为模板、更新、删除。 */
@RestController
@RequestMapping("/tasks")
@RequiredArgsConstructor
public class TaskController {

    private final TaskService taskService;

    @Operation(summary = "按班级查询任务列表（教师/科代表仅看本班）")
    @GetMapping
    public Result<List<Task>> list(@RequestParam(required = false) Long classId) {
        return Result.ok(taskService.list(classId));
    }

    @Operation(summary = "创建任务（templateId 非空则复制模板字段，行级隔离强制班级）")
    @PostMapping
    public Result<Task> create(@Valid @RequestBody TaskDTO dto) {
        return Result.ok(taskService.create(dto));
    }

    @Operation(summary = "更新任务（记录修改前后快照）")
    @PutMapping("/{id}")
    public Result<Task> update(@PathVariable Long id, @Valid @RequestBody TaskDTO dto) {
        return Result.ok(taskService.update(id, dto));
    }

    @Operation(summary = "删除任务（记录操作日志）")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        taskService.delete(id);
        return Result.ok();
    }

    @Operation(summary = "将已有任务另存为模板")
    @PostMapping("/{id}/save-as-template")
    public Result<TaskTemplate> saveAsTemplate(@PathVariable Long id,
                                               @RequestParam(required = false) Long operatorId) {
        return Result.ok(taskService.saveAsTemplate(id, operatorId));
    }
}
