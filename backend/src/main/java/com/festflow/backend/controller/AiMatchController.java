package com.festflow.backend.controller;

import com.festflow.backend.dto.AiMatchProfileAccessRequestDto;
import com.festflow.backend.dto.AiMatchProfileAccessResponseDto;
import com.festflow.backend.dto.AiMatchProfileDeleteDto;
import com.festflow.backend.dto.AiMatchFavoriteResponseDto;
import com.festflow.backend.dto.AiMatchReportCreateDto;
import com.festflow.backend.dto.AiMatchReportDto;
import com.festflow.backend.dto.AiMatchImagePreviewDto;
import com.festflow.backend.dto.AiMatchMeetupProposalDto;
import com.festflow.backend.dto.AiMatchMeetupSlotsDto;
import com.festflow.backend.dto.AiMatchNicknameCheckDto;
import com.festflow.backend.dto.AiMatchPhoneCheckDto;
import com.festflow.backend.dto.SajuDto;
import com.festflow.backend.dto.AiMatchProfileResponseDto;
import com.festflow.backend.dto.AiMatchProfileUpdateDto;
import com.festflow.backend.dto.AiMatchRequestCreateDto;
import com.festflow.backend.dto.AiMatchRequestResponseDto;
import com.festflow.backend.service.AiMatchService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
@RestController
@RequestMapping("/api/ai-match")
public class AiMatchController {

    private final AiMatchService aiMatchService;

    public AiMatchController(AiMatchService aiMatchService) {
        this.aiMatchService = aiMatchService;
    }

    /** 첫 화면용. 새 가입을 받는지(아니면 안내 문구). 로그인 없이 읽는다. */
    @GetMapping("/status")
    public com.festflow.backend.dto.AiMatchStatusDto getStatus() {
        return aiMatchService.getStatus();
    }

    @GetMapping("/nickname-check")
    public AiMatchNicknameCheckDto checkNickname(
            @RequestParam("nickname") String nickname,
            @RequestParam(value = "profileId", required = false) Long profileId
    ) {
        return aiMatchService.checkNickname(nickname, profileId);
    }

    @GetMapping("/saju-preview")
    public SajuDto previewSaju(
            @RequestParam("birthDate") String birthDate,
            @RequestParam(value = "birthTime", required = false) String birthTime,
            @RequestParam(value = "nickname", required = false) String nickname
    ) {
        return aiMatchService.previewSaju(birthDate, birthTime, nickname);
    }

    @GetMapping("/phone-check")
    public AiMatchPhoneCheckDto checkPhoneNumber(
            @RequestParam("phoneNumber") String phoneNumber
    ) {
        return aiMatchService.checkPhoneNumber(phoneNumber);
    }

    @PostMapping(value = "/image-preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public AiMatchImagePreviewDto createImagePreview(
            @RequestParam("file") MultipartFile file,
            @RequestParam("phoneNumber") String phoneNumber
    ) throws IOException {
        return aiMatchService.createImagePreview(file, phoneNumber);
    }

    @PostMapping(value = "/profiles", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public AiMatchProfileResponseDto createProfile(
            @RequestParam("nickname") String nickname,
            @RequestParam("gender") String gender,
            @RequestParam("intro") String intro,
            @RequestParam("pin") String pin,
            @RequestParam("phoneNumber") String phoneNumber,
            @RequestParam("meetPlace") String meetPlace,
            @RequestParam("consent") boolean consent,
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "originalImageUrl", required = false) String originalImageUrl,
            @RequestParam(value = "generatedImageUrl", required = false) String generatedImageUrl,
            @RequestParam("realName") String realName,
            @RequestParam("birthDate") String birthDate,
            @RequestParam(value = "birthTime", required = false) String birthTime
    ) throws IOException {
        return aiMatchService.createProfile(
                nickname,
                gender,
                intro,
                pin,
                phoneNumber,
                meetPlace,
                consent,
                file,
                originalImageUrl,
                generatedImageUrl,
                realName,
                birthDate,
                birthTime
        );
    }

    @PostMapping("/profiles/access")
    public AiMatchProfileAccessResponseDto accessProfile(
            @RequestBody AiMatchProfileAccessRequestDto requestDto
    ) {
        return aiMatchService.accessProfile(requestDto);
    }

    /** 신청함만 다시 읽는다(앱이 15초마다 부른다). 사람 목록(profiles)은 담지 않는다. */
    @PostMapping("/profiles/inbox")
    public AiMatchProfileAccessResponseDto inbox(
            @RequestBody AiMatchProfileAccessRequestDto requestDto
    ) {
        return aiMatchService.accessInbox(requestDto);
    }

