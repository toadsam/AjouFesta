package com.festflow.backend.service;

import com.festflow.backend.dto.AiMatchAdminOverviewDto;
import com.festflow.backend.dto.AiMatchRegistrationUpdateDto;
import com.festflow.backend.dto.AiMatchStatusDto;
import com.festflow.backend.dto.AiMatchMasterSummaryDto;
import com.festflow.backend.dto.AiMatchAdminArrivalDto;
import com.festflow.backend.dto.AiMatchAdminEscortDto;
import com.festflow.backend.dto.AiMatchAdminHiddenDto;
import com.festflow.backend.dto.AiMatchAdminNoShowDto;
import com.festflow.backend.dto.AiMatchAdminPhotoReviewDto;
import com.festflow.backend.dto.AiMatchReportCreateDto;
import com.festflow.backend.dto.AiMatchReportDto;
import com.festflow.backend.dto.AiMatchReportResolveDto;
import com.festflow.backend.entity.AiMatchReport;
import com.festflow.backend.repository.AiMatchChatMessageRepository;
import com.festflow.backend.repository.AiMatchReportRepository;
import com.festflow.backend.dto.AiMatchAdminNoteUpdateDto;
import com.festflow.backend.dto.AiMatchAdminPhonePurgeRequestDto;
import com.festflow.backend.dto.AiMatchAdminPhonePurgeResponseDto;
import com.festflow.backend.dto.AiMatchAdminProfileDto;
import com.festflow.backend.dto.AiMatchAdminRequestDto;
import com.festflow.backend.dto.AiMatchConnectionStatusUpdateDto;
import com.festflow.backend.dto.AiMatchFavoriteResponseDto;
import com.festflow.backend.dto.AiMatchProfileAccessRequestDto;
import com.festflow.backend.dto.AiMatchProfileAccessResponseDto;
import com.festflow.backend.dto.AiMatchProfileDeleteDto;
import com.festflow.backend.dto.AiMatchImagePreviewDto;
import com.festflow.backend.dto.AiMatchMeetupProposalDto;
import com.festflow.backend.dto.AiMatchPhoneCheckDto;
import com.festflow.backend.dto.AiMatchProfileResponseDto;
import com.festflow.backend.dto.AiMatchProfileUpdateDto;
import com.festflow.backend.dto.AiMatchRequestCreateDto;
import com.festflow.backend.dto.AiMatchRequestQuotaDto;
import com.festflow.backend.dto.AiMatchMeetupScheduleDto;
import com.festflow.backend.dto.AiMatchMeetupScheduleItemDto;
import com.festflow.backend.dto.AiMatchMeetupSlotsDto;
import com.festflow.backend.entity.AiMatchMeetupSlot;
import com.festflow.backend.dto.AiMatchRequestResponseDto;
import com.festflow.backend.dto.SajuCompatibilityDto;
import com.festflow.backend.dto.AiMatchNicknameCheckDto;
import com.festflow.backend.dto.SajuDto;
import com.festflow.backend.service.saju.SajuPillars;
import com.festflow.backend.entity.AiMatchFavorite;
import com.festflow.backend.entity.AiMatchPhoneUsage;
import com.festflow.backend.entity.AiMatchProfile;
import com.festflow.backend.entity.AiMatchRequest;
import com.festflow.backend.repository.AiMatchFavoriteRepository;
import com.festflow.backend.repository.AiMatchPhoneUsageRepository;
import com.festflow.backend.repository.AiMatchProfileRepository;
import com.festflow.backend.repository.AiMatchRequestRepository;
import com.festflow.backend.service.notification.AiMatchSmsNotifier;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.time.DateTimeException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.CONFLICT;
import static org.springframework.http.HttpStatus.NOT_FOUND;
import static org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE;
import static org.springframework.http.HttpStatus.TOO_MANY_REQUESTS;
import static org.springframework.http.HttpStatus.UNAUTHORIZED;

@Service
public class AiMatchService {

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(AiMatchService.class);

    private static final int MAX_SUCCESSFUL_IMAGE_CONVERSIONS_PER_PHONE = 2;
    /** 한 사람이 축제 동안 보낼 수 있는 데이트 신청 수. 취소·거절도 센다(보내는 행동 자체를 제한). */
    public static final int MAX_SENT_REQUESTS_PER_PROFILE = 3;
    /** 같은 닉네임에 같은 IP 에서 비밀번호를 이만큼 틀리면 잠시 잠근다. */
    private static final int MAX_PIN_FAILURES = 10;
    /** 닉네임 하나에 대해 IP 를 가리지 않고 허용하는 실패 수(여러 IP 로 나눠 대입하는 것 방지). */
    private static final int MAX_PIN_FAILURES_PER_NICKNAME = 60;
    private static final int SELF_DELETE_COOLDOWN_HOURS = 24;
    private static final String COOLDOWN_MESSAGE = "삭제한 번호는 24시간 뒤에 다시 가입할 수 있습니다.";
    private static final Duration PIN_FAILURE_WINDOW = Duration.ofMinutes(10);
    private final Map<String, PinFailure> pinFailures = new ConcurrentHashMap<>();

    private final AiMatchProfileRepository profileRepository;
    private final AiMatchRequestRepository requestRepository;
    private final AiMatchFavoriteRepository favoriteRepository;
    private final AiMatchPhoneUsageRepository phoneUsageRepository;
    private final UploadStorageService uploadStorageService;
    private final AiImageGenerationService aiImageGenerationService;
    private final AiMatchSmsNotifier aiMatchSmsNotifier;
    private final PasswordEncoder passwordEncoder;
    private final SajuService sajuService;
    private final AiMatchMeetupSlotService meetupSlotService;
    private final AiMatchReportRepository reportRepository;

    private final AiMatchChatMessageRepository chatMessageRepository;
    private final AppSettingService appSettingService;

    /** 새 가입 받기 스위치(DB). 기본은 받음. 사람이 너무 많을 때 관리자 화면에서 끈다. */
    static final String REGISTRATION_OPEN_KEY = "ai-match.registration-open";
    static final String REGISTRATION_CLOSED_MESSAGE =
            "지금 참가자가 너무 많아 새 프로필 등록은 잠시 받지 않아요. 이미 등록한 분은 닉네임과 비밀번호로 그대로 들어갈 수 있어요.";

    // OpenAI 호출(이미지 변환 최대 2분, 사주 풀이 최대 30초)은 DB 트랜잭션 밖에서 한다.
    // 안에서 하면 그동안 DB 연결을 붙잡아서, 가입이 몇 건만 겹쳐도 주문을 포함한 모든 요청이 멈춘다.
    private final TransactionTemplate transactionTemplate;
    /** 동시에 돌리는 이미지 변환 수. 넘치면 잠깐 기다렸다가 "잠시 후 다시" 로 돌려보낸다. */
    private final Semaphore imageConversionSlots;
    private static final int IMAGE_CONVERSION_WAIT_SECONDS = 20;

    /** 블라인드 채팅 시간과 그 뒤 얼굴 보기 선택 시간(분). AiMatchChatService 와 같은 설정을 읽는다. */
    @org.springframework.beans.factory.annotation.Value("${app.ai-match.chat-minutes:10}")
    private int chatMinutes = 10;

    @org.springframework.beans.factory.annotation.Value("${app.ai-match.chat-choose-minutes:3}")
    private int chatChooseMinutes = 3;

    /** 약속 몇 분 전에 알림 문자를 보낼지. */
    @org.springframework.beans.factory.annotation.Value("${app.ai-match.meetup-reminder-minutes:30}")
    private int meetupReminderMinutes = 30;

