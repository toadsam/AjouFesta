package com.festflow.backend.dto;

/**
 * 대기 장소 → 부스 안내 단계 바꾸기. side: REQUESTER / PROFILE.
 * stage: NONE(아직) · ARRIVED(대기 장소 도착) · DEPARTED(스태프 출발) · PICKED_UP(스태프와 만남) · AT_BOOTH(부스 도착).
 * fromStage: 누른 화면에 보이던 지금 단계(없으면 확인하지 않음). 서버 단계와 다르면 다른 스태프가 먼저 바꾼 것이라 바꾸지 않는다.
 */
public record AiMatchAdminEscortDto(
        String side,
        String stage,
        String fromStage
) {
}
