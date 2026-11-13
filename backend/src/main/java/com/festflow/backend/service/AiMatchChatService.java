package com.festflow.backend.service;

import com.festflow.backend.dto.AiMatchAdminChatLineDto;
import com.festflow.backend.dto.AiMatchChatChoiceDto;
import com.festflow.backend.dto.AiMatchChatEnterDto;
import com.festflow.backend.dto.AiMatchChatMessageDto;
import com.festflow.backend.dto.AiMatchChatParticipantDto;
import com.festflow.backend.dto.AiMatchChatSendDto;
import com.festflow.backend.dto.AiMatchChatStateDto;
import com.festflow.backend.dto.AiMatchChatTopicDto;
import com.festflow.backend.dto.AiMatchProfileAccessRequestDto;
import com.festflow.backend.entity.AiMatchChatMessage;
import com.festflow.backend.entity.AiMatchProfile;
import com.festflow.backend.entity.AiMatchRequest;
import com.festflow.backend.repository.AiMatchChatMessageRepository;
import com.festflow.backend.repository.AiMatchRequestRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.CONFLICT;
import static org.springframework.http.HttpStatus.NOT_FOUND;
import static org.springframework.http.HttpStatus.UNAUTHORIZED;

/**
 * 소개팅 부스 블라인드 채팅.
 * 두 사람이 모두 '부스 도착'인 상태에서 스태프가 '채팅 시작'을 누르면 열리고(AiMatchService.startBlindChat), chatMinutes 동안 글자로 이야기한다.
 * 끝나면 각자 얼굴 보기를 고르고, 둘 다 원할 때만 MATCH 가 된다. 누가 거절했는지는 알려 주지 않는다.
 * 화면은 1초마다 상태를 받아 간다. 매번 비밀번호(BCrypt)를 확인하면 무거워서, 입장할 때 한 번 확인하고 토큰을 준다.
 * 토큰은 메모리에만 두므로 서버가 다시 뜨면 화면이 다시 입장한다.
 */
@Service
public class AiMatchChatService {

    static final int MAX_MESSAGE_LENGTH = 300;
    private static final Duration SESSION_TTL = Duration.ofHours(3);
    private static final Pattern TAG_PATTERN = Pattern.compile("#([^\\s#]+)");
    private static final Pattern MBTI_PATTERN = Pattern.compile("\\bMBTI\\s*:\\s*([A-Za-z]{4})\\b", Pattern.CASE_INSENSITIVE);

    /** 누구에게나 보여 주는 주제. id 는 저장된 주제 카드와 맞춰 보는 데 쓰니 바꾸지 말 것. */
    private static final List<AiMatchChatTopicDto> COMMON_TOPICS = List.of(
            new AiMatchChatTopicDto("g1", "이번 축제에서 제일 기대한 공연은?"),
            new AiMatchChatTopicDto("g2", "축제 와서 제일 먼저 먹은 건 뭐예요?"),
            new AiMatchChatTopicDto("g3", "요즘 제일 자주 듣는 노래 한 곡만 추천한다면?"),
            new AiMatchChatTopicDto("g4", "쉬는 날엔 집에 있는 편? 나가는 편?"),
            new AiMatchChatTopicDto("g5", "최근에 본 영화나 드라마 중 제일 재밌었던 건?"),
            new AiMatchChatTopicDto("g6", "학교 근처 맛집을 하나만 꼽는다면?"),
            new AiMatchChatTopicDto("g7", "여행 간다면 바다 vs 산, 어디로?"),
            new AiMatchChatTopicDto("g8", "사주 풀이 결과, 본인이랑 얼마나 맞는 것 같아요?"),
            new AiMatchChatTopicDto("g9", "요즘 빠져 있는 취미가 있다면?"),
            new AiMatchChatTopicDto("g10", "아침형 인간 vs 올빼미형, 어느 쪽이에요?"),
            new AiMatchChatTopicDto("g11", "이번 학기에 꼭 해 보고 싶은 것 하나는?"),
            new AiMatchChatTopicDto("g12", "프로필 소개글을 쓸 때 제일 고민한 부분은?")
    );

