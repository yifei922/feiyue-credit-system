package com.feiyue.credit.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.feiyue.credit.dto.CompletionRecordVO;
import com.feiyue.credit.dto.CompletionStatusCount;
import com.feiyue.credit.entity.CompletionRecord;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDateTime;
import java.util.List;

@Mapper
public interface CompletionRecordMapper extends BaseMapper<CompletionRecord> {

    /** 某学生某科目的完成记录（命中 idx_cr_subject_student）。 */
    @Select("SELECT * FROM completion_record WHERE student_id = #{studentId} AND subject_id = #{subjectId}")
    List<CompletionRecord> selectByStudentAndSubject(@Param("studentId") Long studentId,
                                                      @Param("subjectId") Long subjectId);

    /** 某班级全部完成记录，关联 task 仅用于按班级过滤，按 学生->任务 顺序返回（供连续未完成扫描）。 */
    @Select("SELECT cr.* FROM completion_record cr JOIN task t ON cr.task_id = t.id " +
            "WHERE t.class_id = #{classId} ORDER BY cr.student_id, t.id")
    List<CompletionRecord> selectByClassWithTask(@Param("classId") Long classId);

    /** 临近截止（deadline 落在 [start, end]）且仍为未完成的记录。 */
    @Select("SELECT cr.* FROM completion_record cr JOIN task t ON cr.task_id = t.id " +
            "WHERE t.class_id = #{classId} AND cr.status = 'UNFINISHED' " +
            "AND t.deadline BETWEEN #{start} AND #{end}")
    List<CompletionRecord> selectUnfinishedDueSoon(@Param("classId") Long classId,
                                                    @Param("start") LocalDateTime start,
                                                    @Param("end") LocalDateTime end);

    /** 某任务下所有完成记录，并携带学生姓名与任务标题。 */
    @Select("SELECT cr.*, s.name AS studentName, t.title AS taskTitle " +
            "FROM completion_record cr " +
            "LEFT JOIN student s ON cr.student_id = s.id " +
            "LEFT JOIN task t ON cr.task_id = t.id " +
            "WHERE cr.task_id = #{taskId} ORDER BY cr.student_id")
    List<CompletionRecordVO> selectVoByTask(@Param("taskId") Long taskId);

    /** 某班级各科目完成状态计数（供看板完成率 / 状态分布）。 */
    @Select("SELECT cr.subject_id AS subjectId, cr.status AS status, COUNT(*) AS cnt " +
            "FROM completion_record cr JOIN task t ON cr.task_id = t.id " +
            "WHERE t.class_id = #{classId} GROUP BY cr.subject_id, cr.status")
    List<CompletionStatusCount> selectStatusCountByClass(@Param("classId") Long classId);

    /** 某状态下各完成明细（下钻用），携带任务/科目/学生名称。 */
    @Select("SELECT t.id AS taskId, t.title AS taskTitle, sub.name AS subjectName, " +
            "cr.student_id AS studentId, s.name AS studentName, " +
            "cr.status AS status, cr.completion_time AS completionTime, cr.credit_change AS creditChange " +
            "FROM completion_record cr " +
            "JOIN task t ON cr.task_id = t.id " +
            "LEFT JOIN subject sub ON t.subject_id = sub.id " +
            "LEFT JOIN student s ON cr.student_id = s.id " +
            "WHERE t.class_id = #{classId} AND cr.status = #{status} " +
            "ORDER BY t.id, cr.student_id")
    List<com.feiyue.credit.dto.DashboardVO.StatusDrillDownVO> selectStatusDrillDown(
            @Param("classId") Long classId, @Param("status") String status);
}
