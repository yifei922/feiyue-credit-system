package com.feiyue.credit.service;

import com.feiyue.credit.dto.LoginRequest;
import com.feiyue.credit.dto.LoginResponse;
import com.feiyue.credit.dto.UserInfo;

public interface AuthService {
    LoginResponse login(LoginRequest request);

    UserInfo me();
}
