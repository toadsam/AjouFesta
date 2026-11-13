package com.festflow.backend.service.notification;

import com.festflow.backend.service.AiMatchChatService;
import com.festflow.backend.service.AiMatchService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** 1분마다 곧 시작하는 소개팅 약속을 찾아 두 사람에게 대기 장소 알림 문자를 보낸다. */
@Component
public class AiMatchMeetupReminderJob {

    private static final Logger log = LoggerFactory.getLogger(AiMatchMeetupReminderJob.class);

    private final AiMatchService aiMatchService;
    private final AiMatchChatService aiMatchChatService;

    public AiMatchMeetupReminderJob(AiMatchService aiMatchService, AiMatchChatService aiMatchChatService) {
        this.aiMatchService = aiMatchService;
        this.aiMatchChatService = aiMatchChatService;
    }

    /** 보관 기한(기본 14일)이 지난 블라인드 채팅을 1시간마다 지운다. */
    @Scheduled(fixedDelay = 3_600_000, initialDelay = 120_000)
    public void purgeOldChats() {
        try {
            int deleted = aiMatchChatService.purgeOld();
            if (deleted > 0) {
                log.info("AI match chat messages purged: {}", deleted);
            }
        } catch (RuntimeException e) {
            log.warn("AI match chat purge failed.", e);
        }
    }

    @Scheduled(fixedDelay = 60_000, initialDelay = 30_000)
    public void sendReminders() {
        try {
            int sent = aiMatchService.sendDueMeetupReminders();
            if (sent > 0) {
                log.info("AI match meetup reminders sent for {} meetup(s).", sent);
            }
        } catch (RuntimeException e) {
            log.warn("AI match meetup reminder job failed.", e);
        }
    }
}