    private final AiMatchService aiMatchService;
    private final AiMatchRequestRepository requestRepository;
    private final AiMatchChatMessageRepository messageRepository;
    private final int chatMinutes;
    private final int chooseMinutes;
    private final int retentionDays;
    private final Map<String, Session> sessions = new ConcurrentHashMap<>();

    public AiMatchChatService(
            AiMatchService aiMatchService,
            AiMatchRequestRepository requestRepository,
            AiMatchChatMessageRepository messageRepository,
            @Value("${app.ai-match.chat-minutes:10}") int chatMinutes,
            @Value("${app.ai-match.chat-choose-minutes:3}") int chooseMinutes,
            @Value("${app.ai-match.chat-retention-days:14}") int retentionDays
    ) {
        this.aiMatchService = aiMatchService;
        this.requestRepository = requestRepository;
        this.messageRepository = messageRepository;
        this.chatMinutes = Math.max(1, chatMinutes);
        this.chooseMinutes = Math.max(1, chooseMinutes);
        this.retentionDays = Math.max(1, retentionDays);
    }

    /** 닉네임·비밀번호로 한 번 확인하고 채팅 토큰을 준다. 확정된 약속의 두 사람만 들어올 수 있다. */
    @Transactional
    public AiMatchChatEnterDto enter(Long requestId, AiMatchProfileAccessRequestDto requestDto) {
        AiMatchChatParticipantDto participant = aiMatchService.authenticateChatParticipant(requestId, requestDto);
        AiMatchRequest request = findRequest(participant.requestId());
        if (!"CONFIRMED".equals(request.getStatus()) || request.getMeetupAt() == null) {
            throw new ResponseStatusException(CONFLICT, "확정된 약속이 있어야 채팅방에 들어갈 수 있어요.");
        }
        pruneSessions();
        String token = UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "");
        Session session = new Session(participant.requestId(), participant.profileId(), participant.requesterSide(), Instant.now().plus(SESSION_TTL));
        sessions.put(token, session);
        return new AiMatchChatEnterDto(token, buildState(request, session, 0L, true));
    }

    @Transactional(readOnly = true)
    public AiMatchChatStateDto state(String token, Long afterId) {
        Session session = requireSession(token);
        long after = afterId == null ? 0L : Math.max(0L, afterId);
        return buildState(findRequest(session.requestId()), session, after, after == 0L);
    }

    @Transactional
    public AiMatchChatMessageDto send(String token, AiMatchChatSendDto requestDto) {
        Session session = requireSession(token);
        AiMatchRequest request = findRequest(session.requestId());
        if (!"OPEN".equals(viewerPhase(request, LocalDateTime.now()))) {
            throw new ResponseStatusException(CONFLICT, "지금은 메시지를 보낼 수 없어요.");
        }
        String topicId = requestDto == null || requestDto.topicId() == null ? "" : requestDto.topicId().trim();
        AiMatchChatMessage saved;
        if (!topicId.isEmpty()) {
            AiMatchChatTopicDto topic = topicsFor(request).stream()
                    .filter(item -> item.id().equals(topicId))
                    .findFirst()
                    .orElseThrow(() -> new ResponseStatusException(BAD_REQUEST, "없는 주제예요."));
            boolean used = currentMessages(request, 0L).stream()
                    .anyMatch(message -> "TOPIC".equals(message.getType()) && message.getContent().equals(topic.text()));
            if (used) {
                throw new ResponseStatusException(CONFLICT, "이미 나온 주제예요.");
            }
            saved = messageRepository.save(new AiMatchChatMessage(request.getId(), session.profileId(), "TOPIC", topic.text()));
        } else {
            String content = requestDto == null || requestDto.content() == null ? "" : requestDto.content().strip();
            if (content.isEmpty()) {
                throw new ResponseStatusException(BAD_REQUEST, "보낼 말을 적어 주세요.");
            }
            if (content.length() > MAX_MESSAGE_LENGTH) {
                throw new ResponseStatusException(BAD_REQUEST, "메시지는 " + MAX_MESSAGE_LENGTH + "자까지 보낼 수 있어요.");
            }
            saved = messageRepository.save(new AiMatchChatMessage(request.getId(), session.profileId(), "TEXT", content));
        }
        return toMessageDto(saved, session.profileId());
    }

    /** 채팅이 끝난 뒤 얼굴 보기 선택. 한 번 고르면 바꿀 수 없다. */
    @Transactional
    public AiMatchChatStateDto choose(String token, AiMatchChatChoiceDto requestDto) {
        Session session = requireSession(token);
        if (requestDto == null || requestDto.reveal() == null) {
            throw new ResponseStatusException(BAD_REQUEST, "얼굴을 볼지 골라 주세요.");
        }
        AiMatchRequest request = findRequest(session.requestId());
        String phase = viewerPhase(request, LocalDateTime.now());
        if ("OPEN".equals(phase) || "WAITING".equals(phase)) {
            throw new ResponseStatusException(CONFLICT, "채팅이 끝난 뒤에 고를 수 있어요.");
        }
        if (!"CHOOSING".equals(phase)) {
            throw new ResponseStatusException(CONFLICT, "선택 시간이 끝났어요.");
        }
        if (request.getReveal(session.requesterSide()) != null) {
            throw new ResponseStatusException(CONFLICT, "이미 골랐어요.");
        }
        request.chooseReveal(session.requesterSide(), requestDto.reveal());
        return buildState(request, session, 0L, false);
    }

    /** 운영진이 신고 확인용으로 보는 전체 기록. */
    @Transactional(readOnly = true)
    public List<AiMatchAdminChatLineDto> adminLog(Long requestId) {
        AiMatchRequest request = findRequest(requestId);
        AiMatchProfile requester = request.getRequesterProfile();
        AiMatchProfile target = request.getProfile();
        return messageRepository.findAllByRequestIdOrderByIdAsc(requestId).stream()
                .map(message -> new AiMatchAdminChatLineDto(
                        message.getId(),
                        requester != null && requester.getId().equals(message.getSenderProfileId())
                                ? request.getRequesterNickname()
                                : target != null && target.getId().equals(message.getSenderProfileId()) ? target.getNickname() : "?",
                        message.getType(),
                        message.getContent(),
                        message.getCreatedAt()
                ))
                .toList();
    }

    /** 보관 기한이 지난 채팅을 지운다. */
    @Transactional
    public int purgeOld() {
        return messageRepository.deleteAllOlderThan(LocalDateTime.now().minusDays(retentionDays));
    }

    // ---------- 내부 ----------

    private AiMatchChatStateDto buildState(AiMatchRequest request, Session session, long afterId, boolean includeTopics) {
        LocalDateTime now = LocalDateTime.now();
        String phase = viewerPhase(request, now);
        LocalDateTime startedAt = request.getChatStartedAt();
        LocalDateTime endsAt = startedAt == null ? null : startedAt.plusMinutes(chatMinutes);
        AiMatchProfile partner = session.requesterSide() ? request.getProfile() : request.getRequesterProfile();
        String myReveal = request.getReveal(session.requesterSide());
        List<AiMatchChatMessageDto> messages = currentMessages(request, afterId).stream()
                .map(message -> toMessageDto(message, session.profileId()))
                .toList();
        return new AiMatchChatStateDto(
                request.getId(),
                phase,
                now,
                startedAt,
                endsAt,
                endsAt == null ? null : endsAt.plusMinutes(chooseMinutes),
                session.requesterSide()
                        ? (partner == null ? "" : partner.getNickname())
                        : request.getRequesterNickname(),
                partner == null ? null : partner.getId(),
                myReveal == null ? null : "YES".equals(myReveal),
                messages,
                includeTopics ? topicsFor(request) : List.of()
        );
    }

    /** 참가자가 보는 단계. 약속이 풀렸으면(노쇼 등) CLOSED. */
    private String viewerPhase(AiMatchRequest request, LocalDateTime now) {
        if (!"CONFIRMED".equals(request.getStatus())) {
            return "CLOSED";
        }
        String phase = request.chatPhase(now, chatMinutes, chooseMinutes);
        return "NONE".equals(phase) ? "WAITING" : phase;
    }

    private List<AiMatchChatMessage> currentMessages(AiMatchRequest request, long afterId) {
        if (request.getChatStartedAt() == null) {
            return List.of();
        }
        return messageRepository.findAllByRequestIdAndIdGreaterThanAndCreatedAtGreaterThanEqualOrderByIdAsc(
                request.getId(), afterId, request.getChatStartedAt());
    }

    private static AiMatchChatMessageDto toMessageDto(AiMatchChatMessage message, Long viewerProfileId) {
        return new AiMatchChatMessageDto(
                message.getId(),
                message.getType(),
                viewerProfileId.equals(message.getSenderProfileId()),
                message.getContent(),
                message.getCreatedAt()
        );
    }

    /** 두 사람 프로필에서 겹치는 관심사·MBTI 로 만든 주제를 앞에, 공통 주제를 뒤에 둔다. */
    static List<AiMatchChatTopicDto> topicsFor(AiMatchRequest request) {
        List<AiMatchChatTopicDto> topics = new ArrayList<>();
        String introA = request.getRequesterProfile() == null ? "" : String.valueOf(request.getRequesterProfile().getIntro());
        String introB = request.getProfile() == null ? "" : String.valueOf(request.getProfile().getIntro());
        Set<String> shared = tags(introA);
        shared.retainAll(tags(introB));
        int index = 0;
        for (String tag : shared) {
            if (index >= 3) {
                break;
            }
            topics.add(new AiMatchChatTopicDto("t" + (++index), "둘 다 '" + tag + "'에 관심이 있네요. 요즘 제일 빠져 있는 건?"));
        }
        String mbtiA = mbti(introA);
        String mbtiB = mbti(introB);
        if (!mbtiA.isEmpty() && !mbtiB.isEmpty()) {
            topics.add(new AiMatchChatTopicDto("m1", mbtiA.equals(mbtiB)
                    ? "둘 다 MBTI가 " + mbtiA + "네요. 어떤 점이 제일 닮았을까요?"
                    : "MBTI가 " + mbtiA + "와 " + mbtiB + "예요. 서로 어떤 점이 다를 것 같나요?"));
        }
        topics.addAll(COMMON_TOPICS);
        return topics;
    }

    private static Set<String> tags(String intro) {
        Set<String> result = new LinkedHashSet<>();
        Matcher matcher = TAG_PATTERN.matcher(intro == null ? "" : intro);
        while (matcher.find()) {
            result.add(matcher.group(1));
        }
        return result;
    }

    private static String mbti(String intro) {
        Matcher matcher = MBTI_PATTERN.matcher(intro == null ? "" : intro);
        return matcher.find() ? matcher.group(1).toUpperCase() : "";
    }

    private AiMatchRequest findRequest(Long requestId) {
        return requestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "데이트 신청을 찾을 수 없습니다."));
    }

    private Session requireSession(String token) {
        Session session = token == null ? null : sessions.get(token.trim());
        if (session == null || session.expiresAt().isBefore(Instant.now())) {
            if (token != null) {
                sessions.remove(token.trim());
            }
            throw new ResponseStatusException(UNAUTHORIZED, "채팅방에 다시 들어와 주세요.");
        }
        return session;
    }

    private void pruneSessions() {
        if (sessions.size() < 500) {
            return;
        }
        Instant now = Instant.now();
        sessions.entrySet().removeIf(entry -> entry.getValue().expiresAt().isBefore(now));
    }

    private record Session(Long requestId, Long profileId, boolean requesterSide, Instant expiresAt) {
    }
}
