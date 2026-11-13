package com.festflow.backend.controller.export;

import com.festflow.backend.dto.BoothResponseDto;
import com.festflow.backend.dto.EventResponseDto;
import com.festflow.backend.service.BoothService;
import com.festflow.backend.service.EventService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/export")
public class ExportController {

    private final BoothService boothService;
    private final EventService eventService;

    public ExportController(BoothService boothService, EventService eventService) {
        this.boothService = boothService;
        this.eventService = eventService;
    }

    @GetMapping(value = "/booths.csv", produces = "text/csv")
    public ResponseEntity<String> exportBooths() {
        List<BoothResponseDto> booths = boothService.getAllBooths();
        StringBuilder sb = new StringBuilder("id,name,latitude,longitude,description,displayOrder,imageUrl,category,dayPart,openTime,closeTime,tags,reservationEnabled\n");
        booths.forEach(booth -> sb.append(csvLine(
                String.valueOf(booth.id()),
                booth.name(),
                String.valueOf(booth.latitude()),
                String.valueOf(booth.longitude()),
                booth.description(),
                String.valueOf(booth.displayOrder()),
                booth.imageUrl(),
                booth.category(),
                booth.dayPart(),
                booth.openTime() != null ? String.valueOf(booth.openTime()) : "",
                booth.closeTime() != null ? String.valueOf(booth.closeTime()) : "",
                booth.tags(),
                String.valueOf(booth.reservationEnabled())
        )));

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=booths.csv")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(sb.toString());
    }

    @GetMapping(value = "/events.csv", produces = "text/csv")
    public ResponseEntity<String> exportEvents() {
        List<EventResponseDto> events = eventService.getAllEvents();
        StringBuilder sb = new StringBuilder("id,title,startTime,endTime,status,imageUrl,imageCredit,imageFocus,statusOverride,liveMessage,delayMinutes,statusUpdatedAt\n");
        events.forEach(event -> sb.append(csvLine(
                String.valueOf(event.id()),
                event.title(),
                String.valueOf(event.startTime()),
                String.valueOf(event.endTime()),
                event.status(),
                event.imageUrl(),
                event.imageCredit(),
                event.imageFocus(),
                event.statusOverride(),
                event.liveMessage(),
                event.delayMinutes() != null ? String.valueOf(event.delayMinutes()) : "",
                event.statusUpdatedAt() != null ? String.valueOf(event.statusUpdatedAt()) : ""
        )));

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=events.csv")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(sb.toString());
    }

    private String csvLine(String... values) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < values.length; i++) {
            String raw = values[i] != null ? values[i] : "";
            if (!raw.isEmpty() && "=+-@\t\r".indexOf(raw.charAt(0)) >= 0) {
                raw = "'" + raw;
            }
            String escaped = raw.replace("\"", "\"\"");
            sb.append('"').append(escaped).append('"');
            if (i < values.length - 1) {
                sb.append(',');
            }
        }
        sb.append('\n');
        return sb.toString();
    }
}
