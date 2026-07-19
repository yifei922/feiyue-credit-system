package com.feiyue.credit.dto;

import lombok.Data;

/** 按日学分变动汇总映射（看板学分趋势用）。 */
@Data
public class CreditDaily {

    /** 日期字符串 yyyy-MM-dd */
    private String day;
    /** 当日学分变动合计（Long，避免 SUM 类型转换问题） */
    private Long daily;
}
