package com.feiyue.credit.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 数据看板视图对象。
 * 包含：各科目完成率、全班任务状态分布、学分趋势（按日累计），以及两类下钻结构。
 */
@Data
public class DashboardVO {

    /** 各科目完成率 */
    private List<SubjectCompletionRate> subjectCompletionRate;

    /** 全班任务状态分布（四类计数） */
    private StatusDistribution statusDistribution;

    /** 学分趋势（按日累计的 {date, credits} 序列） */
    private List<CreditTrendPoint> creditTrend;

    @Data
    public static class SubjectCompletionRate {
        private String subjectName;
        /** 完成率（0~100，保留两位小数） */
        private Double completionRate;
        private int done;
        private int total;
    }

    @Data
    public static class StatusDistribution {
        private int unfinished;
        private int ontime;
        private int overdue;
        private int failed;
    }

    @Data
    public static class CreditTrendPoint {
        /** 日期 yyyy-MM-dd */
        private String date;
        /** 截至该日的累计学分 */
        private int credits;
    }

    /** 下钻：某科目下各任务及完成学生明细 */
    @Data
    public static class SubjectDrillDownVO {
        private Long subjectId;
        private String subjectName;
        private List<TaskDrillItemVO> tasks;
    }

    @Data
    public static class TaskDrillItemVO {
        private Long taskId;
        private String title;
        private String type;
        private LocalDateTime deadline;
        private Integer creditValue;
        private List<CompletionDetailVO> completions;
    }

    @Data
    public static class CompletionDetailVO {
        private Long studentId;
        private String studentName;
        private String status;
        private LocalDateTime completionTime;
        private Integer creditChange;
    }

    /** 下钻：某状态下各完成明细（任务/科目/学生） */
    @Data
    public static class StatusDrillDownVO {
        private Long taskId;
        private String taskTitle;
        private String subjectName;
        private Long studentId;
        private String studentName;
        private String status;
        private LocalDateTime completionTime;
        private Integer creditChange;
    }
}
