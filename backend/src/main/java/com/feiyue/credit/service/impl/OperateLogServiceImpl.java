package com.feiyue.credit.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.feiyue.credit.common.SecurityUtils;
import com.feiyue.credit.dto.OperateLogQueryRequest;
import com.feiyue.credit.dto.OperateLogVO;
import com.feiyue.credit.entity.OperateLog;
import com.feiyue.credit.mapper.OperateLogMapper;
import com.feiyue.credit.service.OperateLogService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.stream.Collectors;

/**
 * 操作日志实现：将 before/after 序列化为 JSON 存入 operate_log，便于审计追踪。
 */
@Service
@RequiredArgsConstructor
public class OperateLogServiceImpl implements OperateLogService {

    private final OperateLogMapper operateLogMapper;
    private final ObjectMapper objectMapper;

    @Override
    public void log(String operateType, String tableName, Long recordId, Object before, Object after) {
        OperateLog log = new OperateLog();
        // 操作人取当前登录用户（定时任务等无登录上下文的调用方不应经过此方法）
        log.setOperatorId(SecurityUtils.currentUserId());
        log.setOperatorName(SecurityUtils.currentUser().getUser().getRealName());
        log.setOperateType(operateType);
        log.setTableName(tableName);
        log.setRecordId(recordId);
        log.setBeforeSnapshot(toJson(before));
        log.setAfterSnapshot(toJson(after));
        operateLogMapper.insert(log);
    }

    private String toJson(Object obj) {
        if (obj == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            return obj.toString();
        }
    }

    /**
     * 分页查询操作日志：拼接 operate_type 精确匹配、operator_name 模糊、create_time 区间条件，
     * 并将每条 Entity 映射为 VO（before/after 直接取 JSON 字段字符串）。
     */
    @Override
    public Page<OperateLogVO> query(OperateLogQueryRequest req) {
        int pageNum = req.getPageNum() == null ? 1 : req.getPageNum();
        int pageSize = req.getPageSize() == null ? 10 : req.getPageSize();
        Page<OperateLog> page = new Page<>(pageNum, pageSize);

        QueryWrapper<OperateLog> qw = new QueryWrapper<>();
        if (StringUtils.hasText(req.getOperateType())) {
            qw.eq("operate_type", req.getOperateType());
        }
        if (StringUtils.hasText(req.getOperatorName())) {
            qw.like("operator_name", req.getOperatorName());
        }
        if (req.getStartTime() != null && req.getEndTime() != null) {
            qw.between("create_time", req.getStartTime(), req.getEndTime());
        } else if (req.getStartTime() != null) {
            qw.ge("create_time", req.getStartTime());
        } else if (req.getEndTime() != null) {
            qw.le("create_time", req.getEndTime());
        }
        qw.orderByDesc("create_time");

        operateLogMapper.selectPage(page, qw);

        Page<OperateLogVO> voPage = new Page<>(page.getCurrent(), page.getSize(), page.getTotal());
        voPage.setRecords(page.getRecords().stream().map(this::toVo).collect(Collectors.toList()));
        return voPage;
    }

    /** 将实体映射为 VO（JSON 快照字段直接透传字符串）。 */
    private OperateLogVO toVo(OperateLog log) {
        OperateLogVO vo = new OperateLogVO();
        vo.setId(log.getId());
        vo.setOperatorName(log.getOperatorName());
        vo.setOperateType(log.getOperateType());
        vo.setTableName(log.getTableName());
        vo.setRecordId(log.getRecordId());
        vo.setBeforeSnapshot(log.getBeforeSnapshot());
        vo.setAfterSnapshot(log.getAfterSnapshot());
        vo.setCreateTime(log.getCreateTime());
        return vo;
    }
}
