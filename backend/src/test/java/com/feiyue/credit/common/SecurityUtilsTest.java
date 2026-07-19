package com.feiyue.credit.common;

import com.feiyue.credit.entity.SysUser;
import com.feiyue.credit.security.SecurityUser;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * SecurityUtils.resolveClassId 行级隔离单元测试（不加载 Spring，直接构造 SecurityContext）。
 */
class SecurityUtilsTest {

    @BeforeEach
    void setUp() {
        // 每个用例前清空上下文，避免互相污染
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    /** 把指定角色/班级的用户放入 SecurityContext。 */
    private void loginAs(String role, Long classId) {
        SysUser user = new SysUser();
        user.setId(1L);
        user.setRole(role);
        user.setClassId(classId);
        SecurityUser su = new SecurityUser(user);
        SecurityContext ctx = SecurityContextHolder.createEmptyContext();
        ctx.setAuthentication(new UsernamePasswordAuthenticationToken(su, null, su.getAuthorities()));
        SecurityContextHolder.setContext(ctx);
    }

    @Test
    void admin_返回入参含null() {
        loginAs("ADMIN", 7L);
        // ADMIN 可使用入参 classId
        assertEquals(99L, SecurityUtils.resolveClassId(99L));
        // 入参为 null 表示查全部
        assertNull(SecurityUtils.resolveClassId(null));
    }

    @Test
    void teacher_强制返回自身班级忽略入参() {
        loginAs("TEACHER", 5L);
        // 忽略请求参数，强制返回自身 classId
        assertEquals(5L, SecurityUtils.resolveClassId(99L));
        assertEquals(5L, SecurityUtils.resolveClassId(null));
    }

    @Test
    void rep_强制返回自身班级忽略入参() {
        loginAs("REP", 8L);
        assertEquals(8L, SecurityUtils.resolveClassId(123L));
    }
}
