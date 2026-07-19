package com.feiyue.credit.service;

import com.feiyue.credit.entity.Alert;
import com.feiyue.credit.entity.Clazz;
import com.feiyue.credit.entity.CompletionRecord;
import com.feiyue.credit.mapper.AlertMapper;
import com.feiyue.credit.mapper.ClazzMapper;
import com.feiyue.credit.mapper.CompletionRecordMapper;
import com.feiyue.credit.mapper.StudentMapper;
import com.feiyue.credit.service.impl.AlertServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * AlertServiceImpl.scanAndGenerate 单元测试（纯 Mockito）。
 * 聚焦两种预警的生成：CONSECUTIVE_MISS（连续未完成）与 OVERDUE_SOON（临近截止）。
 */
@ExtendWith(MockitoExtension.class)
class AlertServiceTest {

    private final AlertMapper alertMapper = mock(AlertMapper.class);
    private final ClazzMapper clazzMapper = mock(ClazzMapper.class);
    private final CompletionRecordMapper completionRecordMapper = mock(CompletionRecordMapper.class);
    private final StudentMapper studentMapper = mock(StudentMapper.class);

    private final AlertServiceImpl service =
            new AlertServiceImpl(alertMapper, clazzMapper, completionRecordMapper, studentMapper);

    private Clazz clazz(long id) {
        Clazz c = new Clazz();
        c.setId(id);
        return c;
    }

    private CompletionRecord rec(long studentId, String status) {
        CompletionRecord r = new CompletionRecord();
        r.setStudentId(studentId);
        r.setStatus(status);
        return r;
    }

    @Test
    void consecutiveMiss_连续三个未完成生成预警() {
        when(clazzMapper.selectList(null)).thenReturn(Collections.singletonList(clazz(1L)));
        // 同学生连续 3 个 UNFINISHED
        when(completionRecordMapper.selectByClassWithTask(1L)).thenReturn(List.of(
                rec(7L, "UNFINISHED"), rec(7L, "UNFINISHED"), rec(7L, "UNFINISHED")));
        when(completionRecordMapper.selectUnfinishedDueSoon(eq(1L), any(), any()))
                .thenReturn(Collections.emptyList());
        // 尚无同类型 PENDING 预警
        when(alertMapper.selectCount(any())).thenReturn(0L);

        service.scanAndGenerate();

        ArgumentCaptor<Alert> cap = ArgumentCaptor.forClass(Alert.class);
        verify(alertMapper, times(1)).insert(cap.capture());
        assertEquals("CONSECUTIVE_MISS", cap.getValue().getType());
        assertEquals(7L, cap.getValue().getStudentId());
        assertEquals("PENDING", cap.getValue().getStatus());
    }

    @Test
    void overdueSoon_临近截止未完成生成预警() {
        when(clazzMapper.selectList(null)).thenReturn(Collections.singletonList(clazz(1L)));
        // 无连续未完成（不足 3 个）
        when(completionRecordMapper.selectByClassWithTask(1L)).thenReturn(Collections.emptyList());
        // 临近截止且 UNFINISHED
        when(completionRecordMapper.selectUnfinishedDueSoon(eq(1L), any(), any()))
                .thenReturn(Collections.singletonList(rec(8L, "UNFINISHED")));
        when(alertMapper.selectCount(any())).thenReturn(0L);

        service.scanAndGenerate();

        ArgumentCaptor<Alert> cap = ArgumentCaptor.forClass(Alert.class);
        verify(alertMapper, times(1)).insert(cap.capture());
        assertEquals("OVERDUE_SOON", cap.getValue().getType());
        assertEquals(8L, cap.getValue().getStudentId());
    }

    @Test
    void alreadyPending_不重复生成() {
        when(clazzMapper.selectList(null)).thenReturn(Collections.singletonList(clazz(1L)));
        when(completionRecordMapper.selectByClassWithTask(1L)).thenReturn(List.of(
                rec(7L, "UNFINISHED"), rec(7L, "UNFINISHED"), rec(7L, "UNFINISHED")));
        when(completionRecordMapper.selectUnfinishedDueSoon(eq(1L), any(), any()))
                .thenReturn(Collections.emptyList());
        // 已存在 PENDING 预警 -> 不应再插入
        when(alertMapper.selectCount(any())).thenReturn(1L);

        service.scanAndGenerate();

        verify(alertMapper, never()).insert(any());
    }
}
