package com.festflow.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.S3Object;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class UploadStorageService {

    private static final long MAX_IMAGE_BYTES = 10L * 1024L * 1024L;
    private static final Map<String, String> IMAGE_EXTENSIONS = Map.of(
            "image/jpeg", ".jpg",
            "image/png", ".png",
            "image/webp", ".webp",
            "image/gif", ".gif"
    );

    private final Path uploadPath;
    private final boolean s3Enabled;
    private final String s3Bucket;
    private final String s3PublicBaseUrl;
    private final S3Client s3Client;

    public UploadStorageService(
            @Value("${app.upload.dir}") String uploadDir,
            @Value("${app.storage.type:local}") String storageType,
            @Value("${app.s3.bucket:}") String s3Bucket,
            @Value("${app.s3.region:ap-northeast-2}") String s3Region,
            @Value("${app.s3.endpoint:}") String s3Endpoint,
            @Value("${app.s3.public-base-url:}") String s3PublicBaseUrl,
            @Value("${app.s3.path-style-access:false}") boolean pathStyleAccess
    ) {
        this.uploadPath = Path.of(uploadDir).toAbsolutePath().normalize();
        this.s3Bucket = s3Bucket == null ? "" : s3Bucket.trim();
        this.s3PublicBaseUrl = normalizePublicBaseUrl(s3PublicBaseUrl);
        this.s3Enabled = "s3".equalsIgnoreCase(storageType) || !this.s3Bucket.isBlank();
        if (s3Enabled) {
            if (this.s3Bucket.isBlank()) {
                throw new IllegalStateException("AWS_S3_BUCKET is required when APP_STORAGE_TYPE=s3.");
            }
            var builder = S3Client.builder()
                    .region(Region.of(s3Region == null || s3Region.isBlank() ? "ap-northeast-2" : s3Region.trim()))
                    .credentialsProvider(DefaultCredentialsProvider.create())
                    .forcePathStyle(pathStyleAccess);
            if (s3Endpoint != null && !s3Endpoint.isBlank()) {
                builder.endpointOverride(URI.create(s3Endpoint.trim()));
            }
            this.s3Client = builder.build();
        } else {
            this.s3Client = null;
        }
    }

    public String saveImage(MultipartFile file, String prefix) throws IOException {
        validateImage(file);

        String contentType = normalizeContentType(file.getContentType());
        String extension = IMAGE_EXTENSIONS.get(contentType);
        String key = buildObjectKey(prefix, extension);
        if (s3Enabled) {
            putS3Object(key, file.getBytes(), contentType);
            return toStoredUrl(key);
        }

        Files.createDirectories(uploadPath);
        Path target = resolveLocalTarget(key);
        file.transferTo(target);
        return toStoredUrl(key);
    }

    public String saveImageBytes(byte[] imageBytes, String prefix, String extension) throws IOException {
        if (imageBytes == null || imageBytes.length == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Image is required.");
        }

        String safeExtension = sanitizeExtension(extension);
        String key = buildObjectKey(prefix, safeExtension);
        if (s3Enabled) {
            putS3Object(key, imageBytes, contentTypeForExtension(safeExtension));
            return toStoredUrl(key);
        }

        Files.createDirectories(uploadPath);
        Path target = resolveLocalTarget(key);
        Files.write(target, imageBytes);
        return toStoredUrl(key);
    }

    public Path resolveUploadUrl(String imageUrl) throws IOException {
        String key = extractObjectKey(imageUrl);
        if (s3Enabled) {
            StoredObject object = getS3Object(key);
            String extension = extensionFromKey(key);
            Path tempFile = Files.createTempFile("festflow-upload-", extension);
            Files.write(tempFile, object.bytes());
            tempFile.toFile().deleteOnExit();
            return tempFile;
        }
        return resolveLocalTarget(key);
    }

    public StoredObject loadStoredObject(String imageUrl) throws IOException {
        String key = extractObjectKey(imageUrl);
        if (s3Enabled) {
            return getS3Object(key);
        }
        Path target = resolveLocalTarget(key);
        if (!Files.exists(target) || !Files.isRegularFile(target)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Upload not found.");
        }
        String contentType = Files.probeContentType(target);
        return new StoredObject(
                Files.readAllBytes(target),
                contentType == null ? contentTypeForExtension(extensionFromKey(key)) : contentType
        );
    }

    /** 이름이 prefix 로 시작하는 업로드 파일을 모두 지운다. [지운 수, 실패 수]. */
    public int[] deleteAllWithPrefix(String prefix) throws IOException {
        String safePrefix = sanitizePrefix(prefix);
        int deleted = 0;
        int failed = 0;
        if (s3Enabled) {
            ListObjectsV2Request request = ListObjectsV2Request.builder().bucket(s3Bucket).prefix(safePrefix).build();
            for (S3Object object : s3Client.listObjectsV2Paginator(request).contents()) {
                try {
                    deleteS3Object(object.key());
                    deleted += 1;
                } catch (RuntimeException exception) {
                    failed += 1;
                }
            }
            return new int[]{deleted, failed};
        }
        if (!Files.isDirectory(uploadPath)) {
            return new int[]{0, 0};
        }
        try (var files = Files.list(uploadPath)) {
            for (Path file : files.filter(f -> f.getFileName().toString().startsWith(safePrefix)).toList()) {
                try {
                    if (Files.deleteIfExists(file)) {
                        deleted += 1;
                    }
                } catch (IOException exception) {
                    failed += 1;
                }
            }
        }
        return new int[]{deleted, failed};
    }

    public static final String PROFILE_IMAGE_PREFIX = "ai-profile-";

    /** 소개팅 프로필 사진은 서버가 발급한 ai-profile-* 키만 받는다(남의 사진·다른 업로드 재사용 방지). */
    public void ensureProfileImageUrl(String imageUrl) {
        if (!isProfileImageUrl(imageUrl)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "프로필 사진 주소가 올바르지 않습니다. 사진을 다시 올려 주세요.");
        }
    }

    public static final String PROFILE_ORIGINAL_PREFIX = "ai-profile-original-";
    public static final String PROFILE_GENERATED_PREFIX = "ai-profile-webtoon-";

    /**
     * 클라이언트가 보낸 프로필 사진 주소를 확인하고, 서버가 만든 모양의 주소로 바꿔 돌려준다.
     * 키가 requiredPrefix 로 시작해야 한다(원본을 공개용 자리에 넣거나, 다른 호스트 주소를 넣는 것을 막는다).
     */
    public String canonicalProfileImageUrl(String imageUrl, String requiredPrefix) {
        String key;
        try {
            key = extractObjectKey(imageUrl);
        } catch (RuntimeException exception) {
            key = "";
        }
        if (!key.startsWith(requiredPrefix)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "프로필 사진 주소가 올바르지 않습니다. 사진을 다시 올려 주세요.");
        }
        return toStoredUrl(key);
    }

    public boolean isProfileImageUrl(String imageUrl) {
        try {
            return extractObjectKey(imageUrl).startsWith(PROFILE_IMAGE_PREFIX);
        } catch (RuntimeException exception) {
            return false;
        }
    }

    public boolean deleteUploadUrl(String imageUrl) throws IOException {
        String value = imageUrl == null ? "" : imageUrl.trim();
        if (value.isBlank()) {
            return false;
        }
        String key = extractObjectKey(value);
        if (s3Enabled) {
            deleteS3Object(key);
            return true;
        }
        return Files.deleteIfExists(resolveLocalTarget(key));
    }

    private Path resolveLocalTarget(String key) {
        Path target = uploadPath.resolve(key).normalize();
        if (!target.startsWith(uploadPath)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid upload path.");
        }
        return target;
    }

    private void putS3Object(String key, byte[] bytes, String contentType) {
        try {
            s3Client.putObject(
                    PutObjectRequest.builder()
                            .bucket(s3Bucket)
                            .key(key)
                            .contentType(contentType)
                            .cacheControl("public, max-age=31536000, immutable")
                            .build(),
                    RequestBody.fromBytes(bytes)
            );
        } catch (S3Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "S3 image upload failed.", ex);
        }
    }

    private void deleteS3Object(String key) {
        try {
            s3Client.deleteObject(
                    DeleteObjectRequest.builder()
                            .bucket(s3Bucket)
                            .key(key)
                            .build()
            );
        } catch (S3Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "S3 image delete failed.", ex);
        }
    }

    private StoredObject getS3Object(String key) {
        try {
            ResponseBytes<GetObjectResponse> objectBytes = s3Client.getObjectAsBytes(
                    GetObjectRequest.builder()
                            .bucket(s3Bucket)
                            .key(key)
                            .build()
            );
            String contentType = objectBytes.response().contentType();
            return new StoredObject(
                    objectBytes.asByteArray(),
                    contentType == null || contentType.isBlank() ? contentTypeForExtension(extensionFromKey(key)) : contentType
            );
        } catch (NoSuchKeyException ex) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Upload not found.", ex);
        } catch (S3Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "S3 image download failed.", ex);
        }
    }

    private String toStoredUrl(String key) {
        if (s3Enabled && !s3PublicBaseUrl.isBlank()) {
            return s3PublicBaseUrl + "/" + key;
        }
        return "/uploads/" + key;
    }

    private String extractObjectKey(String imageUrl) {
        String value = imageUrl == null ? "" : imageUrl.trim();
        if (value.startsWith("/uploads/")) {
            return sanitizeObjectKey(value.substring("/uploads/".length()));
        }
        if (!s3PublicBaseUrl.isBlank() && value.startsWith(s3PublicBaseUrl + "/")) {
            return sanitizeObjectKey(value.substring(s3PublicBaseUrl.length() + 1));
        }
        if (s3Enabled && value.startsWith("http")) {
            try {
                URI uri = new URI(value);
                return sanitizeObjectKey(uri.getPath().replaceFirst("^/", ""));
            } catch (URISyntaxException ignored) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid upload URL.");
            }
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid upload URL.");
    }

    private String buildObjectKey(String prefix, String extension) {
        return sanitizePrefix(prefix) + "-" + UUID.randomUUID() + extension;
    }

    private String sanitizeObjectKey(String key) {
        String value = key == null ? "" : key.trim().replace("\\", "/");
        if (value.isBlank() || value.contains("..") || value.startsWith("/") || value.endsWith("/")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid upload path.");
        }
        return value;
    }

    private void validateImage(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Image file is required.");
        }
        if (file.getSize() > MAX_IMAGE_BYTES) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Image file must be 10MB or smaller.");
        }
        String contentType = normalizeContentType(file.getContentType());
        if (!IMAGE_EXTENSIONS.containsKey(contentType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only JPG, PNG, WEBP, or GIF images are allowed.");
        }
    }

    private String normalizeContentType(String contentType) {
        return contentType == null ? "" : contentType.toLowerCase(Locale.ROOT).trim();
    }

    private String sanitizePrefix(String prefix) {
        String value = prefix == null ? "upload" : prefix.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9-]", "-");
        value = value.replaceAll("-+", "-").replaceAll("^-|-$", "");
        return value.isBlank() ? "upload" : value;
    }

    private String sanitizeExtension(String extension) {
        String value = extension == null ? ".bin" : extension.toLowerCase(Locale.ROOT).trim();
        if (!value.startsWith(".")) {
            value = "." + value;
        }
        if (!value.matches("\\.[a-z0-9]{1,8}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid image extension.");
        }
        return value;
    }

    private String extensionFromKey(String key) {
        int dotIndex = key == null ? -1 : key.lastIndexOf(".");
        if (dotIndex < 0) {
            return ".bin";
        }
        return sanitizeExtension(key.substring(dotIndex));
    }

    private String contentTypeForExtension(String extension) {
        return switch (sanitizeExtension(extension)) {
            case ".jpg", ".jpeg" -> "image/jpeg";
            case ".png" -> "image/png";
            case ".webp" -> "image/webp";
            case ".gif" -> "image/gif";
            default -> "application/octet-stream";
        };
    }

    private String normalizePublicBaseUrl(String value) {
        String trimmed = value == null ? "" : value.trim();
        return trimmed.replaceAll("/+$", "");
    }

    public record StoredObject(byte[] bytes, String contentType) {
        public Resource resource() {
            return new org.springframework.core.io.ByteArrayResource(bytes);
        }
    }
}
