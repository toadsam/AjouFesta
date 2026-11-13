package com.festflow.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class AiImageGenerationService {

    private static final String OPENAI_IMAGE_EDIT_PATH = "/v1/images/edits";
    private static final String OPENAI_RESPONSES_PATH = "/v1/responses";

    private final UploadStorageService uploadStorageService;
    private final ObjectMapper objectMapper;
    private final RestClient restClient;
    private final String apiKey;
    private final String textModel;
    private final String imageModel;
    private final boolean photoValidationEnabled;

    public AiImageGenerationService(
            UploadStorageService uploadStorageService,
            ObjectMapper objectMapper,
            RestClient.Builder restClientBuilder,
            @Value("${app.openai.api-key:}") String apiKey,
            @Value("${app.openai.model:gpt-5-mini}") String textModel,
            @Value("${app.openai.image-model:gpt-image-1.5}") String imageModel,
            @Value("${app.ai-match.photo-validation.enabled:true}") boolean photoValidationEnabled
    ) {
        this.uploadStorageService = uploadStorageService;
        this.objectMapper = objectMapper;
        this.restClient = restClientBuilder
                .baseUrl("https://api.openai.com")
                .requestFactory(requestFactory())
                .build();
        this.apiKey = apiKey;
        this.textModel = textModel;
        this.imageModel = imageModel;
        this.photoValidationEnabled = photoValidationEnabled;
    }

    public String generateFestivalProfileImage(String originalImageUrl, String nickname, String intro) throws IOException {
        if (!isConfigured()) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "OPENAI_API_KEY is required for webtoon image conversion."
            );
        }

        Path originalPath = uploadStorageService.resolveUploadUrl(originalImageUrl);
        ensureSupportedInput(originalPath);
        if (photoValidationEnabled) {
            ensureEligibleProfilePhoto(originalPath);
        }

        try {
            String response = createImageEdit(originalPath, "image[]", nickname, intro);
            byte[] imageBytes = extractGeneratedImage(response);
            return saveGeneratedImage(imageBytes);
        } catch (RestClientResponseException ex) {
            return retryWithSingleImageField(originalPath, nickname, intro);
        } catch (RestClientException ex) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "OpenAI image conversion failed.",
                    ex
            );
        }
    }

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    /** OpenAI 가 주는 PNG 는 한 장이 2MB 를 넘는다. 같은 크기의 JPEG 로 바꿔 저장한다(바꿀 수 없으면 PNG 그대로). */
    private String saveGeneratedImage(byte[] imageBytes) throws IOException {
        byte[] jpeg = ImageResizer.toJpeg(imageBytes, 0, 0.88f);
        if (jpeg != null && jpeg.length < imageBytes.length) {
            return uploadStorageService.saveImageBytes(jpeg, "ai-profile-webtoon", ".jpg");
        }
        return uploadStorageService.saveImageBytes(imageBytes, "ai-profile-webtoon", ".png");
    }

    private String retryWithSingleImageField(
            Path originalPath,
            String nickname,
            String intro
    ) throws IOException {
        try {
            String response = createImageEdit(originalPath, "image", nickname, intro);
            byte[] imageBytes = extractGeneratedImage(response);
            return saveGeneratedImage(imageBytes);
        } catch (RestClientResponseException secondError) {
            throw toOpenAiException(secondError);
        } catch (RestClientException ex) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "OpenAI image conversion failed.",
                    ex
            );
        }
    }

    private String createImageEdit(Path originalPath, String imageFieldName, String nickname, String intro) {
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("model", imageModel);
        body.add(imageFieldName, new FileSystemResource(originalPath));
        body.add("prompt", buildWebtoonPrompt(nickname, intro));
        body.add("size", "1024x1536");
        body.add("quality", "high");
        body.add("input_fidelity", "high");
        body.add("output_format", "png");
        body.add("n", "1");

        return restClient.post()
                .uri(OPENAI_IMAGE_EDIT_PATH)
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .headers(headers -> headers.setBearerAuth(apiKey))
                .body(body)
                .retrieve()
                .body(String.class);
    }

    private void ensureEligibleProfilePhoto(Path originalPath) throws IOException {
        String imageDataUrl = toImageDataUrl(originalPath);
        Map<String, Object> body = Map.of(
                "model", textModel,
                "store", false,
                "max_output_tokens", 180,
                "input", List.of(Map.of(
                        "role", "user",
                        "content", List.of(
                                Map.of(
                                        "type", "input_text",
                                        "text", """
                                                Validate this image before AI profile portrait conversion.
                                                Accept normal real-person photos, including passport-style headshots, ID-style portraits, selfies, indoor portraits, plain-background profile photos, and low-resolution photos, when one main human face is visible.
                                                Reject only these clear cases:
                                                - no visible human face
                                                - multiple prominent people or group photo
                                                - landscape, background-only photo, object, animal, food, product, or document
                                                - screenshot, code/editor screen, app/browser screen, meme, poster, or text-heavy image
                                                - drawing, illustration, anime, cartoon, or already generated portrait
                                                Return only compact JSON:
                                                {"accepted":true|false,"category":"valid_person_photo|no_face|group_photo|background_or_object|screenshot_or_text|drawing_or_generated|uncertain","reason":"short Korean reason"}
                                                If uncertain, use {"accepted":true,"category":"uncertain","reason":"확실히 부적합하지 않음"}.
                                                """
                                ),
                                Map.of(
                                        "type", "input_image",
                                        "image_url", imageDataUrl,
                                        "detail", "low"
                                )
                        )
                ))
        );

        try {
            String response = restClient.post()
                    .uri(OPENAI_RESPONSES_PATH)
                    .contentType(MediaType.APPLICATION_JSON)
                    .headers(headers -> headers.setBearerAuth(apiKey))
                    .body(body)
                    .retrieve()
                    .body(String.class);
            validatePhotoCheckResponse(response);
        } catch (RestClientResponseException ex) {
            throw toOpenAiException(ex);
        } catch (RestClientException ex) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "사진 확인 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.",
                    ex
            );
        }
    }

    private void validatePhotoCheckResponse(String response) throws IOException {
        JsonNode root = objectMapper.readTree(response);
        String outputText = extractResponseOutputText(root);
        if (outputText.isBlank()) {
            return;
        }

        JsonNode result;
        try {
            result = objectMapper.readTree(stripCodeFence(outputText));
        } catch (Exception ignored) {
            return;
        }

        boolean accepted = result.path("accepted").asBoolean(true);
        String category = result.path("category").asText("uncertain");
        if (!accepted && shouldRejectUploadedPhoto(category)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "AI_MATCH_PHOTO_REJECTED:" + rejectionMessage(category)
            );
        }
    }

    private boolean shouldRejectUploadedPhoto(String category) {
        String normalized = category == null ? "" : category.toLowerCase(Locale.ROOT);
        return normalized.equals("no_face")
                || normalized.equals("group_photo")
                || normalized.equals("background_or_object")
                || normalized.equals("screenshot_or_text")
                || normalized.equals("drawing_or_generated");
    }

    private String rejectionMessage(String category) {
        String normalized = category == null ? "" : category.toLowerCase(Locale.ROOT);
        if (normalized.equals("no_face")) {
            return "사람 얼굴이 보이는 사진으로 인식되지 않았습니다. 정면 얼굴이 잘 보이는 1인 사진을 올려 주세요.";
        }
        if (normalized.equals("group_photo")) {
            return "단체 사진은 사용할 수 없습니다. 본인 한 명의 얼굴이 잘 보이는 사진을 올려 주세요.";
        }
        if (normalized.equals("background_or_object")) {
            return "배경, 사물, 풍경 사진은 사용할 수 없습니다. 사람 얼굴이 잘 보이는 사진을 올려 주세요.";
        }
        if (normalized.equals("screenshot_or_text")) {
            return "스크린샷, 코드 화면, 문서 이미지는 사용할 수 없습니다. 실제 사람 사진을 올려 주세요.";
        }
        if (normalized.equals("drawing_or_generated")) {
            return "그림, 애니메이션, 이미 생성된 AI 사진은 사용할 수 없습니다. 실제 사람 사진을 올려 주세요.";
        }
        return "정면 얼굴이 잘 보이는 1인 실제 사진을 올려 주세요.";
    }

    private String extractResponseOutputText(JsonNode root) {
        String directText = root.path("output_text").asText("");
        if (!directText.isBlank()) {
            return directText;
        }
        for (JsonNode outputItem : root.path("output")) {
            for (JsonNode contentItem : outputItem.path("content")) {
                if ("output_text".equals(contentItem.path("type").asText(""))) {
                    String text = contentItem.path("text").asText("");
                    if (!text.isBlank()) {
                        return text;
                    }
                }
            }
        }
        return "";
    }

    private String stripCodeFence(String value) {
        String trimmed = value == null ? "" : value.trim();
        if (trimmed.startsWith("```")) {
            trimmed = trimmed.replaceFirst("^```(?:json)?\\s*", "");
            trimmed = trimmed.replaceFirst("\\s*```$", "");
        }
        return trimmed.trim();
    }

    private String toImageDataUrl(Path imagePath) throws IOException {
        String contentType = contentTypeForImage(imagePath);
        String encoded = Base64.getEncoder().encodeToString(Files.readAllBytes(imagePath));
        return "data:" + contentType + ";base64," + encoded;
    }

    private String contentTypeForImage(Path imagePath) throws IOException {
        String probed = Files.probeContentType(imagePath);
        if (probed != null && probed.startsWith("image/")) {
            return probed;
        }
        String filename = imagePath.getFileName().toString().toLowerCase(Locale.ROOT);
        if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) {
            return "image/jpeg";
        }
        if (filename.endsWith(".webp")) {
            return "image/webp";
        }
        return "image/png";
    }

    private byte[] extractGeneratedImage(String response) throws IOException {
        JsonNode root = objectMapper.readTree(response);
        String b64Json = root.path("data").path(0).path("b64_json").asText("");
        if (b64Json.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "OpenAI image response did not include generated image data."
            );
        }
        return Base64.getDecoder().decode(b64Json);
    }

    private String buildWebtoonPrompt(String nickname, String intro) {
        return """
                Edit the uploaded person photo into a clean Korean webtoon portrait while keeping the same real person recognizable.
                This should be a true webtoon-style redraw, not a photoreal retouch and not a totally different character.
                Preserve the source person's identity very closely: face shape, eye shape and spacing, eyebrows, nose bridge and tip, lips, jawline, hairstyle, hair length, expression, age impression, and camera angle.
                Do not beautify, idolize, age-change, slim the face, enlarge the eyes, sharpen the jaw, change hairstyle, or change skin tone.
                Use visible but tasteful webtoon styling: clean line art around the eyes, nose, lips, jaw, and hair; flat but soft cel shading; simplified skin texture; illustrated hair strands; and slightly posterized colors.
                Keep the composition and clothing close to the original.
                Remove flashy neon glow, purple-orange gradients, lens flare, futuristic lighting, and synthetic beauty-filter effects.
                Keep the background simple and understated so the face remains the focus.
                Avoid anime exaggeration, chibi style, doll-like skin, fantasy styling, dramatic makeup, glossy idol styling, and over-rendered realism.
                Keep the result friendly, non-sexual, fully clothed, and appropriate for a public campus festival dating profile.
                Do not include text, logos, watermarks, UI, QR codes, or captions inside the image.
                Profile nickname context: %s
                Profile intro context: %s
                """.formatted(safePromptText(nickname, 40), safePromptText(intro, 180));
    }

    private void ensureSupportedInput(Path originalPath) {
        String filename = originalPath.getFileName().toString().toLowerCase();
        if (!(filename.endsWith(".jpg")
                || filename.endsWith(".jpeg")
                || filename.endsWith(".png")
                || filename.endsWith(".webp"))) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Webtoon AI conversion supports JPG, PNG, or WEBP images."
            );
        }
    }

    private ResponseStatusException toOpenAiException(RestClientResponseException ex) {
        String detail = extractOpenAiError(ex.getResponseBodyAsString());
        return new ResponseStatusException(
                HttpStatus.BAD_GATEWAY,
                toUserFacingOpenAiError(ex.getStatusCode().value(), detail),
                ex
        );
    }

    private String toUserFacingOpenAiError(int upstreamStatus, String detail) {
        String normalized = detail == null ? "" : detail.toLowerCase(Locale.ROOT);
        if (upstreamStatus == 401 || normalized.contains("invalid api key") || normalized.contains("incorrect api key")) {
            return "OpenAI API 키가 올바르지 않습니다. OPENAI_API_KEY 환경변수를 확인해 주세요.";
        }
        if (normalized.contains("insufficient_quota")
                || normalized.contains("quota")
                || normalized.contains("billing")
                || normalized.contains("credit")) {
            return "OpenAI 사용량 한도 또는 결제 크레딧이 부족합니다. OpenAI 결제/Usage 한도를 확인해 주세요.";
        }
        if (upstreamStatus == 429 || normalized.contains("rate limit") || normalized.contains("too many requests")) {
            return "OpenAI 요청이 일시적으로 제한되었습니다. 잠시 후 다시 시도해 주세요.";
        }
        if (normalized.contains("model") || normalized.contains("does not exist")) {
            return "OpenAI 모델 설정이 올바르지 않습니다. OPENAI_MODEL 또는 OPENAI_IMAGE_MODEL 값을 확인해 주세요.";
        }
        if (normalized.contains("policy")
                || normalized.contains("safety")
                || normalized.contains("moderation")
                || normalized.contains("content")) {
            return "이 사진은 AI 변환을 진행할 수 없습니다. 정면 얼굴이 잘 보이는 일반 프로필 사진으로 다시 올려 주세요.";
        }
        return detail == null || detail.isBlank()
                ? "OpenAI 이미지 변환 요청에 실패했습니다. 서버 로그를 확인해 주세요."
                : "OpenAI 이미지 변환 요청에 실패했습니다: " + detail;
    }

    private String extractOpenAiError(String responseBody) {
        if (responseBody == null || responseBody.isBlank()) {
            return "";
        }
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            String message = root.path("error").path("message").asText("");
            return message.length() > 240 ? message.substring(0, 240) : message;
        } catch (Exception ignored) {
            return "";
        }
    }

    private String safePromptText(String value, int maxLength) {
        String trimmed = value == null ? "" : value.trim();
        if (trimmed.length() <= maxLength) {
            return trimmed;
        }
        return trimmed.substring(0, maxLength);
    }

    private SimpleClientHttpRequestFactory requestFactory() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(10));
        factory.setReadTimeout(Duration.ofSeconds(120));
        return factory;
    }
}
