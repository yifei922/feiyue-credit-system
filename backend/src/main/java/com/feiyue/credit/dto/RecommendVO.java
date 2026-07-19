package com.feiyue.credit.dto;

import lombok.Data;

import java.time.LocalDateTime;

/** 补修任务推荐视图对象。 */
@Data
public class RecommendVO {

    private Long taskId;
    private String title;
    private String subjectName;
    /** HOMEWORK / BACKING / EXAM */
    private String type;
    private Integer creditValue;
    /** 推荐理由：连续未完成 / 临近截止 / 学分缺口 / 待补修 */
    private String reason;
    private Long classId;
    private LocalDateTime deadline;
}
