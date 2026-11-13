package com.festflow.backend.entity;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AiMatchRequestEscortTest {

    private AiMatchRequest request() {
        return new AiMatchRequest(null, null, "신청자", "총학생회 부스", "안녕");
    }

    @Test
    void stagesMoveForwardPerSideIndependently() {
        AiMatchRequest request = request();
        assertThat(request.escortStage(true)).isEqualTo("NONE");

        request.setEscortStage(true, "ARRIVED");
        request.setEscortStage(true, "DEPARTED");

        assertThat(request.escortStage(true)).isEqualTo("DEPARTED");
        assertThat(request.getRequesterArrivedAt()).isNotNull();
        assertThat(request.getRequesterStaffDepartedAt()).isNotNull();
        assertThat(request.escortStage(false)).isEqualTo("NONE");
    }

    @Test
    void jumpingAheadFillsEarlierStagesAndStepBackClearsLaterOnes() {
        AiMatchRequest request = request();
        request.setEscortStage(false, "AT_BOOTH");
        assertThat(request.getProfileArrivedAt()).isNotNull();
        assertThat(request.getProfilePickedUpAt()).isNotNull();

        LocalDateTime arrivedAt = request.getProfileArrivedAt();
        request.setEscortStage(false, "ARRIVED");

        assertThat(request.escortStage(false)).isEqualTo("ARRIVED");
        assertThat(request.getProfileArrivedAt()).isEqualTo(arrivedAt);
        assertThat(request.getProfileStaffDepartedAt()).isNull();
        assertThat(request.getProfileAtBoothAt()).isNull();
    }

    @Test
    void selfArrivalDoesNotRewindStaffProgress() {
        AiMatchRequest request = request();
        request.setEscortStage(true, "PICKED_UP");

        request.markArrival(true, true);

        assertThat(request.escortStage(true)).isEqualTo("PICKED_UP");
    }

    @Test
    void newProposalClearsProgressAndReminder() {
        AiMatchRequest request = request();
        request.setEscortStage(true, "DEPARTED");
        request.markReminderSent();

        request.proposeMeetup("총학생회 소개팅 부스", LocalDateTime.now().plusDays(1), 1L, "신청자");

        assertThat(request.escortStage(true)).isEqualTo("NONE");
        assertThat(request.getMeetupReminderSentAt()).isNull();
    }

    @Test
    void unknownStageIsRejected() {
        assertThatThrownBy(() -> request().setEscortStage(true, "FLYING")).isInstanceOf(IllegalArgumentException.class);
    }
}
