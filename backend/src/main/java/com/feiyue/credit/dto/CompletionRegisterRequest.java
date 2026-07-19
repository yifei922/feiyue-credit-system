package com.feiyue.credit.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

/** 登记任务完成情况的入参（支持批量学生）。 */
@Data
public class CompletionRegisterRequest {

    @NotNull(message = "任务ID不能为空")
    private Long taskId;

    /** 批量登记的学生 ID 列表。 */
    @NotEmpty(message = "学生列表不能为空")
    private List<Long> studentIds;

    /** UNFINISHED / DONE_ONTIME / DONE_OVERDUE / FAILED */
    @NotBlank(message = "完成状态不能为空")
    private String status;

    /** 操作人（sys_user.id），为空时取当前登录用户。 */
    private Long operatorId;
}
