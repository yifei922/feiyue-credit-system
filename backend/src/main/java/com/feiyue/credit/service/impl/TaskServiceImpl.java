package com.feiyue.credit.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.feiyue.credit.common.BizException;
import com.feiyue.credit.common.SecurityUtils;
import com.feiyue.credit.dto.TaskDTO;
import com.feiyue.credit.entity.Task;
import com.feiyue.credit.entity.TaskTemplate;
import com.feiyue.credit.mapper.TaskMapper;
import com.feiyue.credit.mapper.TaskTemplateMapper;
import com.feiyue.credit.service.OperateLogService;
import com.feiyue.credit.service.TaskService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** 任务服务实现：行级隔离、模板复制、操作日志。 */
@Service
@RequiredArgsConstructor
public class TaskServiceImpl implements TaskService {

    private final TaskMapper taskMapper;
    private final TaskTemplateMapper taskTemplateMapper;
    private final OperateLogService operateLogService;

    @Override
    public List<Task> list(Long classId) {
        // 行级隔离：非 ADMIN 强制本班
        Long eff = SecurityUtils.resolveClassId(classId);
        QueryWrapper<Task> w = new QueryWrapper<>();
        if (eff != null) {
            w.eq("class_id", eff);
        }
        w.orderByDesc("create_time");
        return taskMapper.selectList(w);
    }

    @Override
    @Transactional
    public Task create(TaskDTO dto) {
        // 行级隔离：强制班级（ADMIN 可用入参，教师/科代表用自身班级）
        Long eff = SecurityUtils.resolveClassId(dto.getClassId());
        if (eff == null && dto.getClassId() == null) {
            throw new BizException(400, "缺少班级参数");
        }
        Task task = new Task();
        task.setClassId(eff != null ? eff : dto.getClassId());
        task.setSubjectId(dto.getSubjectId());
        task.setTitle(dto.getTitle());
        task.setDeadline(dto.getDeadline());
        task.setStatus(dto.getStatus() != null ? dto.getStatus() : "OPEN");

        // 从模板创建：复制模板字段
        if (dto.getTemplateId() != null) {
            TaskTemplate tpl = taskTemplateMapper.selectById(dto.getTemplateId());
            if (tpl != null) {
                if (tpl.getType() != null) {
                    task.setType(tpl.getType());
                }
                if (tpl.getCreditValue() != null) {
                    task.setCreditValue(tpl.getCreditValue());
                }
                if (tpl.getDescription() != null) {
                    task.setDescription(tpl.getDescription());
                }
                // 标题未提供时默认用模板名称
                if (dto.getTitle() == null || dto.getTitle().isBlank()) {
                    task.setTitle(tpl.getName());
                }
                task.setTemplateId(tpl.getId());
            }
        } else {
            task.setType(dto.getType());
            task.setCreditValue(dto.getCreditValue());
            task.setTemplateId(dto.getTemplateId());
        }
        taskMapper.insert(task);
        operateLogService.log("INSERT", "task", task.getId(), null, task);
        return task;
    }

    @Override
    @Transactional
    public Task update(Long id, TaskDTO dto) {
        Task before = taskMapper.selectById(id);
        if (before == null) {
            throw new BizException(404, "任务不存在");
        }
        // 行级隔离校验：非 ADMIN 仅能操作本班任务
        Long eff = SecurityUtils.resolveClassId(before.getClassId());
        if (eff != null && !eff.equals(before.getClassId())) {
            throw new BizException(403, "无权操作其他班级的任务");
        }
        // 构造更新对象（不污染 before 快照）
        Task updated = new Task();
        updated.setId(id);
        updated.setSubjectId(dto.getSubjectId() != null ? dto.getSubjectId() : before.getSubjectId());
        Long newClass = dto.getClassId() != null ? SecurityUtils.resolveClassId(dto.getClassId()) : before.getClassId();
        updated.setClassId(newClass);
        updated.setTitle(dto.getTitle() != null ? dto.getTitle() : before.getTitle());
        updated.setDescription(dto.getDescription() != null ? dto.getDescription() : before.getDescription());
        updated.setType(dto.getType() != null ? dto.getType() : before.getType());
        updated.setCreditValue(dto.getCreditValue() != null ? dto.getCreditValue() : before.getCreditValue());
        updated.setDeadline(dto.getDeadline() != null ? dto.getDeadline() : before.getDeadline());
        updated.setStatus(dto.getStatus() != null ? dto.getStatus() : before.getStatus());
        updated.setTemplateId(dto.getTemplateId() != null ? dto.getTemplateId() : before.getTemplateId());
        taskMapper.updateById(updated);
        operateLogService.log("UPDATE", "task", id, before, updated);
        return updated;
    }

    @Override
    @Transactional
    public void delete(Long id) {
        Task before = taskMapper.selectById(id);
        if (before == null) {
            throw new BizException(404, "任务不存在");
        }
        Long eff = SecurityUtils.resolveClassId(before.getClassId());
        if (eff != null && !eff.equals(before.getClassId())) {
            throw new BizException(403, "无权操作其他班级的任务");
        }
        taskMapper.deleteById(id);
        operateLogService.log("DELETE", "task", id, before, null);
    }

    @Override
    @Transactional
    public TaskTemplate saveAsTemplate(Long taskId, Long operatorId) {
        Task task = taskMapper.selectById(taskId);
        if (task == null) {
            throw new BizException(404, "任务不存在");
        }
        TaskTemplate tpl = new TaskTemplate();
        tpl.setName(task.getTitle());
        tpl.setSubjectId(task.getSubjectId());
        tpl.setType(task.getType());
        tpl.setCreditValue(task.getCreditValue());
        tpl.setDescription(task.getDescription());
        tpl.setCreatorId(operatorId != null ? operatorId : SecurityUtils.currentUserId());
        taskTemplateMapper.insert(tpl);
        operateLogService.log("INSERT", "task_template", tpl.getId(), null, tpl);
        return tpl;
    }
}
