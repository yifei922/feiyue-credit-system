package com.feiyue.credit.service;

import com.feiyue.credit.common.BizException;
import com.feiyue.credit.common.SecurityUtils;
import com.feiyue.credit.dto.CompletionRegisterRequest;
import com.feiyue.credit.entity.CompletionRecord;
import com.feiyue.credit.entity.CreditFlow;
import com.feiyue.credit.entity.Student;
import com.feiyue.credit.entity.Task;
import com.feiyue.credit.mapper.CompletionRecordMapper;
import com.feiyue.credit.mapper.CreditFlowMapper;
import com.feiyue.credit.mapper.StudentMapper;
import com.feiyue.credit.mapper.TaskMapper;
import com.feiyue.credit.service.OperateLogService;
import com.feiyue.credit.service.impl.CompletionServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

/**
 * CompletionServiceImpl.register 单元测试（纯 Mockito，不加载 Spring 上下文）。
 * 通过 mockStatic 屏蔽 SecurityUtils 的行级隔离/当前用户，聚焦学分计算与 delta 逻辑。
 */
@ExtendWith(MockitoExtension.class)
class CompletionServiceTest {

    private final CompletionRecordMapper completionRecordMapper = mock(CompletionRecordMapper.class);
    private final TaskMapper taskMapper = mock(TaskMapper.class);
    private final StudentMapper studentMapper = mock(StudentMapper.class);
    private final CreditFlowMapper creditFlowMapper = mock(CreditFlowMapper.class);
    private final OperateLogService operateLogService = mock(OperateLogService.class);

    private final CompletionServiceImpl service = new CompletionServiceImpl(
            completionRecordMapper, taskMapper, studentMapper, creditFlowMapper, operateLogService);

    /** 构造一个任务：creditValue 学分、指定类型。 */
    private Task task(long id, int creditValue, String type) {
        Task t = new Task();
        t.setId(id);
        t.setClassId(1L);
        t.setCreditValue(creditValue);
        t.setType(type);
        return t;
    }

    /** 构造请求：单学生、指定状态。 */
    private CompletionRegisterRequest req(long taskId, long studentId, String status) {
        CompletionRegisterRequest r = new CompletionRegisterRequest();
        r.setTaskId(taskId);
        r.setStudentIds(Collections.singletonList(studentId));
        r.setStatus(status);
        return r;
    }

    /** 提供一个初始 totalCredits 的学生，并通过累加器模拟 DB 行在多次更新间的累计效果。 */
    private void stubStudent(long id, int initialTotal) {
        AtomicInteger acc = new AtomicInteger(initialTotal);
        when(studentMapper.selectById(id)).thenAnswer(inv -> {
            Student s = new Student();
            s.setId((Long) inv.getArgument(0));
            s.setTotalCredits(acc.get());
            return s;
        });
        doAnswer(inv -> {
            Student s = (Student) inv.getArgument(0);
            acc.set(s.getTotalCredits());
            return null;
        }).when(studentMapper).updateById(any());
    }

    /** 用 mockStatic 屏蔽 SecurityUtils：ADMIN 视角（resolveClassId 返回 null 不拦截），当前用户 1。 */
    private MockedStatic<SecurityUtils> mockSecurity() {
        MockedStatic<SecurityUtils> ms = mockStatic(SecurityUtils.class);
        ms.when(() -> SecurityUtils.resolveClassId(any())).thenReturn(null);
        ms.when(SecurityUtils::currentUserId).thenReturn(1L);
        return ms;
    }

    @Test
    void doneOntime_满分入账() {
        Task t = task(10L, 10, "HOMEWORK");
        when(taskMapper.selectById(10L)).thenReturn(t);
        when(completionRecordMapper.selectOne(any())).thenReturn(null);
        stubStudent(1L, 100);

        try (MockedStatic<SecurityUtils> ms = mockSecurity()) {
            int affected = service.register(req(10L, 1L, "DONE_ONTIME"));
            assertEquals(1, affected);
        }

        // completion_record 插入 1 条
        verify(completionRecordMapper, times(1)).insert(any(CompletionRecord.class));
        // credit_flow 插入 1 条，creditChange = creditValue = 10
        ArgumentCaptor<CreditFlow> flowCap = ArgumentCaptor.forClass(CreditFlow.class);
        verify(creditFlowMapper, times(1)).insert(flowCap.capture());
        assertEquals(10, flowCap.getValue().getCreditChange());
        assertEquals("HOMEWORK_DONE", flowCap.getValue().getFlowType());
        // student.total_credits += 10 => 100 + 10 = 110
        ArgumentCaptor<Student> stuCap = ArgumentCaptor.forClass(Student.class);
        verify(studentMapper, times(1)).updateById(stuCap.capture());
        assertEquals(110, stuCap.getValue().getTotalCredits());
        // 操作日志记一次
        verify(operateLogService, times(1)).log(eq("INSERT"), any(), any(), any(), any());
    }

