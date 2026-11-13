package com.festflow.backend.service.notification;

import com.festflow.backend.service.sms.SolapiMessageClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AiMatchSmsNotifierTest {

    private SolapiMessageClient client;
    private AiMatchSmsNotifier notifier;

    @BeforeEach
    void setUp() {
        client = mock(SolapiMessageClient.class);
        when(client.isEnabled()).thenReturn(true);
        notifier = new AiMatchSmsNotifier(client, true, "https://www.ajoufesta.com/");
    }

    @Test
    void proposalMessageHasTimeHoldAndLink() {
        notifier.notifyMeetupProposed("010-1111-2222", LocalDateTime.of(2026, 10, 7, 18, 30), 30, false);

        ArgumentCaptor<String> text = ArgumentCaptor.forClass(String.class);
        verify(client).sendText(eq("010-1111-2222"), text.capture());
        assertThat(text.getValue())
                .contains("만날 시간을 제안")
                .contains("10/7(수) 18:30")
                .contains("30분 안에")
                .endsWith("https://www.ajoufesta.com/ai-match");
    }

    @Test
    void noShowMessageDiffersForAbsentAndWaitingSide() {
        notifier.notifyMeetupNoShow("010-1111-2222", LocalDateTime.of(2026, 10, 7, 18, 40), true);
        notifier.notifyMeetupNoShow("010-3333-4444", LocalDateTime.of(2026, 10, 7, 18, 40), false);

        ArgumentCaptor<String> absent = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> waiting = ArgumentCaptor.forClass(String.class);
        verify(client).sendText(eq("010-1111-2222"), absent.capture());
        verify(client).sendText(eq("010-3333-4444"), waiting.capture());
        assertThat(absent.getValue())
                .contains("10/7(수) 18:40")
                .contains("참석하지 못해 취소")
                .contains("다시 잡을 수 있어요")
                .endsWith("https://www.ajoufesta.com/ai-match");
        assertThat(waiting.getValue())
                .contains("상대가 오지 못해 취소")
                .contains("기다려 주셔서 고마워요")
                .doesNotContain("참석하지 못해");
    }

    @Test
    void negotiationMessagesToSameNumberAreThrottled() {
        notifier.notifyMeetupProposed("010-1111-2222", LocalDateTime.of(2026, 10, 7, 18, 30), 30, false);
        notifier.notifyMeetupWithdrawn("01011112222");
        notifier.notifyMeetupDeclined("010-1111-2222");

        verify(client, times(1)).sendText(anyString(), anyString());
    }

    @Test
    void confirmationIsNeverThrottled() {
        notifier.notifyMeetupProposed("010-1111-2222", LocalDateTime.of(2026, 10, 7, 18, 30), 30, true);
        notifier.notifyMeetupConfirmed("010-1111-2222", LocalDateTime.of(2026, 10, 8, 15, 0));

        ArgumentCaptor<String> text = ArgumentCaptor.forClass(String.class);
        verify(client, times(2)).sendText(eq("010-1111-2222"), text.capture());
        assertThat(text.getAllValues().get(0)).contains("다른 시간을 제안");
        assertThat(text.getAllValues().get(1)).contains("확정").contains("10/8(목) 15:00").contains("바꾸거나 취소할 수 없어요");
    }

    @Test
    void differentNumbersAreNotThrottledTogether() {
        notifier.notifyMeetupDeclined("010-1111-2222");
        notifier.notifyMeetupDeclined("010-3333-4444");

        verify(client, times(2)).sendText(anyString(), anyString());
    }

    @Test
    void blankNumberOrDisabledSendsNothing() {
        notifier.notifyMeetupDeclined("");
        new AiMatchSmsNotifier(client, false, "https://www.ajoufesta.com").notifyMeetupConfirmed("010-5555-6666", LocalDateTime.now());

        verify(client, never()).sendText(anyString(), anyString());
    }
}
