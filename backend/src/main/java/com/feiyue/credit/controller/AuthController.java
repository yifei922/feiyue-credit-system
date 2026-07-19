package com.feiyue.credit.controller;

import com.feiyue.credit.common.Result;
import com.feiyue.credit.dto.LoginRequest;
import com.feiyue.credit.dto.LoginResponse;
import com.feiyue.credit.dto.UserInfo;
import com.feiyue.credit.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public Result<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        return Result.ok(authService.login(request));
    }

    @GetMapping("/me")
    public Result<UserInfo> me() {
        return Result.ok(authService.me());
    }
}
