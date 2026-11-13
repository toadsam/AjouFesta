package com.festflow.backend.entity;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/** 부스 시간을 못 잡은 커플의 연락처 공유 동의. 둘 다 눌러야 열리고, 한쪽만 누른 동안은 상대 쪽에 아무것도 안 보인다. */
class AiMatchRequestContactShareTest {

    private static AiMatchRequest matched() {
        AiMatchRequest request = new AiMatchRequest(null, null, "신청자", "총학생회 부스", "안녕");
        request.accept();
        return request;
    }

    @Test
    void nobodyConsentedYet() {
        AiMatchRequest request = matched();

        assertThat(request.isContactShared()).isFalse();
        assertThat(request.contactShareState(true)).isEqualTo("NONE");
        assertThat(request.contactShareState(false)).isEqualTo("NONE");
    }

    @Test
    void oneSideOnlyIsWaitingForMeAndAskedForTheOther() {
        AiMatchRequest request = matched();
        request.consentContactShare(true);

        assertThat(request.isContactShared()).isFalse();
        assertThat(request.hasContactConsent(true)).isTrue();
        assertThat(request.hasContactConsent(false)).isFalse();
        assertThat(request.contactShareState(true)).isEqualTo("WAITING");
        assertThat(request.contactShareState(false)).isEqualTo("ASKED");
    }

    @Test
    void bothSidesOpenItAndTheFirstStampIsKept() {
        AiMatchRequest request = matched();
        request.consentContactShare(false);
        LocalDateTime first = request.getProfileContactConsentAt();
        request.consentContactShare(false); // 두 번 눌러도 시각은 처음 것
        request.consentContactShare(true);

        assertThat(request.isContactShared()).isTrue();
        assertThat(request.getProfileContactConsentAt()).isEqualTo(first);
        assertThat(request.getRequesterContactConsentAt()).isNotNull();
        assertThat(request.contactShareState(true)).isEqualTo("SHARED");
        assertThat(request.contactShareState(false)).isEqualTo("SHARED");
    }

    @Test
    void consentSurvivesMeetupChanges() {
        AiMatchRequest request = matched();
        request.consentContactShare(true);
        request.consentContactShare(false);
        request.proposeMeetup("부스", LocalDateTime.now().plusHours(2), 1L, "신청자");
        request.clearMeetup();

        assertThat(request.isContactShared()).isTrue();
    }
}
