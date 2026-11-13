package com.festflow.backend.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.festflow.backend.dto.AiModelPredictionDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.concurrent.TimeUnit;

@Service
public class PythonCongestionModelService {

    private static final Logger log = LoggerFactory.getLogger(PythonCongestionModelService.class);

    private final ObjectMapper objectMapper;
    private final boolean enabled;
    private final String pythonCommand;
    private final String predictScript;
    private final String modelPath;
    private final String portableModelPath;
    private final Duration timeout;
    private volatile PortableModel portableModel;

    public PythonCongestionModelService(
            ObjectMapper objectMapper,
            @Value("${app.ml.congestion.enabled:true}") boolean enabled,
            @Value("${app.ml.python-command:python3}") String pythonCommand,
            @Value("${app.ml.congestion.predict-script:./scripts/ml/predict_congestion.py}") String predictScript,
            @Value("${app.ml.congestion.model-path:./exports/ml/models/random_forest_congestion_model.pkl}") String modelPath,
            @Value("${app.ml.congestion.portable-model-path:./exports/ml/models/random_forest_congestion_model.json}") String portableModelPath,
            @Value("${app.ml.congestion.timeout-ms:20000}") long timeoutMs
    ) {
        this.objectMapper = objectMapper;
        this.enabled = enabled;
        this.pythonCommand = pythonCommand;
        this.predictScript = predictScript;
        this.modelPath = modelPath;
        this.portableModelPath = portableModelPath;
        this.timeout = Duration.ofMillis(Math.max(1000, timeoutMs));
    }

    public Optional<AiModelPredictionDto> predict(Map<String, Object> features, List<String> factors) {
        return predictBatch(List.of(new ModelPredictionRequest(0L, features, factors))).values().stream().findFirst();
    }

    public Map<Long, AiModelPredictionDto> predictBatch(List<ModelPredictionRequest> requests) {
        if (!enabled) {
            return Map.of();
        }
        if (requests == null || requests.isEmpty()) {
            return Map.of();
        }

        try {
            Path script = resolvePath(predictScript);
            Path model = resolvePath(modelPath);
            if (!Files.exists(script) || !Files.exists(model)) {
                log.warn("Congestion ML model is unavailable. scriptExists={}, modelExists={}, script={}, model={}",
                        Files.exists(script), Files.exists(model), script, model);
                return predictBatchPortable(requests);
            }

            ProcessBuilder builder = new ProcessBuilder(
                    resolveCommand(pythonCommand),
                    script.toString(),
                    "--model",
                    model.toString()
            );
            builder.directory(resolveProjectRoot().toFile());

            List<Map<String, Object>> items = requests.stream()
                    .map(request -> Map.of(
                            "id", request.id(),
                            "features", request.features()
                    ))
                    .toList();
            Path inputFile = Files.createTempFile("festflow-congestion-input-", ".json");
            Path outputFile = Files.createTempFile("festflow-congestion-output-", ".json");
            Files.writeString(inputFile, objectMapper.writeValueAsString(Map.of("items", items)), StandardCharsets.UTF_8);

            builder.command().add("--input-file");
            builder.command().add(inputFile.toString());
            builder.command().add("--output-file");
            builder.command().add(outputFile.toString());

            Process process = builder.start();

            boolean finished = process.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS);
            if (!finished) {
                process.destroyForcibly();
                log.warn("Congestion ML prediction timed out after {} ms for {} items", timeout.toMillis(), requests.size());
                deleteQuietly(inputFile);
                deleteQuietly(outputFile);
                return predictBatchPortable(requests);
            }

            String stderr = new String(process.getErrorStream().readAllBytes(), StandardCharsets.UTF_8).trim();
            if (process.exitValue() != 0 || !Files.exists(outputFile)) {
                log.warn("Congestion ML prediction failed. exitCode={}, stderr={}", process.exitValue(), stderr);
                deleteQuietly(inputFile);
                deleteQuietly(outputFile);
                return predictBatchPortable(requests);
            }

            String stdout = Files.readString(outputFile, StandardCharsets.UTF_8).trim();
            deleteQuietly(inputFile);
            deleteQuietly(outputFile);
            Map<String, Object> result = objectMapper.readValue(stdout, new TypeReference<>() {
            });
            List<?> predictions = result.get("predictions") instanceof List<?> list ? list : List.of(result);
            Map<Long, ModelPredictionRequest> requestById = requests.stream()
                    .collect(Collectors.toMap(ModelPredictionRequest::id, Function.identity(), (a, b) -> a));
            return predictions.stream()
                    .filter(item -> item instanceof Map<?, ?>)
                    .map(item -> toPrediction((Map<?, ?>) item, requestById))
                    .filter(Optional::isPresent)
                    .map(Optional::get)
                    .collect(Collectors.toMap(PredictionResult::id, PredictionResult::prediction, (a, b) -> a));
        } catch (IOException | InterruptedException | RuntimeException ex) {
            if (ex instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            log.warn("Congestion ML prediction could not be completed", ex);
            return predictBatchPortable(requests);
        }
    }

