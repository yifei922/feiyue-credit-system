package com.feiyue.credit.config;

import com.feiyue.credit.entity.SysUser;
import com.feiyue.credit.mapper.SysUserMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 启动时为数据库注入默认账号（BCrypt 加密，口令 123456）。
 * 仅在账号不存在时创建，幂等且不会覆盖已有数据。
 * 生产环境上线后请尽快修改默认口令。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final SysUserMapper sysUserMapper;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        List<SysUser> defaults = List.of(
            build("teacher01", "王老师", "TEACHER", 10L),
            build("rep01", "科代表小李", "REP", 10L),
            build("admin", "管理员", "ADMIN", null)
        );
        for (SysUser u : defaults) {
            if (sysUserMapper.selectByUsername(u.getUsername()) == null) {
                sysUserMapper.insert(u);
                log.info("已创建默认账号: {}", u.getUsername());
            }
        }
        log.warn("默认账号（teacher01 / rep01 / admin）口令均为 123456，生产环境请立即修改！");
    }

    private SysUser build(String username, String realName, String role, Long classId) {
        SysUser u = new SysUser();
        u.setUsername(username);
        u.setPassword(passwordEncoder.encode("123456"));
        u.setRealName(realName);
        u.setRole(role);
        u.setClassId(classId);
        return u;
    }
}
