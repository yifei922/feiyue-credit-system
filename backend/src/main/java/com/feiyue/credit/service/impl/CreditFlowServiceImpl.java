package com.feiyue.credit.service.impl;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.core.metadata.Page;
import com.feiyue.credit.common.SecurityUtils;
import com.feiyue.credit.dto.CreditFlowVO;
import com.feiyue.credit.mapper.CreditFlowMapper;
import com.feiyue.credit.service.CreditFlowService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

/** 积分流水服务实现：分页 + 行级隔离 + 多条件筛选。 */
@Service
@RequiredArgsConstructor
public class CreditFlowServiceImpl implements CreditFlowService {

    private final CreditFlowMapper creditFlowMapper;

    @Override
    public IPage<CreditFlowVO> page(Long userId, Long classId, LocalDateTime start,
                                    LocalDateTime end, String flowType, int page, int size) {
        // 行级隔离：非 ADMIN 强制本班（userId 给定时同时受班级约束，避免越权查他人）
        Long effClass = SecurityUtils.resolveClassId(classId);
        IPage<CreditFlowVO> p = new Page<>(page, size);
        return creditFlowMapper.selectVoPage(p, userId, effClass, start, end, flowType);
    }
}