    private Map<Long, AiModelPredictionDto> predictBatchPortable(List<ModelPredictionRequest> requests) {
        Optional<PortableModel> model = loadPortableModel();
        if (model.isEmpty()) {
            return Map.of();
        }
        return requests.stream()
                .map(request -> portablePrediction(model.get(), request))
                .filter(Optional::isPresent)
                .map(Optional::get)
                .collect(Collectors.toMap(PredictionResult::id, PredictionResult::prediction, (a, b) -> a));
    }

    private Optional<PortableModel> loadPortableModel() {
        if (portableModel != null) {
            return Optional.of(portableModel);
        }
        try {
            Path path = resolvePath(portableModelPath);
            if (!Files.exists(path)) {
                log.warn("Portable congestion ML model is unavailable. path={}", path);
                return Optional.empty();
            }
            JsonNode root = objectMapper.readTree(path.toFile());
            Map<String, List<String>> categoricalValues = new LinkedHashMap<>();
            JsonNode categoricalNode = root.path("categorical_values");
            categoricalNode.fieldNames().forEachRemaining(field -> categoricalValues.put(field, readStringList(categoricalNode.path(field))));
            List<PortableTree> trees = new ArrayList<>();
            for (JsonNode treeNode : root.path("trees")) {
                trees.add(new PortableTree(
                        readIntArray(treeNode.path("children_left")),
                        readIntArray(treeNode.path("children_right")),
                        readIntArray(treeNode.path("feature")),
                        readDoubleArray(treeNode.path("threshold")),
                        readDoubleMatrix(treeNode.path("value"))
                ));
            }
            PortableModel loaded = new PortableModel(
                    readStringList(root.path("numeric_features")),
                    categoricalValues,
                    readStringList(root.path("labels")),
                    root.path("training_profile"),
                    trees
            );
            portableModel = loaded;
            log.info("Portable congestion ML model loaded. trees={}, labels={}", trees.size(), loaded.labels());
            return Optional.of(loaded);
        } catch (IOException | RuntimeException ex) {
            log.warn("Portable congestion ML model could not be loaded", ex);
            return Optional.empty();
        }
    }

    private Optional<PredictionResult> portablePrediction(PortableModel model, ModelPredictionRequest request) {
        if (model.trees().isEmpty() || model.labels().isEmpty()) {
            return Optional.empty();
        }
        double[] row = transformPortableRow(model, request.features());
        double[] probabilities = new double[model.labels().size()];
        for (PortableTree tree : model.trees()) {
            double[] leaf = tree.predict(row);
            double sum = 0.0;
            for (double value : leaf) {
                sum += value;
            }
            if (sum <= 0.0) {
                continue;
            }
            for (int index = 0; index < Math.min(probabilities.length, leaf.length); index++) {
                probabilities[index] += leaf[index] / sum;
            }
        }
        int bestIndex = 0;
        for (int index = 1; index < probabilities.length; index++) {
            if (probabilities[index] > probabilities[bestIndex]) {
                bestIndex = index;
            }
        }
        double confidence = probabilities[bestIndex] / model.trees().size();
        String rawLevel = model.labels().get(bestIndex);
        DriftResult drift = driftCheck(model, request.features());
        return Optional.of(new PredictionResult(
                request.id(),
                new AiModelPredictionDto(
                        "RandomForest",
                        rawLevel,
                        displayLevelStable(rawLevel),
                        Math.round(confidence * 10000.0) / 10000.0,
                        true,
                        drift.status(),
                        drift.score(),
                        drift.warnings(),
                        request.factors(),
                        null
                )
        ));
    }

    private double[] transformPortableRow(PortableModel model, Map<String, Object> features) {
        List<Double> values = new ArrayList<>();
        for (String feature : model.numericFeatures()) {
            values.add(asDoubleValue(features.get(feature), 0.0));
        }
        for (Map.Entry<String, List<String>> entry : model.categoricalValues().entrySet()) {
            String actual = String.valueOf(features.getOrDefault(entry.getKey(), ""));
            for (String expected : entry.getValue()) {
                values.add(expected.equals(actual) ? 1.0 : 0.0);
            }
        }
        double[] row = new double[values.size()];
        for (int index = 0; index < values.size(); index++) {
            row[index] = values.get(index);
        }
        return row;
    }