    public AiMatchService(
            AiMatchProfileRepository profileRepository,
            AiMatchRequestRepository requestRepository,
            AiMatchFavoriteRepository favoriteRepository,
            AiMatchPhoneUsageRepository phoneUsageRepository,
            UploadStorageService uploadStorageService,
            AiImageGenerationService aiImageGenerationService,
            AiMatchSmsNotifier aiMatchSmsNotifier,
            PasswordEncoder passwordEncoder,
            SajuService sajuService,
            AiMatchMeetupSlotService meetupSlotService,
            AiMatchReportRepository reportRepository,
            AiMatchChatMessageRepository chatMessageRepository,
            AppSettingService appSettingService,
            PlatformTransactionManager transactionManager,
            @org.springframework.beans.factory.annotation.Value("${app.ai-match.image.max-concurrent:12}") int maxConcurrentImageConversions
    ) {
        this.transactionTemplate = new TransactionTemplate(transactionManager);
        this.imageConversionSlots = new Semaphore(Math.max(1, maxConcurrentImageConversions));
        this.chatMessageRepository = chatMessageRepository;
        this.appSettingService = appSettingService;
        this.reportRepository = reportRepository;
        this.sajuService = sajuService;
        this.meetupSlotService = meetupSlotService;
        this.profileRepository = profileRepository;
        this.requestRepository = requestRepository;
        this.favoriteRepository = favoriteRepository;
        this.phoneUsageRepository = phoneUsageRepository;
        this.uploadStorageService = uploadStorageService;
        this.aiImageGenerationService = aiImageGenerationService;
        this.aiMatchSmsNotifier = aiMatchSmsNotifier;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional(readOnly = true)
    /** 가입 화면용. 비었거나 길거나 공백이 있거나 이미 쓰이면 사유를 돌려준다. profileId 가 있으면 그 프로필은 제외(수정 중). */
    public AiMatchNicknameCheckDto checkNickname(String nickname, Long profileId) {
        String trimmed = nickname == null ? "" : nickname.trim();
        if (trimmed.isEmpty()) {
            return new AiMatchNicknameCheckDto(trimmed, false, "닉네임을 입력해 주세요.");
        }
        if (trimmed.length() < 2) {
            return new AiMatchNicknameCheckDto(trimmed, false, "닉네임은 2자 이상이어야 해요.");
        }
        if (trimmed.length() > 12) {
            return new AiMatchNicknameCheckDto(trimmed, false, "닉네임은 12자 이하로 적어 주세요.");
        }
        if (trimmed.matches(".*\\s.*")) {
            return new AiMatchNicknameCheckDto(trimmed, false, "닉네임에는 띄어쓰기를 넣을 수 없어요.");
        }
        boolean duplicated = profileId == null
                ? profileRepository.existsByNicknameIgnoreCaseAndStatus(trimmed, "ACTIVE")
                : profileRepository.existsByNicknameIgnoreCaseAndStatusAndIdNot(trimmed, "ACTIVE", profileId);
        if (duplicated) {
            return new AiMatchNicknameCheckDto(trimmed, false, "이미 사용 중인 닉네임이에요.");
        }
        return new AiMatchNicknameCheckDto(trimmed, true, "사용할 수 있는 닉네임이에요.");
    }

    /**
     * 가입 화면에서 생년월일을 넣자마자 보여 주는 사주. 저장하지 않고, 풀이는 규칙 기반 짧은 글만 붙인다
     * (OpenAI 풀이는 가입 저장 때 한 번만 만든다).
     */
    public SajuDto previewSaju(String birthDate, String birthTime, String nickname) {
        LocalDate safeBirthDate = parseBirthDate(birthDate);
        LocalTime safeBirthTime = parseBirthTime(birthTime);
        SajuPillars pillars = sajuService.calculate(safeBirthDate, safeBirthTime);
        String name = nickname == null || nickname.isBlank() ? "당신" : nickname.trim();
        return sajuService.toDto(pillars, sajuService.previewReading(pillars, name));
    }

    public AiMatchPhoneCheckDto checkPhoneNumber(String phoneNumber) {
        String phoneNumberKey = normalizePhoneNumberKey(phoneNumber, true);
        AiMatchPhoneUsage phoneUsage = phoneUsageRepository.findByPhoneNumber(phoneNumberKey).orElse(null);
        int usedCount = phoneUsage == null ? 0 : phoneUsage.getSuccessfulImageConversionCount();
        int remainingCount = Math.max(0, MAX_SUCCESSFUL_IMAGE_CONVERSIONS_PER_PHONE - usedCount);

        if (phoneUsage != null && phoneUsage.isBlocked()) {
            return new AiMatchPhoneCheckDto(
                    phoneNumberKey,
                    false,
                    usedCount,
                    remainingCount,
                    "삭제된 프로필의 전화번호는 다시 가입할 수 없습니다."
            );
        }
        if (isPhoneNumberDeleted(phoneNumberKey)) {
            return new AiMatchPhoneCheckDto(
                    phoneNumberKey,
                    false,
                    usedCount,
                    remainingCount,
                    COOLDOWN_MESSAGE
            );
        }
        if (isPhoneNumberInUse(phoneNumberKey, null)) {
            return new AiMatchPhoneCheckDto(
                    phoneNumberKey,
                    false,
                    usedCount,
                    remainingCount,
                    "이미 등록된 전화번호입니다."
            );
        }
        if (remainingCount <= 0) {
            return new AiMatchPhoneCheckDto(
                    phoneNumberKey,
                    false,
                    usedCount,
                    0,
                    "이 전화번호는 AI 이미지 변환 가능 횟수를 모두 사용했습니다."
            );
        }
        return new AiMatchPhoneCheckDto(
                phoneNumberKey,
                true,
                usedCount,
                remainingCount,
                "사용 가능한 전화번호입니다. AI 변환 " + remainingCount + "회 남았습니다."
        );
    }

    public boolean isRegistrationOpen() {
        return appSettingService.getBoolean(REGISTRATION_OPEN_KEY, true);
    }

    /** 첫 화면이 로그인 없이 읽는다. 가입을 안 받으면 그 문구까지 같이. */
    public AiMatchStatusDto getStatus() {
        boolean open = isRegistrationOpen();
        return new AiMatchStatusDto(open, open ? "" : REGISTRATION_CLOSED_MESSAGE);
    }

    /** 운영진 스위치. 재배포 없이 바로 바뀐다(DB 값). */
    public AiMatchStatusDto setRegistrationOpen(AiMatchRegistrationUpdateDto requestDto) {
        if (requestDto == null || requestDto.open() == null) {
            throw new ResponseStatusException(BAD_REQUEST, "open 값이 필요합니다.");
        }
        appSettingService.setBoolean(REGISTRATION_OPEN_KEY, requestDto.open());
        return getStatus();
    }

    /** 새 가입을 안 받는 동안은 사진 변환(가입 첫 단계)과 프로필 만들기를 서버가 막는다. 화면만 막으면 주소로 우회할 수 있다. */
    private void ensureRegistrationOpen() {
        if (!isRegistrationOpen()) {
            throw new ResponseStatusException(CONFLICT, REGISTRATION_CLOSED_MESSAGE);
        }
    }

    public AiMatchImagePreviewDto createImagePreview(MultipartFile file, String phoneNumber) throws IOException {
        ensureRegistrationOpen();
        if (!aiImageGenerationService.isConfigured()) {
            throw new ResponseStatusException(
                    BAD_REQUEST,
                    "OPENAI_API_KEY is required for webtoon image conversion."
            );
        }
        String safePhoneNumberKey = normalizePhoneNumberKey(phoneNumber, true);
        ConvertedImage converted = convertProfileImage(file, safePhoneNumberKey, "", "");
        int remainingCount = Math.max(0, MAX_SUCCESSFUL_IMAGE_CONVERSIONS_PER_PHONE - converted.usedCount());
        return new AiMatchImagePreviewDto(
                converted.originalImageUrl(),
                converted.generatedImageUrl(),
                converted.usedCount(),
                remainingCount,
                "AI 변환이 완료되었습니다. " + remainingCount + "회 남았습니다."
        );
    }

    /**
     * 사진을 AI 그림으로 바꾼다. DB 는 앞뒤로 잠깐씩만 쓴다.
     * ① 짧은 트랜잭션에서 번호를 잠그고 변환 횟수를 미리 하나 잡는다(같은 번호의 동시 요청이 한도를 넘지 못하게).
     * ② 트랜잭션 밖에서 OpenAI 를 부른다. ③ 실패하면 잡아 둔 횟수를 돌려준다.
     */
    private ConvertedImage convertProfileImage(MultipartFile file, String phoneNumberKey, String nickname, String intro)
            throws IOException {
        boolean acquired;
        try {
            acquired = imageConversionSlots.tryAcquire(IMAGE_CONVERSION_WAIT_SECONDS, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            acquired = false;
        }
        if (!acquired) {
            throw new ResponseStatusException(SERVICE_UNAVAILABLE, "지금 AI 변환 요청이 많아요. 잠시 후 다시 시도해 주세요.");
        }
        try {
            int usedCount = transactionTemplate.execute(status -> {
                AiMatchPhoneUsage phoneUsage = getOrCreatePhoneUsageForUpdate(phoneNumberKey);
                ensurePhoneNumberNotDeleted(phoneNumberKey);
                ensurePhoneCanGenerateImage(phoneUsage);
                phoneUsage.recordSuccessfulImageConversion();
                return phoneUsage.getSuccessfulImageConversionCount();
            });
            try {
                String originalImageUrl = uploadStorageService.saveImage(file, "ai-profile-original");
                String generatedImageUrl = aiImageGenerationService.generateFestivalProfileImage(
                        originalImageUrl,
                        nickname,
                        intro
                );
                return new ConvertedImage(originalImageUrl, generatedImageUrl, usedCount);
            } catch (IOException | RuntimeException e) {
                releaseImageConversion(phoneNumberKey);
                throw e;
            }
        } finally {
            imageConversionSlots.release();
        }
    }

    private void releaseImageConversion(String phoneNumberKey) {
        try {
            transactionTemplate.executeWithoutResult(status ->
                    phoneUsageRepository.findByPhoneNumberForUpdate(phoneNumberKey)
                            .ifPresent(AiMatchPhoneUsage::releaseImageConversion));
        } catch (RuntimeException e) {
            log.warn("이미지 변환 횟수를 되돌리지 못했습니다: {}", e.toString());
        }
    }

    private record ConvertedImage(String originalImageUrl, String generatedImageUrl, int usedCount) {
    }

    public AiMatchProfileResponseDto createProfile(
            String nickname,
            String gender,
            String intro,
            String pin,
            String phoneNumber,
            String meetPlace,
            boolean consent,
            MultipartFile file,
            String originalImageUrl,
            String generatedImageUrl,
            String realName,
            String birthDate,
            String birthTime
    ) throws IOException {
        ensureRegistrationOpen();
        if (!consent) {
            throw new ResponseStatusException(BAD_REQUEST, "프로필 공개 동의가 필요합니다.");
        }

        String safeRealName = trimRequired(realName, "realName", 40);
        LocalDate safeBirthDate = parseBirthDate(birthDate);
        LocalTime safeBirthTime = parseBirthTime(birthTime);
        String safeNickname = trimRequired(nickname, "nickname", 40);
        String safeGender = normalizeGender(gender);
        String safeIntro = trimRequired(intro, "intro", 500);
        String safePin = trimRequired(pin, "pin", 20);
        String safePhoneNumber = normalizePhoneNumber(phoneNumber, true);
        String safePhoneNumberKey = normalizePhoneNumberKey(safePhoneNumber, true);
        String safeMeetPlace = trimRequired(meetPlace, "meetPlace", 120);
        validatePin(safePin);
        // ① 가입할 수 있는지 먼저 확인한다(짧은 트랜잭션). OpenAI 를 부르기 전에 걸러서 헛돈을 쓰지 않는다.
        transactionTemplate.executeWithoutResult(status ->
                ensureCanRegister(safePhoneNumberKey, safeNickname));
        if (!aiImageGenerationService.isConfigured()) {
            throw new ResponseStatusException(
                    BAD_REQUEST,
                    "OPENAI_API_KEY is required for webtoon image conversion."
            );
        }
        String safeOriginalImageUrl = trimOrNull(originalImageUrl);
        String safeGeneratedImageUrl = trimOrNull(generatedImageUrl);
        if (safeGeneratedImageUrl == null && (file == null || file.isEmpty())) {
            throw new ResponseStatusException(BAD_REQUEST, "프로필 사진을 먼저 업로드해 주세요.");
        }
        if (safeGeneratedImageUrl != null) {
            safeGeneratedImageUrl = uploadStorageService.canonicalProfileImageUrl(
                    safeGeneratedImageUrl, UploadStorageService.PROFILE_GENERATED_PREFIX);
            uploadStorageService.resolveUploadUrl(safeGeneratedImageUrl);
            if (safeOriginalImageUrl != null) {
                safeOriginalImageUrl = uploadStorageService.canonicalProfileImageUrl(
                        safeOriginalImageUrl, UploadStorageService.PROFILE_ORIGINAL_PREFIX);
                uploadStorageService.resolveUploadUrl(safeOriginalImageUrl);
            }
        } else {
            ConvertedImage converted = convertProfileImage(file, safePhoneNumberKey, safeNickname, safeIntro);
            safeOriginalImageUrl = converted.originalImageUrl();
            safeGeneratedImageUrl = converted.generatedImageUrl();
        }

        // ② 트랜잭션 밖: 사주 풀이(OpenAI)와 비밀번호 암호화. 사주 풀이는 실패해도 가입을 막지 않는다 — 규칙 기반 풀이로 대신한다.
        SajuPillars pillars = sajuService.calculate(safeBirthDate, safeBirthTime);
        String reading = sajuService.writeReading(pillars, safeNickname, safeGender);
        String pinHash = passwordEncoder.encode(safePin);

        // ③ 번호를 잠그고 다시 확인한 뒤 저장한다. (그 사이 같은 번호 · 닉네임으로 가입했을 수 있다)
        String originalUrl = safeOriginalImageUrl;
        String generatedUrl = safeGeneratedImageUrl;
        return transactionTemplate.execute(status -> {
            ensureCanRegister(safePhoneNumberKey, safeNickname);
            AiMatchProfile saved = profileRepository.save(new AiMatchProfile(
                    safeNickname,
                    safeGender,
                    safeIntro,
                    pinHash,
                    safePhoneNumber,
                    safeMeetPlace,
                    originalUrl,
                    generatedUrl,
                    true
            ));
            saved.updateSaju(safeRealName, safeBirthDate, safeBirthTime, reading);
            return toProfileDto(saved);
        });
    }

    /** 이 번호 · 닉네임으로 가입할 수 있는지. 번호 행을 잠그므로 트랜잭션 안에서 부른다. */
    private void ensureCanRegister(String phoneNumberKey, String nickname) {
        AiMatchPhoneUsage phoneUsage = getOrCreatePhoneUsageForUpdate(phoneNumberKey);
        ensurePhoneNumberNotDeleted(phoneNumberKey);
        ensurePhoneCanRegister(phoneUsage);
        ensurePhoneNumberAvailable(phoneNumberKey, null);
        ensureNicknameAvailable(nickname, null);
    }

    @Transactional
    public AiMatchProfileAccessResponseDto accessProfile(AiMatchProfileAccessRequestDto requestDto) {
        return access(requestDto, true);
    }

    /** 신청함 갱신용. 사람 목록(전원의 소개글 · 사주 · 궁합)은 무거워서 뺀다 — 응답의 profiles 는 null. */
    @Transactional
    public AiMatchProfileAccessResponseDto accessInbox(AiMatchProfileAccessRequestDto requestDto) {
        return access(requestDto, false);
    }

    private AiMatchProfileAccessResponseDto access(AiMatchProfileAccessRequestDto requestDto, boolean includeProfiles) {
        AiMatchProfile profile = authenticateProfile(requestDto.nickname(), requestDto.pin());
        List<AiMatchRequest> receivedRequests = requestRepository.findAllByProfileIdOrderByCreatedAtDesc(profile.getId());
        List<AiMatchRequest> sentRequests = requestRepository.findAllByRequesterProfileIdOrderByCreatedAtDesc(profile.getId());
        closeRequestsWithInactiveParticipants(Stream.concat(receivedRequests.stream(), sentRequests.stream()).toList());
        expireStaleMeetupProposals(Stream.concat(receivedRequests.stream(), sentRequests.stream()).toList());
        return new AiMatchProfileAccessResponseDto(
                toProfileDto(profile),
                profile.getPhoneNumber(),
                toPhoneUsageDto(profile),
                receivedRequests.stream()
                        .map(request -> toRequestDto(request, profile))
                        .toList(),
                sentRequests.stream()
                        .map(request -> toRequestDto(request, profile))
                        .toList(),
                includeProfiles ? getDiscoverableProfiles(profile.getId(), profile) : null,
                favoriteRepository.findActiveProfileIdsByRequesterProfileId(profile.getId()),
                toRequestQuotaDto(sentRequests)
        );
    }

    /** 상대가 계정을 지워서 닫힌 신청은 내 잘못이 아니니 횟수에서 뺀다. */
    private static boolean countsTowardQuota(AiMatchRequest request) {
        return !"PROFILE_DELETED".equals(request.getStatusReason());
    }

    private static AiMatchRequestQuotaDto toRequestQuotaDto(List<AiMatchRequest> sentRequests) {
        int used = (int) sentRequests.stream().filter(AiMatchService::countsTowardQuota).count();
        return new AiMatchRequestQuotaDto(
                MAX_SENT_REQUESTS_PER_PROFILE,
                used,
                Math.max(0, MAX_SENT_REQUESTS_PER_PROFILE - used)
        );
    }

    @Transactional
    public AiMatchAdminOverviewDto getAdminOverview() {
        List<AiMatchProfile> profiles = profileRepository.findAll().stream()
                .sorted(Comparator.comparing(AiMatchProfile::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
        List<AiMatchRequest> requests = requestRepository.findAllByOrderByCreatedAtDesc();
        closeRequestsWithInactiveParticipants(requests);
        Map<Long, Long> receivedCounts = requests.stream()
                .filter(request -> request.getProfile() != null && request.getProfile().getId() != null)
                .collect(Collectors.groupingBy(request -> request.getProfile().getId(), Collectors.counting()));
        Map<Long, Long> sentCounts = requests.stream()
                .map(AiMatchRequest::getRequesterProfile)
                .filter(profile -> profile != null && profile.getId() != null)
                .collect(Collectors.groupingBy(AiMatchProfile::getId, Collectors.counting()));
        Map<Long, Long> pendingReceivedCounts = requests.stream()
                .filter(request -> "PENDING".equals(request.getStatus()))
                .filter(request -> request.getProfile() != null && request.getProfile().getId() != null)
                .collect(Collectors.groupingBy(request -> request.getProfile().getId(), Collectors.counting()));
        Map<Long, Long> matchedCounts = requests.stream()
                .filter(request -> isMatchedStatus(request.getStatus()))
                .flatMap(request -> Stream.of(
                        request.getProfile() == null ? null : request.getProfile().getId(),
                        request.getRequesterProfile() == null ? null : request.getRequesterProfile().getId()
                ))
                .filter(id -> id != null)
                .collect(Collectors.groupingBy(id -> id, Collectors.counting()));

        List<AiMatchReport> reports = reportRepository.findAllByOrderByCreatedAtDesc();
        Map<Long, Long> openReportCounts = reports.stream()
                .filter(report -> "OPEN".equals(report.getStatus()))
                .collect(Collectors.groupingBy(AiMatchReport::getTargetProfileId, Collectors.counting()));
        List<AiMatchAdminProfileDto> profileDtos = profiles.stream()
                .map(profile -> toAdminProfileDto(
                        profile,
                        receivedCounts.getOrDefault(profile.getId(), 0L),
                        sentCounts.getOrDefault(profile.getId(), 0L),
                        pendingReceivedCounts.getOrDefault(profile.getId(), 0L),
                        matchedCounts.getOrDefault(profile.getId(), 0L),
                        openReportCounts.getOrDefault(profile.getId(), 0L)
                ))
                .toList();
        Map<Long, AiMatchMeetupSlot> slotsByRequestId = meetupSlotService.findByRequestIds(
                requests.stream().filter(request -> "PROPOSED".equals(request.getStatus())).map(AiMatchRequest::getId).toList());
        List<AiMatchAdminRequestDto> requestDtos = requests.stream()
                .map(request -> toAdminRequestDto(request, slotsByRequestId.get(request.getId())))
                .toList();

        return new AiMatchAdminOverviewDto(
                profiles.stream().filter(profile -> "ACTIVE".equals(profile.getStatus())).count(),
                profiles.size(),
                requests.size(),
                requests.stream().filter(request -> "PENDING".equals(request.getStatus())).count(),
                requests.stream().filter(request -> isMatchedStatus(request.getStatus())).count(),
                profileDtos,
                requestDtos,
                reports.stream().map(this::toReportDto).toList(),
                reports.stream().filter(report -> "OPEN".equals(report.getStatus())).count(),
                profiles.stream()
                        .filter(profile -> "ACTIVE".equals(profile.getStatus()))
                        .filter(profile -> "PENDING".equals(profile.getPhotoReview()))
                        .count(),
                isRegistrationOpen()
        );
    }

    @Transactional
    public AiMatchProfileResponseDto updateProfile(Long profileId, AiMatchProfileUpdateDto requestDto) throws IOException {
        AiMatchProfile profile = authenticateProfile(requestDto.currentNickname(), requestDto.pin());
        if (!profile.getId().equals(profileId)) {
            throw new ResponseStatusException(UNAUTHORIZED, "Profile credentials do not match this profile.");
        }

        String safeNickname = trimRequired(requestDto.nickname(), "nickname", 40);
        String safeGender = normalizeGender(requestDto.gender());
        String safeIntro = trimRequired(requestDto.intro(), "intro", 500);
        String safePhoneNumber = normalizePhoneNumber(requestDto.phoneNumber(), false);
        String safeMeetPlace = trimRequired(requestDto.meetPlace(), "meetPlace", 120);
        String safeOriginalImageUrl = trimOrNull(requestDto.originalImageUrl());
        String safeGeneratedImageUrl = trimOrNull(requestDto.generatedImageUrl());
        if (safePhoneNumber != null) {
            String requestedPhoneNumberKey = normalizePhoneNumberKey(safePhoneNumber, true);
            String currentPhoneNumberKey = phoneNumberKeyFromStored(profile.getPhoneNumber());
            if (currentPhoneNumberKey != null && !currentPhoneNumberKey.equals(requestedPhoneNumberKey)) {
                throw new ResponseStatusException(CONFLICT, "AI 과사용 방지를 위해 전화번호는 가입 후 변경할 수 없습니다.");
            }
            ensurePhoneNumberNotDeleted(requestedPhoneNumberKey);
            ensurePhoneCanRegister(getOrCreatePhoneUsageForUpdate(requestedPhoneNumberKey));
            ensurePhoneNumberAvailable(requestedPhoneNumberKey, profileId);
        }
        // 이미 저장된 주소를 그대로 돌려보낸 경우는 다시 확인하지 않는다(예전 방식으로 저장된 프로필이 수정에서 막히지 않게).
        if (safeGeneratedImageUrl != null && !safeGeneratedImageUrl.equals(profile.getGeneratedImageUrl())) {
            safeGeneratedImageUrl = uploadStorageService.canonicalProfileImageUrl(
                    safeGeneratedImageUrl, UploadStorageService.PROFILE_GENERATED_PREFIX);
            uploadStorageService.resolveUploadUrl(safeGeneratedImageUrl);
        }
        if (safeOriginalImageUrl != null && !safeOriginalImageUrl.equals(profile.getOriginalImageUrl())) {
            safeOriginalImageUrl = uploadStorageService.canonicalProfileImageUrl(
                    safeOriginalImageUrl, UploadStorageService.PROFILE_ORIGINAL_PREFIX);
            uploadStorageService.resolveUploadUrl(safeOriginalImageUrl);
        }
        ensureNicknameAvailable(safeNickname, profileId);

        profile.updateProfile(
                safeNickname,
                safeGender,
                safeIntro,
                safeMeetPlace,
                safePhoneNumber,
                safeOriginalImageUrl,
                safeGeneratedImageUrl
        );

        // 생년월일이 바뀌었거나(또는 처음 넣었으면) 사주를 다시 세운다. 안 바뀌었으면 기존 풀이를 그대로 둔다.
        String updatedRealName = trimOrNull(requestDto.realName());
        LocalDate updatedBirthDate = requestDto.birthDate() == null || requestDto.birthDate().isBlank()
                ? null
                : parseBirthDate(requestDto.birthDate());
        LocalTime updatedBirthTime = parseBirthTime(requestDto.birthTime());
        if (updatedBirthDate != null) {
            boolean changed = !updatedBirthDate.equals(profile.getBirthDate())
                    || !java.util.Objects.equals(updatedBirthTime, profile.getBirthTime());
            if (changed || profile.getSajuReading() == null) {
                SajuPillars pillars = sajuService.calculate(updatedBirthDate, updatedBirthTime);
                String reading = sajuService.writeReading(pillars, safeNickname, safeGender);
                profile.updateSaju(
                        updatedRealName == null ? profile.getRealName() : updatedRealName,
                        updatedBirthDate,
                        updatedBirthTime,
                        reading
                );
            } else if (updatedRealName != null) {
                profile.updateSaju(updatedRealName, updatedBirthDate, updatedBirthTime, profile.getSajuReading());
            }
        }

        return toProfileDto(profile);
    }

    @Transactional
    public AiMatchAdminRequestDto updateConnectionStatus(Long requestId, AiMatchConnectionStatusUpdateDto requestDto) {
        AiMatchRequest request = requestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "데이트 신청을 찾을 수 없습니다."));
        ensureRequestParticipantsActive(request);
        if (!isMatchedStatus(request.getStatus())) {
            throw new ResponseStatusException(CONFLICT, "성사된 매치만 연결 상태를 변경할 수 있습니다.");
        }
        String safeConnectionStatus = normalizeConnectionStatus(requestDto.connectionStatus());
        request.updateConnectionStatus(safeConnectionStatus);
        return toAdminRequestDto(request);
    }

    @Transactional
    public AiMatchAdminRequestDto updateAdminNote(Long requestId, AiMatchAdminNoteUpdateDto requestDto) {
        AiMatchRequest request = requestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "데이트 신청을 찾을 수 없습니다."));
        ensureRequestParticipantsActive(request);
        if (!isMatchedStatus(request.getStatus())) {
            throw new ResponseStatusException(CONFLICT, "성사된 매치만 관리자 메모를 남길 수 있습니다.");
        }
        String safeAdminNote = trimOptional(requestDto == null ? "" : requestDto.adminNote(), 1000);
        request.updateAdminNote(safeAdminNote);
        return toAdminRequestDto(request);
    }

