package com.festflow.backend.service;

import com.festflow.backend.dto.AiMatchChatTopicDto;
import com.festflow.backend.entity.AiMatchProfile;
import com.festflow.backend.entity.AiMatchRequest;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AiMatchChatTopicsTest {

    private AiMatchRequest request(String introA, String introB) {
        AiMatchProfile a = mock(AiMatchProfile.class);
        AiMatchProfile b = mock(AiMatchProfile.class);
        when(a.getIntro()).thenReturn(introA);
        when(b.getIntro()).thenReturn(introB);
        AiMatchRequest request = mock(AiMatchRequest.class);
        when(request.getRequesterProfile()).thenReturn(a);
        when(request.getProfile()).thenReturn(b);
        return request;
    }

    @Test
    void sharedTagsAndMbtiComeFirstThenCommonTopics() {
        List<AiMatchChatTopicDto> topics = AiMatchChatService.topicsFor(
                request("영화 좋아해요\nMBTI: ENFP\n#영화 #산책", "안녕하세요\nMBTI: istj\n#산책 #영화 #게임"));

        assertThat(topics.get(0).text()).contains("'영화'");
        assertThat(topics.get(1).text()).contains("'산책'");
        assertThat(topics.get(2).text()).contains("ENFP").contains("ISTJ");
        assertThat(topics).hasSize(3 + 12);
        assertThat(topics.stream().map(AiMatchChatTopicDto::id).distinct().count()).isEqualTo(topics.size());
    }

    @Test
    void noProfileHintsGivesOnlyCommonTopics() {
        assertThat(AiMatchChatService.topicsFor(request("소개", null))).hasSize(12);
    }
}
