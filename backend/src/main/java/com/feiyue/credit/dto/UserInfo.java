package com.feiyue.credit.dto;

import lombok.Data;

@Data
public class UserInfo {
    private Long id;
    private String username;
    private String realName;
    private String role;
    private Long classId;
}