    @Transactional
    public void deleteProfile(Long profileId, AiMatchProfileDeleteDto requestDto) {
        AiMatchProfile profile = authenticateProfile(requestDto.currentNickname(), requestDto.pin());
        if (!profile.getId().equals(profileId)) {
            throw new ResponseStatusException(UNAUTHORIZED, "Profile credentials do not match this profile.");
        }
        profile.deactivate();
        favoriteRepository.deleteAllByRequesterProfileIdOrProfileId(profileId, profileId);
        cooldownPhoneNumber(profile.getPhoneNumber());
        closeRequestsForDeletedProfile(profileId);
    }

    @Transactional
    public void deleteProfileByAdmin(Long profileId) {
        AiMatchProfile profile = profileRepository.findById(profileId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "AI match profile not found."));
        profile.deactivate();
        favoriteRepository.deleteAllByRequesterProfileIdOrProfileId(profileId, profileId);
        blockPhoneNumber(profile.getPhoneNumber());
        closeRequestsForDeletedProfile(profileId);
    }

    @Transactional
    public AiMatchAdminPhonePurgeResponseDto purgeByPhoneNumber(AiMatchAdminPhonePurgeRequestDto requestDto) {
        String phoneNumberKey = normalizePhoneNumberKey(requestDto.phoneNumber(), true);
        List<AiMatchProfile> targetProfiles = profileRepository.findAll().stream()
                .filter(profile -> phoneNumberKey.equals(phoneNumberKeyFromStored(profile.getPhoneNumber())))
                .toList();
        List<Long> targetProfileIds = targetProfiles.stream()
                .map(AiMatchProfile::getId)
                .toList();
        List<String> imageUrls = targetProfiles.stream()
                .flatMap(profile -> Stream.of(profile.getOriginalImageUrl(), profile.getGeneratedImageUrl()))
                .filter(url -> url != null && !url.isBlank())
                .distinct()
                .toList();

        long deletedFavorites = targetProfileIds.isEmpty()
                ? 0
                : favoriteRepository.deleteAllReferencingProfileIds(targetProfileIds);
        if (!targetProfileIds.isEmpty()) {
            chatMessageRepository.deleteAllForProfileIds(targetProfileIds);
        }
        long deletedRequests = targetProfileIds.isEmpty()
                ? 0
                : requestRepository.deleteAllReferencingProfileIds(targetProfileIds);
        if (!targetProfileIds.isEmpty()) {
            targetProfileIds.forEach(id -> reportRepository.deleteAllByReporterProfileIdOrTargetProfileId(id, id));
            profileRepository.deleteAllByIdInBatch(targetProfileIds);
        }
        long deletedPhoneUsage = phoneUsageRepository.deleteByPhoneNumber(phoneNumberKey);
        ImageFileDeleteResult imageFileDeleteResult = deleteProfileImageFiles(imageUrls);

        return new AiMatchAdminPhonePurgeResponseDto(
                phoneNumberKey,
                targetProfileIds.size(),
                Math.toIntExact(deletedRequests),
                Math.toIntExact(deletedFavorites),
                Math.toIntExact(deletedPhoneUsage),
                imageFileDeleteResult.deletedCount(),
                imageFileDeleteResult.failedCount()
        );
    }

    // ---------- 신고 · 숨김 · 사진 검수 ----------

    private static final java.util.Set<String> REPORT_REASONS = java.util.Set.of(
            "INAPPROPRIATE_PHOTO", "OFFENSIVE_MESSAGE", "FAKE_PROFILE", "HARASSMENT", "OTHER"
    );

    @Transactional
    public AiMatchReportDto createReport(Long targetProfileId, AiMatchReportCreateDto requestDto) {
        AiMatchProfile reporter = authenticateProfile(requestDto.nickname(), requestDto.pin());
        AiMatchProfile target = profileRepository.findById(targetProfileId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "존재하지 않는 프로필입니다."));
        if (reporter.getId().equals(target.getId())) {
            throw new ResponseStatusException(BAD_REQUEST, "자기 자신은 신고할 수 없습니다.");
        }
        String reason = requestDto.reason() == null ? "" : requestDto.reason().trim().toUpperCase();
        if (!REPORT_REASONS.contains(reason)) {
            throw new ResponseStatusException(BAD_REQUEST, "신고 사유를 골라 주세요.");
        }
        if (reportRepository.existsByReporterProfileIdAndTargetProfileIdAndStatus(reporter.getId(), target.getId(), "OPEN")) {
            throw new ResponseStatusException(CONFLICT, "이미 접수된 신고가 있어요. 운영진이 확인 중입니다.");
        }
        AiMatchReport saved = reportRepository.save(new AiMatchReport(
                reporter.getId(),
                reporter.getNickname(),
                target.getId(),
                target.getNickname(),
                reason,
                trimOptional(requestDto.detail(), 500)
        ));
        return toReportDto(saved);
    }

    @Transactional
    public AiMatchReportDto resolveReport(Long reportId, AiMatchReportResolveDto requestDto) {
        AiMatchReport report = reportRepository.findById(reportId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "신고를 찾을 수 없습니다."));
        String action = requestDto == null || requestDto.action() == null ? "DISMISS" : requestDto.action().trim().toUpperCase();
        String note = trimOptional(requestDto == null ? "" : requestDto.note(), 200);
        AiMatchProfile target = profileRepository.findById(report.getTargetProfileId()).orElse(null);
        if ("HIDE".equals(action) && target != null) {
            target.setHidden(true, note.isEmpty() ? "신고 처리" : note);
        } else if ("DELETE".equals(action) && target != null && "ACTIVE".equals(target.getStatus())) {
            deleteProfileByAdmin(target.getId());
        } else if (!"DISMISS".equals(action)) {
            throw new ResponseStatusException(BAD_REQUEST, "처리 방법이 올바르지 않습니다.");
        }
        report.resolve(action + (note.isEmpty() ? "" : " · " + note));
        return toReportDto(report);
    }

    @Transactional
    public AiMatchAdminProfileDto setProfileHidden(Long profileId, AiMatchAdminHiddenDto requestDto) {
        AiMatchProfile profile = profileRepository.findById(profileId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "AI match profile not found."));
        profile.setHidden(requestDto.hidden(), trimOptional(requestDto.reason(), 200));
        return adminProfileSnapshot(profile);
    }

    @Transactional
    public AiMatchAdminProfileDto reviewPhoto(Long profileId, AiMatchAdminPhotoReviewDto requestDto) {
        AiMatchProfile profile = profileRepository.findById(profileId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "AI match profile not found."));
        String decision = requestDto == null || requestDto.decision() == null ? "" : requestDto.decision().trim().toUpperCase();
        if ("APPROVED".equals(decision)) {
            profile.setPhotoReview("APPROVED");
            // 사진 반려로 숨겨 둔 사람이면 승인과 함께 다시 보이게 한다
            if (profile.isHidden() && profile.getHiddenReason() != null && profile.getHiddenReason().startsWith("사진 반려")) {
                profile.setHidden(false, null);
            }
        } else if ("REJECTED".equals(decision)) {
            String reason = trimOptional(requestDto.reason(), 150);
            profile.setPhotoReview("REJECTED");
            profile.setHidden(true, "사진 반려" + (reason.isEmpty() ? "" : " · " + reason));
        } else {
            throw new ResponseStatusException(BAD_REQUEST, "승인 또는 반려만 고를 수 있습니다.");
        }
        return adminProfileSnapshot(profile);
    }

    /** 통계 없이 프로필 한 장만 다시 그릴 때. 숫자는 0으로 두고 프런트가 기존 값을 유지한다. */
    private AiMatchAdminProfileDto adminProfileSnapshot(AiMatchProfile profile) {
        long openReports = reportRepository.findAllByOrderByCreatedAtDesc().stream()
                .filter(report -> "OPEN".equals(report.getStatus()) && profile.getId().equals(report.getTargetProfileId()))
                .count();
        return toAdminProfileDto(profile, 0, 0, 0, 0, openReports);
    }

    private AiMatchReportDto toReportDto(AiMatchReport report) {
        return new AiMatchReportDto(
                report.getId(),
                report.getReporterProfileId(),
                report.getReporterNickname(),
                report.getTargetProfileId(),
                report.getTargetNickname(),
                report.getReason(),
                report.getDetail(),
                report.getStatus(),
                report.getResolution(),
                report.getCreatedAt(),
                report.getResolvedAt()
        );
    }

    // ---------- 부스 현장: 도착 체크 · 만남 완료 · 노쇼 ----------

    @Transactional
    public AiMatchAdminRequestDto markArrival(Long requestId, AiMatchAdminArrivalDto requestDto) {
        AiMatchRequest request = findMeetupRequest(requestId);
        String side = requestDto == null || requestDto.side() == null ? "" : requestDto.side().trim().toUpperCase();
        if (!"REQUESTER".equals(side) && !"PROFILE".equals(side)) {
            throw new ResponseStatusException(BAD_REQUEST, "누가 도착했는지 골라 주세요.");
        }
        request.markArrival("REQUESTER".equals(side), requestDto.arrived());
        return toAdminRequestDto(request);
    }

    /** 스태프가 한 사람의 안내 단계를 바꾼다(출발하기 · 만났어요 · 부스 도착 · 되돌리기). */
    @Transactional
    public AiMatchAdminRequestDto setEscortStage(Long requestId, AiMatchAdminEscortDto requestDto) {
        AiMatchRequest request = findMeetupRequest(requestId);
        if (request.getMeetupAt() == null) {
            throw new ResponseStatusException(CONFLICT, "잡힌 약속이 없습니다.");
        }
        String side = requestDto == null || requestDto.side() == null ? "" : requestDto.side().trim().toUpperCase();
        if (!"REQUESTER".equals(side) && !"PROFILE".equals(side)) {
            throw new ResponseStatusException(BAD_REQUEST, "누구의 단계인지 골라 주세요.");
        }
        String stage = requestDto.stage() == null ? "" : requestDto.stage().trim().toUpperCase();
        if (!AiMatchRequest.ESCORT_STAGES.contains(stage)) {
            throw new ResponseStatusException(BAD_REQUEST, "알 수 없는 단계입니다.");
        }
        // 화면이 본 단계와 지금 단계가 다르면 그 사이 다른 스태프가 바꾼 것이다. 늦게 갱신된 폰이 단계를 되감지 않게 바꾸지 않는다.
        String fromStage = requestDto.fromStage() == null ? "" : requestDto.fromStage().trim().toUpperCase();
        if (!fromStage.isEmpty() && !fromStage.equals(request.escortStage("REQUESTER".equals(side)))) {
            throw new ResponseStatusException(CONFLICT, "다른 스태프가 방금 이 사람의 단계를 바꿨어요. 화면을 새로 읽었으니 다시 확인해 주세요.");
        }
        request.setEscortStage("REQUESTER".equals(side), stage);
        syncChatWithEscort(request);
        return toAdminRequestDto(request);
    }

    /**
     * 스태프가 '채팅 시작'을 누른다. 두 사람이 모두 부스에 도착해 있어야 하고, 누르는 순간 채팅 시간이 흐르기 시작한다.
     * 이미 시작한 채팅이면 그대로 둔다(두 번 눌러도 시간이 다시 시작되지 않는다).
     */
    @Transactional
    public AiMatchAdminRequestDto startBlindChat(Long requestId) {
        AiMatchRequest request = findMeetupRequest(requestId);
        if (!"CONFIRMED".equals(request.getStatus()) || request.getMeetupAt() == null) {
            throw new ResponseStatusException(CONFLICT, "확정된 약속이 없습니다.");
        }
        if (!request.bothAtBooth()) {
            throw new ResponseStatusException(CONFLICT, "두 사람이 모두 부스에 도착한 뒤에 시작할 수 있어요.");
        }
        request.startChat();
        return toAdminRequestDto(request);
    }

    /**
     * 채팅을 시작해 놓고 '부스 도착'을 되돌린 경우(잘못 누름), 아직 아무 말도 선택도 없으면 채팅을 다시 닫아 시간을 돌려준다.
     * 채팅을 여는 것은 스태프의 '채팅 시작'(startBlindChat)뿐이다.
     */
    private void syncChatWithEscort(AiMatchRequest request) {
        if (request.bothAtBooth()) {
            return;
        }
        if (request.getChatStartedAt() != null
                && request.getReveal(true) == null
                && request.getReveal(false) == null
                && chatMessageRepository.countByRequestIdAndTypeAndCreatedAtGreaterThanEqual(
                        request.getId(), "TEXT", request.getChatStartedAt()) == 0) {
            request.resetChat();
        }
    }

    /** 채팅방 입장 확인: 닉네임·비밀번호가 맞고 이 신청의 당사자인지. */
    @Transactional(readOnly = true)
    public com.festflow.backend.dto.AiMatchChatParticipantDto authenticateChatParticipant(
            Long requestId, AiMatchProfileAccessRequestDto requestDto) {
        AiMatchProfile profile = authenticateProfile(requestDto.nickname(), requestDto.pin());
        AiMatchRequest request = getParticipatingRequest(requestId, profile);
        boolean requesterSide = request.getRequesterProfile() != null
                && request.getRequesterProfile().getId().equals(profile.getId());
        return new com.festflow.backend.dto.AiMatchChatParticipantDto(request.getId(), profile.getId(), requesterSide);
    }

    /** 참가자가 대기 장소에 도착해 '도착했어요'를 누른다. 확정된 약속, 약속 1시간 전부터 30분 뒤까지. */
    @Transactional
    public AiMatchRequestResponseDto markSelfArrived(Long requestId, AiMatchProfileAccessRequestDto requestDto) {
        AiMatchProfile profile = authenticateProfile(requestDto.nickname(), requestDto.pin());
        AiMatchRequest request = getParticipatingRequest(requestId, profile);
        if (!"CONFIRMED".equals(request.getStatus()) || request.getMeetupAt() == null) {
            throw new ResponseStatusException(CONFLICT, "확정된 약속이 없습니다.");
        }
        LocalDateTime now = LocalDateTime.now();
        if (now.isBefore(request.getMeetupAt().minusMinutes(SELF_ARRIVAL_OPEN_MINUTES))) {
            throw new ResponseStatusException(CONFLICT, "약속 " + SELF_ARRIVAL_OPEN_MINUTES + "분 전부터 누를 수 있어요.");
        }
        if (now.isAfter(request.getMeetupAt().plusMinutes(30))) {
            throw new ResponseStatusException(CONFLICT, "약속 시간이 지났어요. 부스 스태프에게 알려 주세요.");
        }
        boolean requesterSide = request.getRequesterProfile() != null && request.getRequesterProfile().getId().equals(profile.getId());
        request.markArrival(requesterSide, true);
        return toRequestDto(request);
    }

    /**
     * 약속 전 알림 문자. 1분마다 돌며 앞으로 meetupReminderMinutes 분 안에 시작하는 확정 약속에 한 번씩 보낸다.
     * 두 사람에게 각자 기다릴 곳을 알린다. 보냈다는 표시를 먼저 저장해 중복 발송을 막는다.
     */
    @Transactional
    public int sendDueMeetupReminders() {
        LocalDateTime now = LocalDateTime.now();
        List<AiMatchRequest> due = requestRepository.findAllByStatusAndMeetupAtBetweenAndMeetupReminderSentAtIsNull(
                "CONFIRMED", now, now.plusMinutes(meetupReminderMinutes));
        List<Runnable> sends = new java.util.ArrayList<>();
        for (AiMatchRequest request : due) {
            if (request.getMeetupOutcome() != null) {
                continue;
            }
            request.markReminderSent();
            String[] places = waitingPlaces(request.getRequesterProfile(), request.getProfile());
            LocalDateTime at = request.getMeetupAt();
            String requesterPhone = request.getRequesterProfile() == null ? "" : request.getRequesterProfile().getPhoneNumber();
            String profilePhone = request.getProfile() == null ? "" : request.getProfile().getPhoneNumber();
            sends.add(() -> aiMatchSmsNotifier.notifyMeetupReminder(requesterPhone, at, places[0]));
            sends.add(() -> aiMatchSmsNotifier.notifyMeetupReminder(profilePhone, at, places[1]));
        }
        if (!sends.isEmpty()) {
            // 한 통이 실패해도 같은 분에 보낼 다른 커플의 알림은 나가야 한다(보냈다는 표시는 이미 저장됨).
            afterCommit(() -> sends.forEach(send -> {
                try {
                    send.run();
                } catch (Exception e) {
                    log.warn("AI match meetup reminder SMS failed.", e);
                }
            }));
        }
        return sends.size() / 2;
    }

    @Transactional
    public AiMatchAdminRequestDto markMet(Long requestId) {
        AiMatchRequest request = findMeetupRequest(requestId);
        // 채팅 전이나 채팅 중에 누르면 채팅이 열리지 못하거나 바로 닫힌다. 얼굴 보기 결과가 나온 뒤에만 받는다.
        String phase = request.chatPhase(LocalDateTime.now(), chatMinutes, chatChooseMinutes);
        if (!"MATCH".equals(phase) && !"NO_MATCH".equals(phase)) {
            throw new ResponseStatusException(CONFLICT, "만남 완료는 채팅이 끝나 얼굴 보기 결과가 나온 뒤에 누를 수 있어요.");
        }
        request.markMet();
        return toAdminRequestDto(request);
    }

    /** 노쇼 처리. 슬롯을 바로 반납해 다음 쌍이 쓸 수 있게 하고, 매칭은 남겨 둔다. */
    @Transactional
    public AiMatchAdminRequestDto markNoShow(Long requestId, AiMatchAdminNoShowDto requestDto) {
        AiMatchRequest request = findMeetupRequest(requestId);
        String side = requestDto == null || requestDto.side() == null ? "BOTH" : requestDto.side().trim().toUpperCase();
        String outcome = switch (side) {
            case "REQUESTER" -> "NO_SHOW_REQUESTER";
            case "PROFILE" -> "NO_SHOW_PROFILE";
            case "BOTH" -> "NO_SHOW_BOTH";
            default -> throw new ResponseStatusException(BAD_REQUEST, "누가 안 왔는지 골라 주세요.");
        };
        // 채팅을 시작했다면 두 사람 다 온 것이다. 여기서 노쇼로 바꾸면 채팅 결과가 지워지고 두 사람에게 취소 문자가 나간다.
        if (request.getChatStartedAt() != null || "MET".equals(request.getMeetupOutcome())) {
            throw new ResponseStatusException(CONFLICT, "채팅을 시작한 커플은 노쇼로 처리할 수 없어요. 두 사람 모두 온 약속이에요.");
        }
        // 확정된 약속이었으면 두 사람에게 취소 문자를 보낸다. 기다린 사람이 영문도 모르고 서 있지 않게.
        boolean wasConfirmed = "CONFIRMED".equals(request.getStatus());
        LocalDateTime meetupAt = request.getMeetupAt();
        String requesterPhone = request.getRequesterProfile() == null ? "" : request.getRequesterProfile().getPhoneNumber();
        String profilePhone = request.getProfile() == null ? "" : request.getProfile().getPhoneNumber();
        boolean requesterAbsent = !"PROFILE".equals(side);
        boolean profileAbsent = !"REQUESTER".equals(side);
        meetupSlotService.release(request.getId());
        request.markNoShow(outcome);
        if (wasConfirmed && meetupAt != null) {
            afterCommit(() -> {
                aiMatchSmsNotifier.notifyMeetupNoShow(requesterPhone, meetupAt, requesterAbsent);
                aiMatchSmsNotifier.notifyMeetupNoShow(profilePhone, meetupAt, profileAbsent);
            });
        }
        return toAdminRequestDto(request);
    }

    private AiMatchRequest findMeetupRequest(Long requestId) {
        AiMatchRequest request = requestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "데이트 신청을 찾을 수 없습니다."));
        if (!isMatchedStatus(request.getStatus())) {
            throw new ResponseStatusException(CONFLICT, "성사된 매치만 현장 처리할 수 있습니다.");
        }
        return request;
    }

    /** 마스터 콘솔 카드 한 칸. */
    @Transactional(readOnly = true)
    public AiMatchMasterSummaryDto getMasterSummary() {
        List<AiMatchProfile> profiles = profileRepository.findAll();
        List<AiMatchRequest> requests = requestRepository.findAllByOrderByCreatedAtDesc();
        LocalDateTime now = LocalDateTime.now();
        LocalDate today = now.toLocalDate();
        List<AiMatchRequest> withMeetup = requests.stream()
                .filter(request -> request.getMeetupAt() != null && isMatchedStatus(request.getStatus()))
                .toList();
        AiMatchRequest next = withMeetup.stream()
                .filter(request -> !request.getMeetupAt().plusMinutes(AiMatchMeetupSlotService.SLOT_MINUTES).isBefore(now))
                .min(Comparator.comparing(AiMatchRequest::getMeetupAt))
                .orElse(null);
        return new AiMatchMasterSummaryDto(
                profiles.stream().filter(profile -> "ACTIVE".equals(profile.getStatus())).count(),
                requests.stream().filter(request -> isMatchedStatus(request.getStatus())).count(),
                requests.stream().filter(request -> "PENDING".equals(request.getStatus())).count(),
                reportRepository.countByStatus("OPEN"),
                profiles.stream().filter(profile -> "ACTIVE".equals(profile.getStatus()) && "PENDING".equals(profile.getPhotoReview())).count(),
                withMeetup.stream().filter(request -> request.getMeetupAt().toLocalDate().equals(today)).count(),
                next == null ? null : next.getMeetupAt(),
                next == null ? "" : next.getRequesterNickname() + " · " + (next.getProfile() == null ? "" : next.getProfile().getNickname())
        );
    }

    // ---------- 보고서용 CSV ----------

    @Transactional(readOnly = true)
    public String exportAdminCsv() {
        return exportAdminCsv(false);
    }

    /** statsOnly 면 닉네임·메모 없이 숫자만. 운영 끝나고 데이터를 지우기 전에 남겨 두는 용도. */
    @Transactional(readOnly = true)
    public String exportAdminCsv(boolean statsOnly) {
        List<AiMatchProfile> profiles = profileRepository.findAll();
        List<AiMatchRequest> requests = requestRepository.findAllByOrderByCreatedAtDesc();
        StringBuilder out = new StringBuilder();
        out.append('\uFEFF');
        out.append("구분,항목,값\n");
        long active = profiles.stream().filter(p -> "ACTIVE".equals(p.getStatus())).count();
        long matched = requests.stream().filter(r -> isMatchedStatus(r.getStatus())).count();
        long met = requests.stream().filter(r -> "MET".equals(r.getMeetupOutcome())).count();
        long noShow = requests.stream().filter(r -> r.getMeetupOutcome() != null && r.getMeetupOutcome().startsWith("NO_SHOW")).count();
        csvRow(out, "요약", "활성 프로필", active);
        csvRow(out, "요약", "전체 프로필", profiles.size());
        csvRow(out, "요약", "전체 신청", requests.size());
        csvRow(out, "요약", "성사", matched);
        csvRow(out, "요약", "부스 만남 완료", met);
        csvRow(out, "요약", "노쇼", noShow);
        csvRow(out, "요약", "성사율(%)", requests.isEmpty() ? 0 : Math.round(matched * 100.0 / requests.size()));
        profiles.stream()
                .filter(p -> "ACTIVE".equals(p.getStatus()))
                .collect(Collectors.groupingBy(p -> p.getGender() == null ? "미상" : p.getGender(), java.util.TreeMap::new, Collectors.counting()))
                .forEach((gender, count) -> csvRow(out, "성별", gender, count));
        requests.stream()
                .filter(r -> r.getCreatedAt() != null)
                .collect(Collectors.groupingBy(r -> r.getCreatedAt().toLocalDate() + " " + String.format("%02d시", r.getCreatedAt().getHour()), java.util.TreeMap::new, Collectors.counting()))
                .forEach((hour, count) -> csvRow(out, "시간대별 신청", hour, count));
        requests.stream()
                .collect(Collectors.groupingBy(r -> r.getStatus() == null ? "" : r.getStatus(), java.util.TreeMap::new, Collectors.counting()))
                .forEach((status, count) -> csvRow(out, "신청 상태", status, count));

        profiles.stream()
                .filter(p -> p.getCreatedAt() != null)
                .collect(Collectors.groupingBy(p -> p.getCreatedAt().toLocalDate().toString(), java.util.TreeMap::new, Collectors.counting()))
                .forEach((day, count) -> csvRow(out, "날짜별 가입", day, count));
        profiles.stream()
                .filter(p -> p.getCreatedAt() != null)
                .collect(Collectors.groupingBy(p -> String.format("%02d시", p.getCreatedAt().getHour()), java.util.TreeMap::new, Collectors.counting()))
                .forEach((hour, count) -> csvRow(out, "시간대별 가입", hour, count));
        profiles.stream()
                .collect(Collectors.groupingBy(p -> p.getGender() == null ? "미상" : p.getGender(), java.util.TreeMap::new, Collectors.counting()))
                .forEach((gender, count) -> csvRow(out, "성별(탈퇴 포함)", gender, count));
        profiles.stream()
                .filter(p -> p.getBirthDate() != null)
                .collect(Collectors.groupingBy(p -> p.getBirthDate().getYear() + "년생", java.util.TreeMap::new, Collectors.counting()))
                .forEach((year, count) -> csvRow(out, "출생연도", year, count));
        profiles.stream()
                .collect(Collectors.groupingBy(p -> p.getStatus() == null ? "" : p.getStatus(), java.util.TreeMap::new, Collectors.counting()))
                .forEach((status, count) -> csvRow(out, "프로필 상태", status, count));
        csvRow(out, "요약", "사진 변환한 프로필", profiles.stream().filter(p -> p.getGeneratedImageUrl() != null && !p.getGeneratedImageUrl().isBlank()).count());
        csvRow(out, "요약", "신고 접수", reportRepository.count());
        requests.stream()
                .filter(r -> r.getCreatedAt() != null && isMatchedStatus(r.getStatus()))
                .collect(Collectors.groupingBy(r -> r.getCreatedAt().toLocalDate().toString(), java.util.TreeMap::new, Collectors.counting()))
                .forEach((day, count) -> csvRow(out, "날짜별 성사", day, count));
        requests.stream()
                .filter(r -> r.getRequesterProfile() != null && r.getProfile() != null)
                .collect(Collectors.groupingBy(r -> (r.getRequesterProfile().getGender() == null ? "미상" : r.getRequesterProfile().getGender())
                        + "→" + (r.getProfile().getGender() == null ? "미상" : r.getProfile().getGender()), java.util.TreeMap::new, Collectors.counting()))
                .forEach((pair, count) -> csvRow(out, "신청 방향(성별)", pair, count));
        if (statsOnly) {
            return out.toString();
        }

        out.append("\n신청ID,신청 시각,신청자,신청자 성별,상대,상대 성별,상태,연결 상태,약속 시각,약속 장소,만남 결과,신청자 도착,상대 도착,관리자 메모\n");
        for (AiMatchRequest r : requests) {
            AiMatchProfile requester = r.getRequesterProfile();
            AiMatchProfile profile = r.getProfile();
            out.append(String.join(",",
                    csv(r.getId()),
                    csv(r.getCreatedAt()),
                    csv(r.getRequesterNickname()),
                    csv(requester == null ? "" : requester.getGender()),
                    csv(profile == null ? "" : profile.getNickname()),
                    csv(profile == null ? "" : profile.getGender()),
                    csv(r.getStatus()),
                    csv(r.getConnectionStatus()),
                    csv(r.getMeetupAt()),
                    csv(r.getMeetupPlace()),
                    csv(r.getMeetupOutcome()),
                    csv(r.getRequesterArrivedAt()),
                    csv(r.getProfileArrivedAt()),
                    csv(r.getAdminNote())
            )).append("\n");
        }
        return out.toString();
    }

    private static void csvRow(StringBuilder out, String group, String label, Object value) {
        out.append(csv(group)).append(',').append(csv(label)).append(',').append(csv(value)).append("\n");
    }

    private static String csv(Object value) {
        if (value == null) {
            return "";
        }
        String text = value instanceof LocalDateTime dateTime
                ? dateTime.toString().replace('T', ' ')
                : String.valueOf(value);
        // 엑셀이 수식으로 읽는 접두사(= + - @ 탭)는 따옴표로 막는다.
        if (!text.isEmpty() && "=+-@\t\r".indexOf(text.charAt(0)) >= 0) {
            text = "'" + text;
        }
        if (text.contains(",") || text.contains("\"") || text.contains("\n") || text.startsWith("'")) {
            return "\"" + text.replace("\"", "\"\"") + "\"";
        }
        return text;
    }

    @Transactional
    public AiMatchFavoriteResponseDto toggleFavorite(Long profileId, AiMatchProfileAccessRequestDto requestDto) {
        AiMatchProfile requesterProfile = authenticateProfile(requestDto.nickname(), requestDto.pin());
        AiMatchProfile profile = profileRepository.findById(profileId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "AI match profile not found."));
        if (!"ACTIVE".equals(profile.getStatus())) {
            throw new ResponseStatusException(NOT_FOUND, "존재하지 않는 프로필입니다.");
        }
        if (requesterProfile.getId().equals(profile.getId())) {
            throw new ResponseStatusException(BAD_REQUEST, "자기 자신은 좋아요할 수 없습니다.");
        }

        boolean favorite = favoriteRepository
                .findByRequesterProfileIdAndProfileId(requesterProfile.getId(), profile.getId())
                .map(existing -> {
                    favoriteRepository.delete(existing);
                    return false;
                })
                .orElseGet(() -> {
                    favoriteRepository.save(new AiMatchFavorite(requesterProfile, profile));
                    return true;
                });

        return new AiMatchFavoriteResponseDto(
                profile.getId(),
                favorite,
                favoriteRepository.findActiveProfileIdsByRequesterProfileId(requesterProfile.getId())
        );
    }

    @Transactional
    public AiMatchRequestResponseDto createRequest(Long profileId, AiMatchRequestCreateDto requestDto) {
        AiMatchProfile profile = profileRepository.findById(profileId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "AI match profile not found."));
        if (!"ACTIVE".equals(profile.getStatus())) {
            throw new ResponseStatusException(NOT_FOUND, "존재하지 않는 프로필입니다.");
        }
        AiMatchProfile requesterProfile = authenticateProfile(requestDto.requesterNickname(), requestDto.requesterPin());
        if (requesterProfile.getId().equals(profile.getId())) {
            throw new ResponseStatusException(BAD_REQUEST, "자기 자신에게는 데이트 신청을 보낼 수 없습니다.");
        }
        if (requestRepository.existsByRequesterProfileIdAndProfileIdAndStatus(requesterProfile.getId(), profile.getId(), "PENDING")) {
            throw new ResponseStatusException(CONFLICT, "이미 대기 중인 데이트 신청이 있습니다.");
        }
        List<AiMatchRequest> sentRequests = requestRepository.findAllByRequesterProfileIdOrderByCreatedAtDesc(requesterProfile.getId());
        closeRequestsWithInactiveParticipants(sentRequests);
        if (toRequestQuotaDto(sentRequests).remaining() <= 0) {
            throw new ResponseStatusException(
                    CONFLICT,
                    "데이트 신청은 한 사람당 " + MAX_SENT_REQUESTS_PER_PROFILE + "번까지만 보낼 수 있어요. 이미 다 썼어요."
            );
        }
        String meetPlace = trimRequired(requestDto.meetPlace(), "meetPlace", 120);
        String message = trimRequired(requestDto.message(), "message", 500);

        AiMatchRequest saved = requestRepository.save(new AiMatchRequest(
                profile,
                requesterProfile,
                requesterProfile.getNickname(),
                meetPlace,
                message
        ));
        String targetPhoneNumber = profile.getPhoneNumber();
        afterCommit(() -> aiMatchSmsNotifier.notifyRequestCreated(targetPhoneNumber));
        return toRequestDto(saved);
    }

    @Transactional
    public AiMatchRequestResponseDto acceptRequest(Long requestId, AiMatchProfileAccessRequestDto requestDto) {
        AiMatchProfile profile = authenticateProfile(requestDto.nickname(), requestDto.pin());
        AiMatchRequest request = requestRepository.findByIdAndProfileId(requestId, profile.getId())
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "데이트 신청을 찾을 수 없습니다."));
        ensureRequestParticipantsActive(request);
        ensurePendingRequest(request);
        request.accept();
        AiMatchProfile requesterProfile = request.getRequesterProfile();
        String requesterPhoneNumber = requesterProfile == null ? "" : requesterProfile.getPhoneNumber();
        afterCommit(() -> aiMatchSmsNotifier.notifyRequestAccepted(requesterPhoneNumber));
        return toRequestDto(request);
    }

    @Transactional
    public AiMatchRequestResponseDto rejectRequest(Long requestId, AiMatchProfileAccessRequestDto requestDto) {
        AiMatchProfile profile = authenticateProfile(requestDto.nickname(), requestDto.pin());
        AiMatchRequest request = requestRepository.findByIdAndProfileId(requestId, profile.getId())
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "데이트 신청을 찾을 수 없습니다."));
        ensureRequestParticipantsActive(request);
        ensurePendingRequest(request);
        request.reject();
        return toRequestDto(request);
    }

    @Transactional
    public AiMatchRequestResponseDto cancelRequest(Long requestId, AiMatchProfileAccessRequestDto requestDto) {
        AiMatchProfile profile = authenticateProfile(requestDto.nickname(), requestDto.pin());
        AiMatchRequest request = requestRepository.findByIdAndRequesterProfileId(requestId, profile.getId())
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "보낸 데이트 신청을 찾을 수 없습니다."));
        if (!isRequestBetweenActiveProfiles(request)) {
            cancelRequestIfOpen(request);
            return toRequestDto(request);
        }
        ensurePendingRequest(request);
        request.cancel();
        return toRequestDto(request);
    }

    @Transactional
    public AiMatchRequestResponseDto proposeMeetup(Long requestId, AiMatchMeetupProposalDto requestDto) {
        AiMatchProfile profile = authenticateProfile(requestDto.nickname(), requestDto.pin());
        AiMatchRequest request = getParticipatingRequest(requestId, profile);
        ensureRequestParticipantsActive(request);
        ensureMeetupProposalAllowed(request);
        // 상대가 이미 제안해 둔 걸 두고 내가 다른 시간을 내면 '다른 시간 제안'이다.
        boolean counter = "PROPOSED".equals(request.getStatus())
                && request.getMeetupProposerProfileId() != null
                && !request.getMeetupProposerProfileId().equals(profile.getId());

        // 장소는 늘 소개팅 부스. 시간은 20분 슬롯이고, 고르는 순간 30분 동안 임시로 잠긴다.
        LocalDateTime meetupAt = requestDto.meetupAt();
        meetupSlotService.purge();
        ensureNoNearbyMeetup(request, meetupAt);
        AiMatchMeetupSlot heldSlot = meetupSlotService.hold(request.getId(), meetupAt);
        String meetupPlace = AiMatchMeetupSlotService.BOOTH_NAME;

        request.proposeMeetup(meetupPlace, meetupAt, profile.getId(), profile.getNickname());
        String partnerPhone = partnerPhoneNumber(request, profile);
        // 약속이 가까우면 잠금이 30분보다 일찍 풀린다. 문자에는 실제로 남은 시간을 적는다.
        int holdMinutes = heldSlot == null || heldSlot.getHeldUntil() == null
                ? meetupSlotService.getHoldMinutes()
                : (int) Math.max(1, java.time.Duration.between(LocalDateTime.now(), heldSlot.getHeldUntil()).plusSeconds(59).toMinutes());
        afterCommit(() -> aiMatchSmsNotifier.notifyMeetupProposed(partnerPhone, meetupAt, holdMinutes, counter));
        return toRequestDto(request);
    }

    // 임시 예약이 풀린 걸 발견하면 약속을 지운 채로 409 를 돌려준다. 그 지움이 롤백되면 안 된다.
    @Transactional(noRollbackFor = ResponseStatusException.class)
    public AiMatchRequestResponseDto confirmMeetup(Long requestId, AiMatchProfileAccessRequestDto requestDto) {
        AiMatchProfile profile = authenticateProfile(requestDto.nickname(), requestDto.pin());
        AiMatchRequest request = getParticipatingRequest(requestId, profile);
        ensureRequestParticipantsActive(request);
        if (!"PROPOSED".equals(request.getStatus())) {
            throw new ResponseStatusException(CONFLICT, "확정할 약속 제안이 없습니다.");
        }
        if (request.getMeetupProposerProfileId() != null && request.getMeetupProposerProfileId().equals(profile.getId())) {
            throw new ResponseStatusException(CONFLICT, "상대방이 제안한 약속만 확정할 수 있습니다.");
        }

        meetupSlotService.purge();
        if (request.getMeetupAt() != null && hasNearbyMeetup(request, request.getMeetupAt())) {
            meetupSlotService.release(request.getId());
            request.clearMeetup();
            requestRepository.saveAndFlush(request);
            throw new ResponseStatusException(CONFLICT, NEARBY_MEETUP_MESSAGE);
        }
        if (meetupSlotService.confirm(request.getId()).isEmpty()) {
            request.clearMeetup();
            requestRepository.saveAndFlush(request);
            throw new ResponseStatusException(CONFLICT, "제안한 시간의 임시 예약이 풀렸어요. 시간을 다시 골라 주세요.");
        }
        request.confirmMeetup();
        String proposerPhone = partnerPhoneNumber(request, profile);
        LocalDateTime confirmedAt = request.getMeetupAt();
        afterCommit(() -> aiMatchSmsNotifier.notifyMeetupConfirmed(proposerPhone, confirmedAt));
        return toRequestDto(request);
    }

    /**
     * 확정 전 시간 제안을 취소(제안한 사람)하거나 거절(받은 사람)한다. 슬롯을 다시 열고 매칭 상태로 되돌린다.
     * 확정된 약속은 참가자가 바꾸거나 취소할 수 없다. 부득이한 경우 부스 스태프가 관리자 화면에서 노쇼·슬롯 반납으로 처리한다.
     */
    @Transactional
    public AiMatchRequestResponseDto cancelMeetup(Long requestId, AiMatchProfileAccessRequestDto requestDto) {
        AiMatchProfile profile = authenticateProfile(requestDto.nickname(), requestDto.pin());
        AiMatchRequest request = getParticipatingRequest(requestId, profile);
        ensureRequestParticipantsActive(request);
        if ("CONFIRMED".equals(request.getStatus())) {
            throw new ResponseStatusException(CONFLICT, CONFIRMED_LOCKED_MESSAGE);
        }
        if (!"PROPOSED".equals(request.getStatus())) {
            throw new ResponseStatusException(CONFLICT, "취소할 약속이 없습니다.");
        }
        boolean withdrawnByProposer = profile.getId().equals(request.getMeetupProposerProfileId());
        String partnerPhone = partnerPhoneNumber(request, profile);
        meetupSlotService.release(request.getId());
        request.clearMeetup();
        afterCommit(() -> {
            if (withdrawnByProposer) {
                aiMatchSmsNotifier.notifyMeetupWithdrawn(partnerPhone);
            } else {
                aiMatchSmsNotifier.notifyMeetupDeclined(partnerPhone);
            }
        });
        return toRequestDto(request);
    }

    /**
     * 부스 시간을 못 잡은(확정 약속이 없는) 성사 커플이 연락처를 주고받기로 동의한다.
     * 한쪽만 동의한 동안은 상대에게 번호가 가지 않고 "상대가 동의했어요" 문자만 간다.
     * 둘 다 동의하는 순간 두 사람 모두에게 알리고, 그 뒤 신청함 응답에 서로 번호가 실린다. 되돌리기는 없다.
     * 확정 약속이 있으면 막는다 — 부스에서 만나는 게 본래 흐름이다.
     */
    @Transactional
    public AiMatchRequestResponseDto consentContactShare(Long requestId, AiMatchProfileAccessRequestDto requestDto) {
        AiMatchProfile profile = authenticateProfile(requestDto.nickname(), requestDto.pin());
        // 두 사람이 동시에 눌러도 한 줄로: 행을 잠그고 읽어야 먼저 저장된 상대 동의가 안 지워진다.
        AiMatchRequest request = requestRepository.findByIdForUpdate(requestId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "데이트 신청을 찾을 수 없습니다."));
        ensureParticipating(request, profile);
        ensureRequestParticipantsActive(request);
        if (!isMatchedStatus(request.getStatus())) {
            throw new ResponseStatusException(CONFLICT, "성사된 매치에서만 연락처를 주고받을 수 있어요.");
        }
        if ("CONFIRMED".equals(request.getStatus())) {
            throw new ResponseStatusException(CONFLICT, "부스 약속이 잡혀 있어요. 약속 시간에 부스에서 만나 주세요.");
        }
        boolean requesterSide = isRequesterSide(request, profile);
        if (request.hasContactConsent(requesterSide)) {
            return toRequestDto(request, profile);
        }
        request.consentContactShare(requesterSide);
        String partnerPhone = partnerPhoneNumber(request, profile);
        String myPhone = profile.getPhoneNumber() == null ? "" : profile.getPhoneNumber();
        if (request.isContactShared()) {
            afterCommit(() -> {
                aiMatchSmsNotifier.notifyContactShared(partnerPhone);
                aiMatchSmsNotifier.notifyContactShared(myPhone);
            });
        } else {
            afterCommit(() -> aiMatchSmsNotifier.notifyContactShareAsked(partnerPhone));
        }
        return toRequestDto(request, profile);
    }

    private static boolean isRequesterSide(AiMatchRequest request, AiMatchProfile me) {
        AiMatchProfile requester = request.getRequesterProfile();
        return requester != null && requester.getId().equals(me.getId());
    }

    /** 요청의 두 사람 중 me 가 아닌 쪽의 전화번호. 없으면 빈 문자열. */
    private String partnerPhoneNumber(AiMatchRequest request, AiMatchProfile me) {
        AiMatchProfile requester = request.getRequesterProfile();
        AiMatchProfile target = request.getProfile();
        AiMatchProfile partner = requester != null && requester.getId().equals(me.getId()) ? target : requester;
        String phone = partner == null ? null : partner.getPhoneNumber();
        return phone == null ? "" : phone;
    }

    @Transactional
    public AiMatchMeetupSlotsDto getMeetupSlots(String date, Long requestId) {
        if (requestId == null) {
            return meetupSlotService.getSlots(date, null);
        }
        meetupSlotService.purge();
        List<LocalDateTime> busy = requestRepository.findById(requestId)
                .map(this::otherMeetupTimes)
                .orElse(List.of());
        return meetupSlotService.getSlots(date, requestId, busy);
    }

    private static final int SELF_ARRIVAL_OPEN_MINUTES = 60;

    private static final String CONFIRMED_LOCKED_MESSAGE =
            "확정된 약속은 앱에서 바꾸거나 취소할 수 없어요. 부득이하게 못 오면 소개팅 부스 스태프에게 알려 주세요.";

    private static final String NEARBY_MEETUP_MESSAGE =
            "두 사람 중 한 명의 다른 약속과 너무 가까워요. 앞뒤 " + AiMatchMeetupSlotService.PERSONAL_GAP_MINUTES + "분은 비워 두고 골라 주세요.";

    /** 이 신청의 두 사람이 다른 신청으로 잡아 둔(임시 포함) 약속 시각들. */
    private List<LocalDateTime> otherMeetupTimes(AiMatchRequest request) {
        java.util.Set<Long> participantIds = new java.util.HashSet<>();
        if (request.getRequesterProfile() != null) {
            participantIds.add(request.getRequesterProfile().getId());
        }
        if (request.getProfile() != null) {
            participantIds.add(request.getProfile().getId());
        }
        java.util.Set<Long> otherRequestIds = new java.util.HashSet<>();
        for (Long participantId : participantIds) {
            for (AiMatchRequest other : requestRepository.findAllByProfileIdOrRequesterProfileId(participantId, participantId)) {
                if (!other.getId().equals(request.getId())) {
                    otherRequestIds.add(other.getId());
                }
            }
        }
        return meetupSlotService.findByRequestIds(otherRequestIds).values().stream()
                .map(com.festflow.backend.entity.AiMatchMeetupSlot::getSlotAt)
                .toList();
    }

    private boolean hasNearbyMeetup(AiMatchRequest request, LocalDateTime meetupAt) {
        return otherMeetupTimes(request).stream().anyMatch(at -> AiMatchMeetupSlotService.isTooClose(at, meetupAt));
    }

    private void ensureNoNearbyMeetup(AiMatchRequest request, LocalDateTime meetupAt) {
        if (meetupAt != null && hasNearbyMeetup(request, meetupAt)) {
            throw new ResponseStatusException(CONFLICT, NEARBY_MEETUP_MESSAGE);
        }
    }

    public static final String RESET_CONFIRM_PHRASE = "소개팅 전체 삭제";

    /** 지난 운영 데이터 전부 파기: 계정·신청·찜·시간 칸·신고·번호 기록과 사진 파일. 되돌릴 수 없다. */
    @Transactional
    public com.festflow.backend.dto.AiMatchAdminResetResultDto resetAll(com.festflow.backend.dto.AiMatchAdminResetRequestDto requestDto) {
        String confirm = requestDto == null || requestDto.confirm() == null ? "" : requestDto.confirm().trim();
        if (!RESET_CONFIRM_PHRASE.equals(confirm)) {
            throw new ResponseStatusException(BAD_REQUEST, "확인 문구가 맞지 않아요. '" + RESET_CONFIRM_PHRASE + "'를 그대로 입력해 주세요.");
        }
        List<AiMatchProfile> profiles = profileRepository.findAll();
        List<String> imageUrls = profiles.stream()
                .flatMap(profile -> Stream.of(profile.getOriginalImageUrl(), profile.getGeneratedImageUrl()))
                .filter(url -> url != null && !url.isBlank())
                .distinct()
                .toList();
        long favorites = favoriteRepository.count();
        long reports = reportRepository.count();
        long requests = requestRepository.count();
        long phoneUsages = phoneUsageRepository.count();
        favoriteRepository.deleteAllInBatch();
        reportRepository.deleteAllInBatch();
        long slots = meetupSlotService.deleteAllSlots();
        chatMessageRepository.deleteAllInBatch();
        requestRepository.deleteAllInBatch();
        profileRepository.deleteAllInBatch();
        phoneUsageRepository.deleteAllInBatch();
        ImageFileDeleteResult files = deleteProfileImageFiles(imageUrls);
        // 가입 전 미리보기로 올라갔다가 계정에 안 붙은 사진도 개인 사진이라 같이 지운다.
        // S3 목록 조회 권한(s3:ListBucket)이 없으면 이 단계만 건너뛰고 나머지 삭제는 그대로 끝낸다.
        int[] leftovers;
        try {
            leftovers = uploadStorageService.deleteAllWithPrefix("ai-profile-");
        } catch (Exception exception) {
            log.warn("남은 프로필 사진 정리 실패(권한 확인 필요): {}", exception.getMessage());
            leftovers = new int[]{0, 1};
        }
        return new com.festflow.backend.dto.AiMatchAdminResetResultDto(
                profiles.size(), requests, favorites, slots, reports, phoneUsages,
                files.deletedCount() + leftovers[0], files.failedCount() + leftovers[1]
        );
    }

    /** 운영진 시간표: 그날 잡힌 슬롯과 두 사람이 어디서 기다리는지. */
    @Transactional
    public AiMatchMeetupScheduleDto getAdminMeetupSchedule(String dateText) {
        meetupSlotService.purge();
        LocalDate date = meetupSlotService.resolveDate(dateText);
        List<AiMatchMeetupScheduleItemDto> items = meetupSlotService.findByDate(date).stream()
                .map(slot -> requestRepository.findById(slot.getRequestId())
                        .map(request -> toScheduleItem(slot, request))
                        .orElse(null))
                .filter(java.util.Objects::nonNull)
                .toList();
        return new AiMatchMeetupScheduleDto(
                date.toString(),
                meetupSlotService.getDates(),
                AiMatchMeetupSlotService.BOOTH_NAME,
                meetupSlotService.slotsPerDay(date),
                AiMatchMeetupSlotService.SLOT_MINUTES,
                meetupSlotService.openTime(date).toString(),
                meetupSlotService.lastSlotTime(date).toString(),
                LocalDateTime.now(),
                items,
                meetupSlotService.dayCounts(List.of())
        );
    }

    private AiMatchMeetupScheduleItemDto toScheduleItem(AiMatchMeetupSlot slot, AiMatchRequest request) {
        AiMatchProfile profile = request.getProfile();
        AiMatchProfile requesterProfile = request.getRequesterProfile();
        String[] places = waitingPlaces(requesterProfile, profile);
        return new AiMatchMeetupScheduleItemDto(
                slot.getSlotAt(),
                slot.isConfirmed(),
                slot.getHeldUntil(),
                request.getId(),
                request.getConnectionStatus(),
                request.getRequesterNickname(),
                requesterProfile == null ? "" : requesterProfile.getGender(),
                requesterProfile == null ? "" : requesterProfile.getPhoneNumber(),
                places[0],
                profile == null ? "" : profile.getNickname(),
                profile == null ? "" : profile.getGender(),
                profile == null ? "" : profile.getPhoneNumber(),
                places[1],
                request.getRequesterArrivedAt(),
                request.getProfileArrivedAt(),
                request.getMeetupOutcome(),
                request.escortStage(true),
                escortStageAt(request, true),
                request.escortStage(false),
                escortStageAt(request, false),
                request.getMeetupReminderSentAt(),
                request.chatPhase(LocalDateTime.now(), chatMinutes, chatChooseMinutes),
                request.getChatStartedAt() == null ? null : request.getChatStartedAt().plusMinutes(chatMinutes)
        );
    }

    /** 지금 단계가 된 시각. 단계가 NONE 이면 null. */
    private static LocalDateTime escortStageAt(AiMatchRequest request, boolean requesterSide) {
        return switch (request.escortStage(requesterSide)) {
            case "ARRIVED" -> requesterSide ? request.getRequesterArrivedAt() : request.getProfileArrivedAt();
            case "DEPARTED" -> requesterSide ? request.getRequesterStaffDepartedAt() : request.getProfileStaffDepartedAt();
            case "PICKED_UP" -> requesterSide ? request.getRequesterPickedUpAt() : request.getProfilePickedUpAt();
            case "AT_BOOTH" -> requesterSide ? request.getRequesterAtBoothAt() : request.getProfileAtBoothAt();
            default -> null;
        };
    }

    /**
     * [신청한 사람 대기 장소, 신청받은 사람 대기 장소].
     * 남녀면 성별대로. 성별이 같거나 알 수 없으면 신청한 쪽이 도서관, 받은 쪽이 성호관.
     */
    private static String[] waitingPlaces(AiMatchProfile requesterProfile, AiMatchProfile profile) {
        String requesterGender = requesterProfile == null ? "" : String.valueOf(requesterProfile.getGender());
        String profileGender = profile == null ? "" : String.valueOf(profile.getGender());
        boolean requesterFemale = requesterGender.contains("여");
        boolean profileFemale = profileGender.contains("여");
        if (requesterFemale && !profileFemale) {
            return new String[]{AiMatchMeetupSlotService.WAITING_PLACE_FEMALE, AiMatchMeetupSlotService.WAITING_PLACE_MALE};
        }
        return new String[]{AiMatchMeetupSlotService.WAITING_PLACE_MALE, AiMatchMeetupSlotService.WAITING_PLACE_FEMALE};
    }

    /** 제안만 해 두고 30분 안에 확정이 안 돼 슬롯이 풀린 신청은 '매칭됨'으로 되돌린다. */
    private void expireStaleMeetupProposals(List<AiMatchRequest> requests) {
        List<AiMatchRequest> proposed = requests.stream()
                .filter(request -> "PROPOSED".equals(request.getStatus()))
                .toList();
        if (proposed.isEmpty()) {
            return;
        }
        meetupSlotService.purge();
        Map<Long, AiMatchMeetupSlot> slots = meetupSlotService.findByRequestIds(
                proposed.stream().map(AiMatchRequest::getId).toList()
        );
        proposed.stream()
                .filter(request -> !slots.containsKey(request.getId()))
                .forEach(AiMatchRequest::clearMeetup);
    }

    private List<AiMatchProfileResponseDto> getDiscoverableProfiles(Long viewerProfileId) {
        return getDiscoverableProfiles(viewerProfileId, null);
    }

    private List<AiMatchProfileResponseDto> getDiscoverableProfiles(Long viewerProfileId, AiMatchProfile viewer) {
        return profileRepository.findAllByStatusOrderByCreatedAtDesc("ACTIVE").stream()
                .filter(profile -> !profile.getId().equals(viewerProfileId))
                .filter(profile -> !profile.isHidden())
                .map(profile -> toProfileDto(profile, viewer))
                .toList();
    }

    private void closeRequestsForDeletedProfile(Long profileId) {
        closeRequestsWithInactiveParticipants(requestRepository.findAllByProfileIdOrRequesterProfileId(profileId, profileId));
    }

    private ImageFileDeleteResult deleteProfileImageFiles(List<String> imageUrls) {
        int deletedCount = 0;
        int failedCount = 0;
        for (String imageUrl : imageUrls) {
            if (!uploadStorageService.isProfileImageUrl(imageUrl)) {
                failedCount += 1;
                continue;
            }
            try {
                if (uploadStorageService.deleteUploadUrl(imageUrl)) {
                    deletedCount += 1;
                }
            } catch (Exception ignored) {
                failedCount += 1;
            }
        }
        return new ImageFileDeleteResult(deletedCount, failedCount);
    }

    private void closeRequestsWithInactiveParticipants(List<AiMatchRequest> requests) {
        requests.stream()
                .filter(request -> !isRequestBetweenActiveProfiles(request))
                .forEach(this::cancelRequestIfOpen);
    }

    private void cancelRequestIfOpen(AiMatchRequest request) {
        if (!"CANCELED".equals(request.getStatus()) && !"REJECTED".equals(request.getStatus())) {
            request.cancelForProfileDeleted();
            return;
        }
        if ("CANCELED".equals(request.getStatus()) && request.getStatusReason().isBlank()) {
            request.cancelForProfileDeleted();
        }
    }

    private boolean isRequestBetweenActiveProfiles(AiMatchRequest request) {
        AiMatchProfile targetProfile = request.getProfile();
        AiMatchProfile requesterProfile = request.getRequesterProfile();
        return targetProfile != null
                && requesterProfile != null
                && "ACTIVE".equals(targetProfile.getStatus())
                && "ACTIVE".equals(requesterProfile.getStatus());
    }

    private void ensureRequestParticipantsActive(AiMatchRequest request) {
        if (!isRequestBetweenActiveProfiles(request)) {
            cancelRequestIfOpen(request);
            throw new ResponseStatusException(CONFLICT, "The other profile has been deleted.");
        }
    }

    /** 본인 프로필. 원본 사진 주소는 본인에게만 준다. */
    private AiMatchProfileResponseDto toProfileDto(AiMatchProfile profile) {
        return toProfileDto(profile, null, true);
    }

    /** 다른 사람에게 보이는 프로필. 원본(실제 얼굴) 사진 주소는 담지 않는다. */
    private AiMatchProfileResponseDto toProfileDto(AiMatchProfile profile, AiMatchProfile viewer) {
        return toProfileDto(profile, viewer, false);
    }

    /**
     * 프로필을 응답으로 옮긴다. 실명과 생년월일은 절대 담지 않는다 — 사주를 세우는 데만 쓴다.
     *
     * @param viewer 이 프로필을 보고 있는 사람. 주면 궁합 점수를 함께 계산한다.
     */
    private AiMatchProfileResponseDto toProfileDto(AiMatchProfile profile, AiMatchProfile viewer, boolean includeOriginalImage) {
        SajuDto saju = null;
        SajuCompatibilityDto compatibility = null;

        if (profile.hasSaju()) {
            SajuPillars pillars = sajuService.calculate(profile.getBirthDate(), profile.getBirthTime());
            saju = sajuService.toDto(pillars, profile.getSajuReading());

            boolean otherPerson = viewer != null && !viewer.getId().equals(profile.getId());
            if (otherPerson && viewer.hasSaju()) {
                SajuPillars viewerPillars = sajuService.calculate(viewer.getBirthDate(), viewer.getBirthTime());
                compatibility = sajuService.compatibility(viewerPillars, pillars);
            }
        }

        return new AiMatchProfileResponseDto(
                profile.getId(),
                profile.getNickname(),
                profile.getGender(),
                profile.getIntro(),
                profile.getMeetPlace(),
                includeOriginalImage ? profile.getOriginalImageUrl() : "",
                profile.getGeneratedImageUrl(),
                profile.getCreatedAt(),
                saju,
                compatibility
        );
    }

    private AiMatchPhoneCheckDto toPhoneUsageDto(AiMatchProfile profile) {
        String phoneNumberKey = phoneNumberKeyFromStored(profile.getPhoneNumber());
        AiMatchPhoneUsage phoneUsage = phoneNumberKey == null
                ? null
                : phoneUsageRepository.findByPhoneNumber(phoneNumberKey).orElse(null);
        int usedCount = phoneUsage == null ? 0 : phoneUsage.getSuccessfulImageConversionCount();
        int remainingCount = Math.max(0, MAX_SUCCESSFUL_IMAGE_CONVERSIONS_PER_PHONE - usedCount);
        boolean available = (phoneUsage == null || !phoneUsage.isBlocked()) && remainingCount > 0;
        String message = available
                ? "AI 변환 " + remainingCount + "회 남았습니다."
                : "이 전화번호는 AI 이미지 변환 가능 횟수를 모두 사용했습니다.";
        return new AiMatchPhoneCheckDto(
                phoneNumberKey == null ? "" : phoneNumberKey,
                available,
                usedCount,
                remainingCount,
                message
        );
    }

    private AiMatchAdminProfileDto toAdminProfileDto(
            AiMatchProfile profile,
            long receivedCount,
            long sentCount,
            long pendingReceivedCount,
            long matchedCount,
            long openReportCount
    ) {
        return new AiMatchAdminProfileDto(
                profile.getId(),
                profile.getNickname(),
                profile.getGender(),
                profile.getIntro(),
                profile.getMeetPlace(),
                profile.getPhoneNumber(),
                profile.getOriginalImageUrl(),
                profile.getGeneratedImageUrl(),
                profile.getStatus(),
                Math.toIntExact(receivedCount),
                Math.toIntExact(sentCount),
                Math.toIntExact(pendingReceivedCount),
                Math.toIntExact(matchedCount),
                profile.getCreatedAt(),
                profile.isHidden(),
                profile.getHiddenReason(),
                profile.getPhotoReview(),
                Math.toIntExact(openReportCount)
        );
    }

    private AiMatchProfile authenticateProfile(String nickname, String pin) {
        String safeNickname = trimRequired(nickname, "nickname", 40);
        String safePin = trimRequired(pin, "pin", 20);
        validatePin(safePin);
        String nicknameKey = safeNickname.toLowerCase();
        AiMatchProfile profile = profileRepository.findByNicknameIgnoreCaseAndStatus(safeNickname, "ACTIVE")
                .orElse(null);
        // 방금 확인한 비밀번호면 BCrypt 를 다시 돌리지 않는다. (앱이 15초마다 같은 닉네임 · 비밀번호로 부른다 — 매번 돌리면 CPU 가 버티지 못한다)
        // 이미 로그인해 있는 사람은 남이 비밀번호를 틀려서 생긴 잠금에도 걸리지 않는다.
        if (profile != null && profile.getPinHash() != null && isRecentlyVerified(profile, safePin)) {
            return profile;
        }
        // 잠금은 (닉네임 + 접속 IP) 로 센다. 남의 닉네임에 틀린 비밀번호를 넣어 그 사람을 잠그는 장난을 줄인다.
        // 여러 IP 에서 나눠 대입하는 것은 닉네임 전체 한도로 막는다.
        String ipKey = nicknameKey + "|" + currentClientIp();
        ensureNotLocked(ipKey, MAX_PIN_FAILURES);
        ensureNotLocked(nicknameKey, MAX_PIN_FAILURES_PER_NICKNAME);
        if (profile == null || profile.getPinHash() == null || !passwordEncoder.matches(safePin, profile.getPinHash())) {
            recordPinFailure(ipKey);
            recordPinFailure(nicknameKey);
            throw new ResponseStatusException(UNAUTHORIZED, "닉네임 또는 비밀번호가 올바르지 않습니다.");
        }
        pinFailures.remove(ipKey);
        rememberVerified(profile, safePin);
        return profile;
    }

    private static String currentClientIp() {
        if (org.springframework.web.context.request.RequestContextHolder.getRequestAttributes()
                instanceof org.springframework.web.context.request.ServletRequestAttributes attributes) {
            return com.festflow.backend.security.ClientIp.of(attributes.getRequest());
        }
        return "-";
    }

    /** 확인된 비밀번호의 지문(SHA-256). 비밀번호를 바꾸면 pinHash 가 달라져 저절로 무효가 된다. 메모리에만 둔다. */
    private record VerifiedPin(byte[] digest, long expiresAtMillis) {
    }

    private static final long VERIFIED_PIN_TTL_MILLIS = Duration.ofMinutes(15).toMillis();
    private final Map<Long, VerifiedPin> verifiedPins = new ConcurrentHashMap<>();

    private boolean isRecentlyVerified(AiMatchProfile profile, String pin) {
        VerifiedPin verified = verifiedPins.get(profile.getId());
        if (verified == null) {
            return false;
        }
        long now = System.currentTimeMillis();
        if (verified.expiresAtMillis() < now) {
            verifiedPins.remove(profile.getId(), verified);
            return false;
        }
        return java.security.MessageDigest.isEqual(verified.digest(), pinDigest(profile, pin));
    }

    private void rememberVerified(AiMatchProfile profile, String pin) {
        long now = System.currentTimeMillis();
        if (verifiedPins.size() > 20_000) {
            verifiedPins.entrySet().removeIf(entry -> entry.getValue().expiresAtMillis() < now);
        }
        verifiedPins.put(profile.getId(), new VerifiedPin(pinDigest(profile, pin), now + VERIFIED_PIN_TTL_MILLIS));
    }

    private static byte[] pinDigest(AiMatchProfile profile, String pin) {
        try {
            java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
            digest.update(profile.getPinHash().getBytes(java.nio.charset.StandardCharsets.UTF_8));
            digest.update((byte) 0);
            return digest.digest(pin.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    /** 닉네임별 비밀번호 실패 횟수. 10분 안에 10번 틀리면 남은 시간 동안 잠근다. */
    private static final class PinFailure {
        private Instant windowStart;
        private int count;

        private PinFailure(Instant windowStart) {
            this.windowStart = windowStart;
        }
    }

    private void ensureNotLocked(String failureKey, int maxFailures) {
        PinFailure failure = pinFailures.get(failureKey);
        if (failure == null) {
            return;
        }
        synchronized (failure) {
            Instant now = Instant.now();
            if (Duration.between(failure.windowStart, now).compareTo(PIN_FAILURE_WINDOW) >= 0) {
                pinFailures.remove(failureKey);
                return;
            }
            if (failure.count >= maxFailures) {
                long minutesLeft = Math.max(
                        1,
                        PIN_FAILURE_WINDOW.minus(Duration.between(failure.windowStart, now)).toMinutes() + 1
                );
                throw new ResponseStatusException(
                        TOO_MANY_REQUESTS,
                        "비밀번호를 여러 번 틀려서 잠시 잠겼어요. " + minutesLeft + "분 뒤에 다시 해 주세요."
                );
            }
        }
    }

    private void recordPinFailure(String failureKey) {
        if (pinFailures.size() > 20_000) {
            Instant cutoff = Instant.now().minus(PIN_FAILURE_WINDOW);
            pinFailures.entrySet().removeIf(entry -> entry.getValue().windowStart.isBefore(cutoff));
        }
        PinFailure failure = pinFailures.computeIfAbsent(failureKey, ignored -> new PinFailure(Instant.now()));
        synchronized (failure) {
            Instant now = Instant.now();
            if (Duration.between(failure.windowStart, now).compareTo(PIN_FAILURE_WINDOW) >= 0) {
                failure.windowStart = now;
                failure.count = 0;
            }
            failure.count++;
        }
    }

    private void ensureNicknameAvailable(String nickname, Long profileId) {
        boolean duplicated = profileId == null
                ? profileRepository.existsByNicknameIgnoreCaseAndStatus(nickname, "ACTIVE")
                : profileRepository.existsByNicknameIgnoreCaseAndStatusAndIdNot(nickname, "ACTIVE", profileId);
        if (duplicated) {
            throw new ResponseStatusException(CONFLICT, "이미 사용 중인 닉네임입니다.");
        }
    }

    private void validatePin(String pin) {
        if (pin.length() < 4 || pin.length() > 10 || pin.matches(".*\\s.*")) {
            throw new ResponseStatusException(BAD_REQUEST, "비밀번호는 4~10자여야 합니다.");
        }
    }

    private String normalizeGender(String gender) {
        String safeGender = trimRequired(gender, "gender", 20);
        if ("남성".equals(safeGender) || "여성".equals(safeGender)) {
            return safeGender;
        }
        throw new ResponseStatusException(BAD_REQUEST, "성별은 남자 또는 여자만 선택할 수 있습니다.");
    }

    private AiMatchRequestResponseDto toRequestDto(AiMatchRequest request) {
        return toRequestDto(request, null);
    }

    /**
     * 참가자 응답 한 줄. viewer 는 이 응답을 받는 참가자 — 두 사람 다 연락처 공유에 동의했을 때만
     * viewer 의 상대 번호를 싣는다. viewer 가 없으면(상태 바뀐 직후 응답 등) 번호는 비워 둔다(화면이 곧 신청함을 다시 받는다).
     */
    private AiMatchRequestResponseDto toRequestDto(AiMatchRequest request, AiMatchProfile viewer) {
        AiMatchProfile profile = request.getProfile();
        AiMatchProfile requesterProfile = request.getRequesterProfile();
        String sharedPhoneNumber = viewer != null && request.isContactShared() && isMatchedStatus(request.getStatus())
                ? partnerPhoneNumber(request, viewer)
                : "";
        LocalDateTime heldUntil = "PROPOSED".equals(request.getStatus())
                ? meetupSlotService.findByRequestIds(List.of(request.getId())).values().stream()
                        .map(AiMatchMeetupSlot::getHeldUntil)
                        .filter(java.util.Objects::nonNull)
                        .findFirst()
                        .orElse(null)
                : null;
        String[] places = waitingPlaces(requesterProfile, profile);
        return new AiMatchRequestResponseDto(
                request.getId(),
                profile == null ? null : profile.getId(),
                profile == null ? "" : profile.getNickname(),
                // 원본(실제 얼굴) 사진 주소는 참가자 응답에 담지 않는다. 관리자 응답에만 있다.
                "",
                profile == null ? "" : profile.getGeneratedImageUrl(),
                requesterProfile == null ? null : requesterProfile.getId(),
                request.getRequesterNickname(),
                "",
                requesterProfile == null ? "" : requesterProfile.getGeneratedImageUrl(),
                request.getMeetPlace(),
                request.getMessage(),
                request.getStatus(),
                request.getStatusReason(),
                request.getMeetupPlace(),
                request.getMeetupAt(),
                request.getMeetupProposerProfileId(),
                request.getMeetupProposerNickname(),
                request.getCreatedAt(),
                request.getUpdatedAt(),
                heldUntil,
                places[0],
                places[1],
                request.escortStage(true),
                escortStageAt(request, true),
                request.escortStage(false),
                escortStageAt(request, false),
                request.getMeetupOutcome(),
                request.chatPhase(LocalDateTime.now(), chatMinutes, chatChooseMinutes),
                request.getRequesterContactConsentAt(),
                request.getProfileContactConsentAt(),
                sharedPhoneNumber
        );
    }

    private AiMatchAdminRequestDto toAdminRequestDto(AiMatchRequest request) {
        AiMatchMeetupSlot slot = "PROPOSED".equals(request.getStatus())
                ? meetupSlotService.findByRequestIds(List.of(request.getId())).get(request.getId())
                : null;
        return toAdminRequestDto(request, slot);
    }

    /** 운영진 응답 한 줄. 시간 제안 중이면 슬롯 잠금(제안 시각·응답 기한)까지 같이 싣는다. */
    private AiMatchAdminRequestDto toAdminRequestDto(AiMatchRequest request, AiMatchMeetupSlot slot) {
        boolean proposing = "PROPOSED".equals(request.getStatus());
        AiMatchProfile profile = request.getProfile();
        AiMatchProfile requesterProfile = request.getRequesterProfile();
        return new AiMatchAdminRequestDto(
                request.getId(),
                profile == null ? null : profile.getId(),
                profile == null ? "" : profile.getNickname(),
                profile == null ? "" : profile.getPhoneNumber(),
                profile == null ? "" : profile.getOriginalImageUrl(),
                profile == null ? "" : profile.getGeneratedImageUrl(),
                requesterProfile == null ? null : requesterProfile.getId(),
                request.getRequesterNickname(),
                requesterProfile == null ? "" : requesterProfile.getPhoneNumber(),
                requesterProfile == null ? "" : requesterProfile.getOriginalImageUrl(),
                requesterProfile == null ? "" : requesterProfile.getGeneratedImageUrl(),
                request.getMeetPlace(),
                request.getMessage(),
                request.getStatus(),
                request.getStatusReason(),
                request.getConnectionStatus(),
                request.getAdminNote(),
                request.getCreatedAt(),
                request.getUpdatedAt(),
                request.getMeetupPlace(),
                request.getMeetupAt(),
                waitingPlaces(requesterProfile, profile)[0],
                waitingPlaces(requesterProfile, profile)[1],
                request.getRequesterArrivedAt(),
                request.getProfileArrivedAt(),
                request.getMeetupOutcome(),
                proposing ? request.getMeetupProposerProfileId() : null,
                proposing ? request.getMeetupProposerNickname() : null,
                proposing && slot != null ? slot.getCreatedAt() : null,
                proposing && slot != null ? slot.getHeldUntil() : null,
                request.getRequesterContactConsentAt(),
                request.getProfileContactConsentAt()
        );
    }

    private boolean isMatchedStatus(String status) {
        return "ACCEPTED".equals(status) || "PROPOSED".equals(status) || "CONFIRMED".equals(status);
    }

    private void afterCommit(Runnable task) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    task.run();
                }
            });
            return;
        }
        task.run();
    }

    private String normalizeConnectionStatus(String status) {
        String normalized = status == null ? "" : status.trim().toUpperCase();
        if ("WAITING".equals(normalized) || "COMPLETED".equals(normalized) || "FAILED".equals(normalized)) {
            return normalized;
        }
        throw new ResponseStatusException(BAD_REQUEST, "연결 상태가 올바르지 않습니다.");
    }

    private void ensurePendingRequest(AiMatchRequest request) {
        if (!"PENDING".equals(request.getStatus())) {
            throw new ResponseStatusException(CONFLICT, "이미 처리된 데이트 신청입니다.");
        }
    }

    private AiMatchRequest getParticipatingRequest(Long requestId, AiMatchProfile profile) {
        AiMatchRequest request = requestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "데이트 신청을 찾을 수 없습니다."));
        ensureParticipating(request, profile);
        return request;
    }

    /** profile 이 이 신청의 두 사람 중 하나가 아니면 막는다. */
    private static void ensureParticipating(AiMatchRequest request, AiMatchProfile profile) {
        AiMatchProfile requesterProfile = request.getRequesterProfile();
        boolean isParticipant = request.getProfile().getId().equals(profile.getId())
                || (requesterProfile != null && requesterProfile.getId().equals(profile.getId()));
        if (!isParticipant) {
            throw new ResponseStatusException(UNAUTHORIZED, "이 데이트 신청에 접근할 수 없습니다.");
        }
    }

    private void ensureMeetupProposalAllowed(AiMatchRequest request) {
        if (!"ACCEPTED".equals(request.getStatus()) && !"PROPOSED".equals(request.getStatus())) {
            throw new ResponseStatusException(CONFLICT, "약속을 조율할 수 있는 상태가 아닙니다.");
        }
    }

    /** 사주용 생년월일. 양력 기준이고 반드시 있어야 한다. */
    private LocalDate parseBirthDate(String value) {
        String trimmed = value == null ? "" : value.trim();
        if (trimmed.isEmpty()) {
            throw new ResponseStatusException(BAD_REQUEST, "생년월일을 입력해 주세요.");
        }
        LocalDate parsed;
        try {
            parsed = LocalDate.parse(trimmed);
        } catch (DateTimeException exception) {
            throw new ResponseStatusException(BAD_REQUEST, "생년월일 형식이 올바르지 않습니다. 예) 2003-05-15");
        }
        LocalDate today = LocalDate.now();
        if (parsed.isAfter(today)) {
            throw new ResponseStatusException(BAD_REQUEST, "생년월일이 오늘보다 뒤일 수 없습니다.");
        }
        if (parsed.isBefore(today.minusYears(120))) {
            throw new ResponseStatusException(BAD_REQUEST, "생년월일을 다시 확인해 주세요.");
        }
        return parsed;
    }

    /** 태어난 시간. 모르면 비워도 되고, 그러면 시주 없이 세 기둥만 나온다. */
    private LocalTime parseBirthTime(String value) {
        String trimmed = value == null ? "" : value.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        try {
            return LocalTime.parse(trimmed);
        } catch (DateTimeException exception) {
            throw new ResponseStatusException(BAD_REQUEST, "태어난 시간 형식이 올바르지 않습니다. 예) 14:30");
        }
    }

    private String trimRequired(String value, String field, int maxLength) {
        String trimmed = value == null ? "" : value.trim();
        if (trimmed.isEmpty()) {
            throw new ResponseStatusException(BAD_REQUEST, fieldLabel(field) + "을(를) 입력해 주세요.");
        }
        if (trimmed.length() > maxLength) {
            throw new ResponseStatusException(
                    BAD_REQUEST,
                    fieldLabel(field) + "은(는) " + maxLength + "자 이하로 입력해 주세요."
            );
        }
        return trimmed;
    }

    private String fieldLabel(String field) {
        return switch (field) {
            case "nickname" -> "닉네임";
            case "realName" -> "이름";
            case "gender" -> "성별";
            case "intro" -> "자기소개";
            case "pin" -> "비밀번호";
            case "phoneNumber" -> "전화번호";
            case "meetPlace" -> "만날 장소";
            case "requesterNickname" -> "신청자 닉네임";
            case "message" -> "메시지";
            default -> field;
        };
    }

    private String trimOrNull(String value) {
        String trimmed = value == null ? "" : value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String trimOptional(String value, int maxLength) {
        String trimmed = value == null ? "" : value.trim();
        if (trimmed.length() > maxLength) {
            throw new ResponseStatusException(BAD_REQUEST, "입력값은 최대 " + maxLength + "자 이하로 입력해 주세요.");
        }
        return trimmed;
    }

    private AiMatchPhoneUsage getOrCreatePhoneUsageForUpdate(String phoneNumberKey) {
        return phoneUsageRepository.findByPhoneNumberForUpdate(phoneNumberKey)
                .orElseGet(() -> phoneUsageRepository.saveAndFlush(new AiMatchPhoneUsage(phoneNumberKey)));
    }

    private void ensurePhoneCanRegister(AiMatchPhoneUsage phoneUsage) {
        if (phoneUsage.isBlocked()) {
            throw new ResponseStatusException(CONFLICT, "삭제된 프로필의 전화번호는 다시 가입할 수 없습니다.");
        }
        if (phoneUsage.isInCooldown()) {
            throw new ResponseStatusException(CONFLICT, COOLDOWN_MESSAGE);
        }
    }

    private void ensurePhoneCanGenerateImage(AiMatchPhoneUsage phoneUsage) {
        ensurePhoneCanRegister(phoneUsage);
        if (phoneUsage.getSuccessfulImageConversionCount() >= MAX_SUCCESSFUL_IMAGE_CONVERSIONS_PER_PHONE) {
            throw new ResponseStatusException(CONFLICT, "이 전화번호는 AI 이미지 변환 가능 횟수를 모두 사용했습니다.");
        }
    }

    private void ensurePhoneNumberNotDeleted(String phoneNumberKey) {
        if (isPhoneNumberDeleted(phoneNumberKey)) {
            throw new ResponseStatusException(CONFLICT, COOLDOWN_MESSAGE);
        }
    }

    /** 본인이 지운 번호는 잠깐만 막는다. 남의 번호로 가입했다 지워서 영구 차단시키는 장난을 막기 위함. */
    private void cooldownPhoneNumber(String phoneNumber) {
        String phoneNumberKey = phoneNumberKeyFromStored(phoneNumber);
        if (phoneNumberKey == null) {
            return;
        }
        getOrCreatePhoneUsageForUpdate(phoneNumberKey).startCooldown(SELF_DELETE_COOLDOWN_HOURS);
    }

    private void blockPhoneNumber(String phoneNumber) {
        String phoneNumberKey = phoneNumberKeyFromStored(phoneNumber);
        if (phoneNumberKey == null) {
            return;
        }
        getOrCreatePhoneUsageForUpdate(phoneNumberKey).block();
    }

    private void ensurePhoneNumberAvailable(String phoneNumberKey, Long profileId) {
        if (isPhoneNumberInUse(phoneNumberKey, profileId)) {
            throw new ResponseStatusException(CONFLICT, "이미 사용 중인 전화번호입니다.");
        }
    }

    private boolean isPhoneNumberInUse(String phoneNumberKey, Long profileId) {
        return profileRepository.findAllByStatusOrderByCreatedAtDesc("ACTIVE").stream()
                .filter(profile -> profileId == null || !profile.getId().equals(profileId))
                .map(profile -> phoneNumberKeyFromStored(profile.getPhoneNumber()))
                .anyMatch(phoneNumberKey::equals);
    }

    private boolean isPhoneNumberDeleted(String phoneNumberKey) {
        return phoneUsageRepository.findByPhoneNumber(phoneNumberKey)
                .map(AiMatchPhoneUsage::isInCooldown)
                .orElse(false);
    }

    private String normalizePhoneNumberKey(String value, boolean required) {
        String normalized = normalizePhoneNumber(value, required);
        if (normalized == null) {
            return null;
        }
        return canonicalPhoneNumberKey(normalized.replaceAll("\\D", ""));
    }

    private String phoneNumberKeyFromStored(String value) {
        String digitsOnly = value == null ? "" : value.replaceAll("\\D", "");
        return digitsOnly.isBlank() ? null : canonicalPhoneNumberKey(digitsOnly);
    }

    private String canonicalPhoneNumberKey(String digitsOnly) {
        if (digitsOnly.startsWith("82") && digitsOnly.length() >= 10) {
            return "0" + digitsOnly.substring(2);
        }
        return digitsOnly;
    }

    private String normalizePhoneNumber(String value, boolean required) {
        String trimmed = value == null ? "" : value.trim();
        if (trimmed.isEmpty()) {
            if (required) {
                throw new ResponseStatusException(BAD_REQUEST, "전화번호를 입력해 주세요.");
            }
            return null;
        }
        if (trimmed.length() > 30 || !trimmed.matches("[0-9+()\\-\\s]+")) {
            throw new ResponseStatusException(BAD_REQUEST, "전화번호 형식이 올바르지 않습니다.");
        }
        String digitsOnly = trimmed.replaceAll("\\D", "");
        if (digitsOnly.length() < 8 || digitsOnly.length() > 15) {
            throw new ResponseStatusException(BAD_REQUEST, "전화번호 형식이 올바르지 않습니다.");
        }
        return trimmed;
    }

    private record ImageFileDeleteResult(int deletedCount, int failedCount) {
    }
}