    @Test
    void doneOverdue_满分一半向下取整() {
        // creditValue=11 -> floor(11*0.5)=5
        Task t = task(11L, 11, "HOMEWORK");
        when(taskMapper.selectById(11L)).thenReturn(t);
        when(completionRecordMapper.selectOne(any())).thenReturn(null);
        stubStudent(2L, 0);

        try (MockedStatic<SecurityUtils> ms = mockSecurity()) {
            service.register(req(11L, 2L, "DONE_OVERDUE"));
        }

        ArgumentCaptor<CreditFlow> flowCap = ArgumentCaptor.forClass(CreditFlow.class);
        verify(creditFlowMapper, times(1)).insert(flowCap.capture());
        assertEquals(5, flowCap.getValue().getCreditChange());
        assertEquals("OVERDUE_DEDUCT", flowCap.getValue().getFlowType());
        ArgumentCaptor<Student> stuCap = ArgumentCaptor.forClass(Student.class);
        verify(studentMapper, times(1)).updateById(stuCap.capture());
        assertEquals(5, stuCap.getValue().getTotalCredits());
    }

    @Test
    void unfinished_不加分不写流水() {
        Task t = task(12L, 10, "HOMEWORK");
        when(taskMapper.selectById(12L)).thenReturn(t);
        when(completionRecordMapper.selectOne(any())).thenReturn(null);
        stubStudent(3L, 50);

        try (MockedStatic<SecurityUtils> ms = mockSecurity()) {
            service.register(req(12L, 3L, "UNFINISHED"));
        }

        // 仅写入 completion_record，不写 credit_flow、不改 total_credits
        verify(completionRecordMapper, times(1)).insert(any(CompletionRecord.class));
        verify(creditFlowMapper, never()).insert(any());
        verify(studentMapper, never()).updateById(any());
    }

    @Test
    void repeatedRegister_delta回退() {
        Task t = task(13L, 10, "BACKING");
        when(taskMapper.selectById(13L)).thenReturn(t);

        // 首次：无旧记录 -> DONE_ONTIME 得 10
        // 再次：旧记录 creditChange=10 -> DONE_OVERDUE 得 5，delta = 5 - 10 = -5
        CompletionRecord existing = new CompletionRecord();
        existing.setId(99L);
        existing.setCreditChange(10);
        when(completionRecordMapper.selectOne(any())).thenReturn(null).thenReturn(existing);
        stubStudent(4L, 100);

        try (MockedStatic<SecurityUtils> ms = mockSecurity()) {
            service.register(req(13L, 4L, "DONE_ONTIME"));
            service.register(req(13L, 4L, "DONE_OVERDUE"));
        }

        // 第一次 insert 记录、第二次 update 记录
        verify(completionRecordMapper, times(1)).insert(any(CompletionRecord.class));
        verify(completionRecordMapper, times(1)).updateById(any(CompletionRecord.class));
        // 两次各写一条流水：+10 与 -5
        ArgumentCaptor<CreditFlow> flowCap = ArgumentCaptor.forClass(CreditFlow.class);
        verify(creditFlowMapper, times(2)).insert(flowCap.capture());
        assertEquals(10, flowCap.getAllValues().get(0).getCreditChange());
        assertEquals("BACKING_DONE", flowCap.getAllValues().get(0).getFlowType());
        assertEquals(-5, flowCap.getAllValues().get(1).getCreditChange());
        assertEquals("OVERDUE_DEDUCT", flowCap.getAllValues().get(1).getFlowType());
        // 学生累计：100 + 10 - 5 = 105
        ArgumentCaptor<Student> stuCap = ArgumentCaptor.forClass(Student.class);
        verify(studentMapper, times(2)).updateById(stuCap.capture());
        assertEquals(105, stuCap.getAllValues().get(1).getTotalCredits());
    }

    @Test
    void taskNotFound_抛BizException() {
        when(taskMapper.selectById(99L)).thenReturn(null);
        try (MockedStatic<SecurityUtils> ms = mockSecurity()) {
            try {
                service.register(req(99L, 1L, "DONE_ONTIME"));
                org.junit.jupiter.api.Assertions.fail("应抛出 BizException");
            } catch (BizException e) {
                assertEquals(404, e.getCode());
            }
        }
        verify(completionRecordMapper, never()).insert(any());
    }
}
