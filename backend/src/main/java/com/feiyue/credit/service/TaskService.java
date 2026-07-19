package com.feiyue.credit.service;

import com.feiyue.credit.dto.TaskDTO;
import com.feiyue.credit.entity.Task;
import com.feiyue.credit.entity.TaskTemplate;

import java.util.List;

/** 任务服务：列表查询（班级行级隔离）、创建、从模板创建、另存为模板、更新、删除。 */
public interface TaskService {

    /** 按班级查询任务列表；classId 为空且当前用户为 ADMIN 时返回全部。 */
    List<Task> list(Long classId);

    /** 创建任务；templateId 非空时复制模板字段；行级隔离强制班级。 */
    Task create(TaskDTO dto);

    /** 更新任务（记录前后快照）。 */
    Task update(Long id, TaskDTO dto);

    /** 删除任务（记录操作日志）。 */
    void delete(Long id);

    /** 将已有任务另存为模板。 */
    TaskTemplate saveAsTemplate(Long taskId, Long operatorId);
}
