package com.feiyue.credit.service;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.feiyue.credit.dto.OperateLogQueryRequest;
import com.feiyue.credit.dto.OperateLogVO;

/** 操作日志服务：记录数据修改前后快照，供审计。 */
public interface OperateLogService {

    /**
     * 记录一条操作日志。
     * @param operateType INSERT / UPDATE / DELETE
     * @param tableName   业务表名
     * @param recordId    记录主键
     * @param before      修改前对象（可空）
     * @param after       修改后对象（可空）
     */
    void log(String operateType, String tableName, Long recordId, Object before, Object after);

    /**
     * 分页查询操作日志，支持操作类型、操作人姓名（模糊）、时间区间筛选。
     * @param req 筛选条件（所有字段可选）
     * @return 分页后的 OperateLogVO 列表
     */
    Page<OperateLogVO> query(OperateLogQueryRequest req);
}