    @PutMapping("/profiles/{profileId}")
    public AiMatchProfileResponseDto updateProfile(
            @PathVariable Long profileId,
            @RequestBody AiMatchProfileUpdateDto requestDto
    ) throws IOException {
        return aiMatchService.updateProfile(profileId, requestDto);
    }

    @PostMapping("/profiles/{profileId}/delete")
    public void deleteProfile(
            @PathVariable Long profileId,
            @RequestBody AiMatchProfileDeleteDto requestDto
    ) {
        aiMatchService.deleteProfile(profileId, requestDto);
    }

    @PostMapping("/profiles/{profileId}/requests")
    public AiMatchRequestResponseDto createRequest(
            @PathVariable Long profileId,
            @RequestBody AiMatchRequestCreateDto requestDto
    ) {
        return aiMatchService.createRequest(profileId, requestDto);
    }

    @PostMapping("/profiles/{profileId}/report")
    public AiMatchReportDto reportProfile(
            @PathVariable Long profileId,
            @RequestBody AiMatchReportCreateDto requestDto
    ) {
        return aiMatchService.createReport(profileId, requestDto);
    }

    @PostMapping("/profiles/{profileId}/favorite")
    public AiMatchFavoriteResponseDto toggleFavorite(
            @PathVariable Long profileId,
            @RequestBody AiMatchProfileAccessRequestDto requestDto
    ) {
        return aiMatchService.toggleFavorite(profileId, requestDto);
    }

    @PostMapping("/requests/{requestId}/accept")
    public AiMatchRequestResponseDto acceptRequest(
            @PathVariable Long requestId,
            @RequestBody AiMatchProfileAccessRequestDto requestDto
    ) {
        return aiMatchService.acceptRequest(requestId, requestDto);
    }

    @PostMapping("/requests/{requestId}/reject")
    public AiMatchRequestResponseDto rejectRequest(
            @PathVariable Long requestId,
            @RequestBody AiMatchProfileAccessRequestDto requestDto
    ) {
        return aiMatchService.rejectRequest(requestId, requestDto);
    }

    @PostMapping("/requests/{requestId}/cancel")
    public AiMatchRequestResponseDto cancelRequest(
            @PathVariable Long requestId,
            @RequestBody AiMatchProfileAccessRequestDto requestDto
    ) {
        return aiMatchService.cancelRequest(requestId, requestDto);
    }

    @PostMapping("/requests/{requestId}/meetup/propose")
    public AiMatchRequestResponseDto proposeMeetup(
            @PathVariable Long requestId,
            @RequestBody AiMatchMeetupProposalDto requestDto
    ) {
        return aiMatchService.proposeMeetup(requestId, requestDto);
    }

    @PostMapping("/requests/{requestId}/meetup/confirm")
    public AiMatchRequestResponseDto confirmMeetup(
            @PathVariable Long requestId,
            @RequestBody AiMatchProfileAccessRequestDto requestDto
    ) {
        return aiMatchService.confirmMeetup(requestId, requestDto);
    }

    @PostMapping("/requests/{requestId}/meetup/arrived")
    public AiMatchRequestResponseDto markMeetupArrived(
            @PathVariable Long requestId,
            @RequestBody AiMatchProfileAccessRequestDto requestDto
    ) {
        return aiMatchService.markSelfArrived(requestId, requestDto);
    }

    @PostMapping("/requests/{requestId}/meetup/cancel")
    public AiMatchRequestResponseDto cancelMeetup(
            @PathVariable Long requestId,
            @RequestBody AiMatchProfileAccessRequestDto requestDto
    ) {
        return aiMatchService.cancelMeetup(requestId, requestDto);
    }

    /** 부스 시간을 못 잡은 커플의 연락처 공유 동의. 둘 다 누르면 신청함 응답에 서로 번호가 실린다. */
    @PostMapping("/requests/{requestId}/contact/consent")
    public AiMatchRequestResponseDto consentContactShare(
            @PathVariable Long requestId,
            @RequestBody AiMatchProfileAccessRequestDto requestDto
    ) {
        return aiMatchService.consentContactShare(requestId, requestDto);
    }

    /** 소개팅 부스 15분 슬롯 현황. 누가 잡았는지는 내려주지 않는다. */
    @GetMapping("/meetup-slots")
    public AiMatchMeetupSlotsDto getMeetupSlots(
            @RequestParam(required = false) String date,
            @RequestParam(required = false) Long requestId
    ) {
        return aiMatchService.getMeetupSlots(date, requestId);
    }
}
