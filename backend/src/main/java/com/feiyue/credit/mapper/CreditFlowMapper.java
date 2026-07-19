package com.feiyue.credit.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.feiyue.credit.dto.CreditDaily;
import com.feiyue.credit.dto.CreditFlowVO;
import com.feiyue.credit.entity.CreditFlow;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDateTime;
import java.util.List;

@Mapper
public interface CreditFlowMapper extends BaseMapper<CreditFlow> {

    /**
     * 分页查询积分流水，并关联学生姓名 / 任务标题。
     * 支持按 学生(user_id) 或 班级(class_id) 过滤，以及时间范围与流水类型筛选（参数可空）。
     */
    @Select({
            "<script>",
            "SELECT cf.id AS id, cf.user_id AS userId, cf.task_id AS taskId, cf.credit_change AS creditChange, ",
            "cf.flow_type AS flowType, cf.create_time AS createTime, s.name AS studentName, t.title AS taskTitle ",
            "FROM credit_flow cf ",
            "LEFT JOIN student s ON cf.user_id = s.id ",
            "LEFT JOIN task t ON cf.task_id = t.id ",
            "WHERE 1=1 ",
            "<if test='userId != null'> AND cf.user_id = #{userId}</if>",
            "<if test='classId != null'> AND s.class_id = #{classId}</if>",
            "<if test='start != null'> AND cf.create_time &gt;= #{start}</if>",
            "<if test='end != null'> AND cf.create_time &lt;= #{end}</if>",
            "<if test='flowType != null'> AND cf.flow_type = #{flowType}</if>",
            "ORDER BY cf.create_time DESC",
            "</script>"
    })
    IPage<CreditFlowVO> selectVoPage(IPage<CreditFlowVO> page,
                                     @Param("userId") Long userId,
                                     @Param("classId") Long classId,
                                     @Param("start") LocalDateTime start,
                                     @Param("end") LocalDateTime end,
                                     @Param("flowType") String flowType);

    /** 某班级按日累计的学分变动汇总（供看板学分趋势）。 */
    @Select("SELECT DATE_FORMAT(cf.create_time,'%Y-%m-%d') AS day, SUM(cf.credit_change) AS daily " +
            "FROM credit_flow cf JOIN student s ON cf.user_id = s.id " +
            "WHERE s.class_id = #{classId} GROUP BY DATE_FORMAT(cf.create_time,'%Y-%m-%d') ORDER BY day")
    List<CreditDaily> selectDailyCreditByClass(@Param("classId") Long classId);
}
