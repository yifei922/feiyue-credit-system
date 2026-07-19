package com.feiyue.credit.service.impl;

import com.feiyue.credit.common.BizException;
import com.feiyue.credit.dto.LoginRequest;
import com.feiyue.credit.dto.LoginResponse;
import com.feiyue.credit.dto.UserInfo;
import com.feiyue.credit.entity.SysUser;
import com.feiyue.credit.mapper.SysUserMapper;
import com.feiyue.credit.security.JwtUtil;
import com.feiyue.credit.security.SecurityUser;
import com.feiyue.credit.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final AuthenticationManager authenticationManager;
    private final JwtUtil jwtUtil;
    private final SysUserMapper sysUserMapper;

    @Override
    public LoginResponse login(LoginRequest request) {
        Authentication auth = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword()));
        SecurityUser securityUser = (SecurityUser) auth.getPrincipal();
        SysUser user = securityUser.getUser();
        String token = jwtUtil.generateToken(user.getUsername(), user.getRole(), user.getClassId());

        LoginResponse resp = new LoginResponse();
        resp.setToken(token);
        resp.setUser(toInfo(user));
        return resp;
    }

    @Override
    public UserInfo me() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof SecurityUser su)) {
            throw new BizException(401, "未登录");
        }
        return toInfo(su.getUser());
    }

    private UserInfo toInfo(SysUser u) {
        UserInfo info = new UserInfo();
        info.setId(u.getId());
        info.setUsername(u.getUsername());
        info.setRealName(u.getRealName());
        info.setRole(u.getRole());
        info.setClassId(u.getClassId());
        return info;
    }
}
