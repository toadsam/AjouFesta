package com.festflow.backend.security;

import jakarta.servlet.http.HttpServletRequest;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

/** 요청에서 접속 IP 와 (규칙 매칭용) 경로를 꺼낸다. */
public final class ClientIp {

    private ClientIp() {
    }

    public static String of(HttpServletRequest request) {
        // 프록시는 접속 IP를 목록 맨 뒤에 붙인다. 앞쪽은 클라이언트가 마음대로 넣을 수 있으니 오른쪽부터 보되,
        // 프록시 내부 주소(사설·CGNAT·루프백)는 건너뛰고 처음 나오는 공인 IP를 쓴다. 모두 내부 주소면(로컬) 마지막 값.
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            String[] parts = forwardedFor.split(",");
            for (int i = parts.length - 1; i >= 0; i--) {
                String candidate = parts[i].trim();
                if (!candidate.isEmpty() && !isInternalAddress(candidate)) {
                    return candidate;
                }
            }
            return parts[parts.length - 1].trim();
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        return request.getRemoteAddr();
    }

    /**
     * 컨트롤러가 찾아지는 것과 같은 모양의 경로. 퍼센트 인코딩을 풀고, 경로 매개변수(;…)와 겹친 슬래시를 없앤다.
     * 풀 수 없는 인코딩이면 원문을 그대로 쓴다.
     */
    static String normalizedPath(HttpServletRequest request) {
        String uri = request.getRequestURI();
        if (uri == null) {
            return "";
        }
        String contextPath = request.getContextPath();
        if (contextPath != null && !contextPath.isEmpty() && uri.startsWith(contextPath)) {
            uri = uri.substring(contextPath.length());
        }
        String path = uri.replaceAll(";[^/]*", "");
        try {
            // URLDecoder 는 '+' 를 공백으로 바꾸므로 미리 지켜 둔다.
            path = URLDecoder.decode(path.replace("+", "%2B"), StandardCharsets.UTF_8);
        } catch (IllegalArgumentException ignored) {
            // 잘못된 인코딩: 원문 그대로 매칭한다.
        }
        return path.replaceAll("/{2,}", "/");
    }

    static boolean isInternalAddress(String ip) {
        String v = ip.toLowerCase();
        if (v.startsWith("[")) v = v.substring(1, v.indexOf(']') > 0 ? v.indexOf(']') : v.length());
        if (v.equals("::1") || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80:")) return true;
        if (v.startsWith("::ffff:")) v = v.substring(7);
        String[] o = v.split("\\.");
        if (o.length != 4) return false;
        try {
            int a = Integer.parseInt(o[0]);
            int b = Integer.parseInt(o[1]);
            return a == 10 || a == 127 || a == 0
                    || (a == 172 && b >= 16 && b <= 31)
                    || (a == 192 && b == 168)
                    || (a == 169 && b == 254)
                    || (a == 100 && b >= 64 && b <= 127);
        } catch (NumberFormatException e) {
            return false;
        }
    }
}
