package com.feiyue.credit.dto;

import lombok.Data;

@Data
public class LoginResponse {
    private String token;
    private UserInfo user;
}
