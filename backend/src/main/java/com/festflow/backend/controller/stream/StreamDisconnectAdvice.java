package com.festflow.backend.controller.stream;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

import java.io.IOException;

/**
 * 실시간 연결(SSE)이 끊겼을 때의 뒷정리.
 * 손님이 화면을 닫으면 서버는 그 연결에 쓰다가 IOException 을 만난다. 흔한 일이라 조용히 넘긴다.
 * 그대로 두면 끊길 때마다 긴 오류 기록이 두 번씩 남아서, 사람이 몰리는 날에는 기록이 서버를 느리게 만든다.
 */
@ControllerAdvice(assignableTypes = StreamController.class)
public class StreamDisconnectAdvice {

    // response 를 인자로 받으면 "응답을 이미 처리했다"로 쳐서 화면(view)을 찾지 않는다.
    @ExceptionHandler(IOException.class)
    public void clientGone(IOException exception, HttpServletResponse response) {
        // 할 일 없음. 연결 목록에서는 StreamService 가 이미 뺐다.
    }
}
