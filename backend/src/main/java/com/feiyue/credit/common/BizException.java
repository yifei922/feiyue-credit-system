package com.feiyue.credit.common;

/**
 * 业务异常：携带错误码，由全局异常处理统一转换为 Result。
 */
public class BizException extends RuntimeException {
    private final int code;

    public BizException(int code, String msg) {
        super(msg);
        this.code = code;
    }

    public BizException(String msg) {
        this(500, msg);
    }

    public int getCode() {
        return code;
    }
}
