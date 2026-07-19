package com.feiyue.credit.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * 调度配置：开启 Spring 定时任务（@Scheduled）。
 * AlertService 中的扫描逻辑用 cron = "0 0 1 * * ?" 每天凌晨执行。
 */
@Configuration
@EnableScheduling
public class SchedulerConfig {
}
