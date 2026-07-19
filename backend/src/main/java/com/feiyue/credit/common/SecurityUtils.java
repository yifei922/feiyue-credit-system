package com.feiyue.credit.common;

import com.feiyue.credit.security.SecurityUser;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * 安全上下文工具：从 SecurityContext 取当前登录用户（SecurityUser）与行级隔离所需的班级/角色。
 */
public class SecurityUtils {

    /** 取当前登录用户主体，未登录抛 BizException(401)。 */
    public static SecurityUser currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof SecurityUser su)) {
            throw new BizException(401, "未登录");
        }
        return su;
    }

    public static Long currentUserId() {
        return currentUser().getUser().getId();
    }

    public static String currentRole() {
        return currentUser().getUser().getRole();
    }

    public static Long currentClassId() {
        return currentUser().getUser().getClassId();
    }

    /**
     * 行级权限解析：
     * - ADMIN 可使用入参 classId（为 null 表示查全部班级）；
     * - TEACHER / REP 忽略入参，强制使用自身所属 classId。
     */
    public static Long resolveClassId(Long requested) {
        if ("ADMIN".equals(currentRole())) {
            return requested;
        }
        return currentClassId();
    }
}