    private DriftResult driftCheck(PortableModel model, Map<String, Object> features) {
        JsonNode profile = model.trainingProfile();
        JsonNode numeric = profile.path("numeric");
        JsonNode categorical = profile.path("categorical");
        JsonNode policy = profile.path("drift_policy");
        double normalMax = policy.path("normal_max_score").asDouble(0.15);
        double cautionMax = policy.path("caution_max_score").asDouble(0.35);
        int checks = 0;
        double driftPoints = 0.0;
        List<String> warnings = new ArrayList<>();

        var fieldNames = numeric.fieldNames();
        while (fieldNames.hasNext()) {
            String feature = fieldNames.next();
            if (!features.containsKey(feature)) {
                continue;
            }
            checks++;
            JsonNode stats = numeric.path(feature);
            double value = asDoubleValue(features.get(feature), 0.0);
            double p05 = stats.path("p05").asDouble(value);
            double p95 = stats.path("p95").asDouble(value);
            double min = stats.path("min").asDouble(p05);
            double max = stats.path("max").asDouble(p95);
            if (value < min || value > max) {
                driftPoints += 1.0;
                warnings.add(feature + "=" + trimDouble(value) + " is outside training range [" + trimDouble(min) + ", " + trimDouble(max) + "]");
            } else if (value < p05 || value > p95) {
                driftPoints += 0.45;
                warnings.add(feature + "=" + trimDouble(value) + " is outside typical training band [" + trimDouble(p05) + ", " + trimDouble(p95) + "]");
            }
        }

        var categoryNames = categorical.fieldNames();
        while (categoryNames.hasNext()) {
            String feature = categoryNames.next();
            if (!features.containsKey(feature)) {
                continue;
            }
            checks++;
            String value = String.valueOf(features.get(feature));
            if (!readStringList(categorical.path(feature)).contains(value)) {
                driftPoints += 1.0;
                warnings.add(feature + "=" + value + " was not seen during training");
            }
        }

        double score = Math.round((driftPoints / Math.max(1, checks)) * 10000.0) / 10000.0;
        String status = score <= normalMax ? "NORMAL" : score <= cautionMax ? "CAUTION" : "WARNING";
        return new DriftResult(status, score, warnings.stream().limit(4).toList());
    }

    private Optional<PredictionResult> toPrediction(Map<?, ?> result, Map<Long, ModelPredictionRequest> requestById) {
        Long id = asLong(result.get("id"));
        if (id == null) {
            return Optional.empty();
        }
        ModelPredictionRequest request = requestById.get(id);
        if (request == null) {
            return Optional.empty();
        }
        Object rawLevelValue = result.containsKey("predictedLevel") ? result.get("predictedLevel") : "NORMAL";
        String rawLevel = String.valueOf(rawLevelValue);
        Double confidence = asDouble(result.get("confidence"));
        Object driftStatusValue = result.containsKey("driftStatus") ? result.get("driftStatus") : "UNKNOWN";
        String driftStatus = String.valueOf(driftStatusValue);
        Double driftScore = asDouble(result.get("driftScore"));
        List<String> driftWarnings = asStringList(result.get("driftWarnings"));
        Object modelTypeValue = result.containsKey("modelType") ? result.get("modelType") : "RandomForest";
        return Optional.of(new PredictionResult(
                id,
                new AiModelPredictionDto(
                        String.valueOf(modelTypeValue),
                        rawLevel,
                        displayLevelStable(rawLevel),
                        confidence,
                        true,
                        driftStatus,
                        driftScore,
                        driftWarnings,
                        request.factors(),
                        null
                )
        ));
    }

    private String resolveCommand(String command) {
        Path commandPath = resolvePath(command);
        if (Files.exists(commandPath)) {
            return commandPath.toString();
        }
        return command;
    }

    private Path resolvePath(String value) {
        Path path = Path.of(value);
        if (path.isAbsolute()) {
            return path.normalize();
        }
        Path userDir = Path.of(System.getProperty("user.dir")).toAbsolutePath().normalize();
        Path direct = userDir.resolve(path).normalize();
        if (Files.exists(direct)) {
            return direct;
        }
        return resolveProjectRoot().resolve(path).normalize();
    }

