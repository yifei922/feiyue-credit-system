package com.feiyue.credit.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("sys_user")
public class SysUser {
    private Long id;
    private String username;
    private String password;
    private String realName;
    /** TEACHER / REP / ADMIN */
    private String role;
    private Long classId;
    private LocalDateTime createTime;
}
