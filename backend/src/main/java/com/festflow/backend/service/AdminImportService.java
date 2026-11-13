package com.festflow.backend.service;

import com.festflow.backend.dto.BoothUpsertRequestDto;
import com.festflow.backend.dto.EventUpsertRequestDto;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Service
public class AdminImportService {

    private final BoothService boothService;
    private final EventService eventService;

    public AdminImportService(BoothService boothService, EventService eventService) {
        this.boothService = boothService;
        this.eventService = eventService;
    }

    public int importBoothsCsv(MultipartFile file) throws IOException {
        int count = 0;
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            boolean first = true;
            while ((line = reader.readLine()) != null) {
                if (first) {
                    first = false;
                    continue;
                }
                String[] values = line.split(",", -1);
                if (values.length < 4) continue;
                boothService.createBooth(new BoothUpsertRequestDto(
                        values[0].trim(),
                        Double.parseDouble(values[1].trim()),
                        Double.parseDouble(values[2].trim()),
                        values[3].trim(),
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        values.length > 4 ? values[4].trim() : null,
                        values.length > 5 ? values[5].trim() : null,
                        values.length > 6 && !values[6].isBlank() ? LocalTime.parse(values[6].trim()) : null,
                        values.length > 7 && !values[7].isBlank() ? LocalTime.parse(values[7].trim()) : null,
                        values.length > 8 ? values[8].trim() : null,
                        values.length > 9 ? values[9].trim() : null,
                        values.length > 10 && !values[10].isBlank() ? Boolean.parseBoolean(values[10].trim()) : null
                ));
                count++;
            }
        }
        return count;
    }

    public int importEventsCsv(MultipartFile file) throws IOException {
        int count = 0;
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            boolean first = true;
            while ((line = reader.readLine()) != null) {
                if (first) {
                    first = false;
                    continue;
                }
                String[] values = line.split(",", -1);
                if (values.length < 3) continue;
                eventService.createEvent(new EventUpsertRequestDto(
                        values[0].trim(),
                        LocalDateTime.parse(values[1].trim()),
                        LocalDateTime.parse(values[2].trim()),
                        values.length > 3 ? values[3].trim() : null,
                        values.length > 4 ? values[4].trim() : null,
                        values.length > 5 ? values[5].trim() : null,
                        values.length > 6 ? values[6].trim() : null,
                        values.length > 7 ? values[7].trim() : null,
                        values.length > 8 && !values[8].isBlank() ? Integer.parseInt(values[8].trim()) : null
                ));
                count++;
            }
        }
        return count;
    }
}