    private Path resolveProjectRoot() {
        Path userDir = Path.of(System.getProperty("user.dir")).toAbsolutePath().normalize();
        if (Files.exists(userDir.resolve("scripts/ml/predict_congestion.py"))) {
            return userDir;
        }
        Path parent = userDir.getParent();
        if (parent != null && Files.exists(parent.resolve("scripts/ml/predict_congestion.py"))) {
            return parent;
        }
        return userDir;
    }

    private void deleteQuietly(Path path) {
        try {
            Files.deleteIfExists(path);
        } catch (IOException ignored) {
        }
    }

    private Double asDouble(Object value) {
        if (value instanceof Number number) {
            return number.doubleValue();
        }
        if (value instanceof String text) {
            try {
                return Double.parseDouble(text);
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private Long asLong(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        if (value instanceof String text) {
            try {
                return Long.parseLong(text);
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private List<String> asStringList(Object value) {
        if (value instanceof List<?> list) {
            return list.stream()
                    .map(String::valueOf)
                    .toList();
        }
        return List.of();
    }

    private List<String> readStringList(JsonNode node) {
        List<String> values = new ArrayList<>();
        if (node == null || !node.isArray()) {
            return values;
        }
        for (JsonNode item : node) {
            values.add(item.asText());
        }
        return values;
    }

    private int[] readIntArray(JsonNode node) {
        int[] values = new int[node.size()];
        for (int index = 0; index < node.size(); index++) {
            values[index] = node.get(index).asInt();
        }
        return values;
    }

    private double[] readDoubleArray(JsonNode node) {
        double[] values = new double[node.size()];
        for (int index = 0; index < node.size(); index++) {
            values[index] = node.get(index).asDouble();
        }
        return values;
    }

    private double[][] readDoubleMatrix(JsonNode node) {
        double[][] values = new double[node.size()][];
        for (int index = 0; index < node.size(); index++) {
            values[index] = readDoubleArray(node.get(index));
        }
        return values;
    }

    private double asDoubleValue(Object value, double defaultValue) {
        if (value instanceof Number number) {
            return number.doubleValue();
        }
        if (value instanceof String text) {
            try {
                return Double.parseDouble(text);
            } catch (NumberFormatException ignored) {
                return defaultValue;
            }
        }
        return defaultValue;
    }

    private String trimDouble(double value) {
        if (value == Math.rint(value)) {
            return String.valueOf((long) value);
        }
        return String.valueOf(Math.round(value * 10000.0) / 10000.0);
    }

    private static String displayLevelStable(String rawLevel) {
        return switch (String.valueOf(rawLevel).toUpperCase()) {
            case "LOW" -> "\uC5EC\uC720";
            case "NORMAL" -> "\uBCF4\uD1B5";
            case "BUSY" -> "\uD63C\uC7A1";
            case "VERY_BUSY" -> "\uB9E4\uC6B0 \uD63C\uC7A1";
            default -> String.valueOf(rawLevel);
        };
    }

    public static String displayLevel(String rawLevel) {
        return switch (String.valueOf(rawLevel).toUpperCase()) {
            case "LOW" -> "여유";
            case "NORMAL" -> "보통";
            case "BUSY" -> "혼잡";
            case "VERY_BUSY" -> "매우 혼잡";
            default -> String.valueOf(rawLevel);
        };
    }

    public record ModelPredictionRequest(
            Long id,
            Map<String, Object> features,
            List<String> factors
    ) {
    }

    private record PredictionResult(
            Long id,
            AiModelPredictionDto prediction
    ) {
    }

    private record PortableModel(
            List<String> numericFeatures,
            Map<String, List<String>> categoricalValues,
            List<String> labels,
            JsonNode trainingProfile,
            List<PortableTree> trees
    ) {
    }

    private record DriftResult(
            String status,
            Double score,
            List<String> warnings
    ) {
    }

    private record PortableTree(
            int[] childrenLeft,
            int[] childrenRight,
            int[] feature,
            double[] threshold,
            double[][] value
    ) {
        private double[] predict(double[] row) {
            int node = 0;
            while (node >= 0 && node < childrenLeft.length && childrenLeft[node] != -1) {
                int featureIndex = feature[node];
                double input = featureIndex >= 0 && featureIndex < row.length ? row[featureIndex] : 0.0;
                node = input <= threshold[node] ? childrenLeft[node] : childrenRight[node];
            }
            if (node < 0 || node >= value.length) {
                return new double[0];
            }
            return value[node];
        }
    }
}
