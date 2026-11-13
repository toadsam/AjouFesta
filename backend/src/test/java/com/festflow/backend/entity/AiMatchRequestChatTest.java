package com.festflow.backend.entity;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class AiMatchRequestChatTest {

    private static final int CHAT = 10;
    private static final int CHOOSE = 3;

    private AiMatchRequest bothAtBooth() {
        AiMatchRequest request = new AiMatchRequest(null, null, "신청자", "총학생회 부스", "안녕");
        request.setEscortStage(true, "AT_BOOTH");
        request.setEscortStage(false, "AT_BOOTH");
        assertThat(request.bothAtBooth()).isTrue();
        request.startChat();
        return request;
    }

    @Test
    void chatIsNotOpenUntilStarted() {
        AiMatchRequest request = new AiMatchRequest(null, null, "신청자", "총학생회 부스", "안녕");
        request.setEscortStage(true, "AT_BOOTH");

        assertThat(request.bothAtBooth()).isFalse();
        assertThat(request.chatPhase(LocalDateTime.now(), CHAT, CHOOSE)).isEqualTo("NONE");
    }

    @Test
    void openForChatMinutesThenChoosing() {
        AiMatchRequest request = bothAtBooth();
        LocalDateTime start = request.getChatStartedAt();

        assertThat(request.chatPhase(start.plusMinutes(9), CHAT, CHOOSE)).isEqualTo("OPEN");
        assertThat(request.chatPhase(start.plusMinutes(10).plusSeconds(1), CHAT, CHOOSE)).isEqualTo("CHOOSING");
    }

    @Test
    void bothYesIsMatchAndAnyNoIsNoMatch() {
        AiMatchRequest yes = bothAtBooth();
        yes.chooseReveal(true, true);
        yes.chooseReveal(false, true);
        assertThat(yes.chatPhase(yes.getChatStartedAt().plusMinutes(11), CHAT, CHOOSE)).isEqualTo("MATCH");

        AiMatchRequest no = bothAtBooth();
        no.chooseReveal(true, true);
        no.chooseReveal(false, false);
        assertThat(no.chatPhase(no.getChatStartedAt().plusMinutes(11), CHAT, CHOOSE)).isEqualTo("NO_MATCH");
    }

    @Test
    void oneEarlyNoStaysHiddenUntilTheOtherChoosesOrTimeRunsOut() {
        AiMatchRequest request = bothAtBooth();
        LocalDateTime start = request.getChatStartedAt();
        request.chooseReveal(true, false);

        assertThat(request.chatPhase(start.plusMinutes(11), CHAT, CHOOSE)).isEqualTo("CHOOSING");
        assertThat(request.revealResult(start.plusMinutes(11), CHAT, CHOOSE)).isNull();
        assertThat(request.chatPhase(start.plusMinutes(13).plusSeconds(1), CHAT, CHOOSE)).isEqualTo("NO_MATCH");
    }

    @Test
    void notChoosingInTimeCountsAsNo() {
        AiMatchRequest request = bothAtBooth();
        request.chooseReveal(true, true);

        assertThat(request.chatPhase(request.getChatStartedAt().plusMinutes(14), CHAT, CHOOSE)).isEqualTo("NO_MATCH");
    }

    @Test
    void newProposalResetsChat() {
        AiMatchRequest request = bothAtBooth();
        request.chooseReveal(true, true);

        request.proposeMeetup("총학생회 소개팅 부스", LocalDateTime.now().plusDays(1), 1L, "신청자");

        assertThat(request.getChatStartedAt()).isNull();
        assertThat(request.getReveal(true)).isNull();
    }
}
