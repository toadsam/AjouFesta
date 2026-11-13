package com.festflow.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;
import java.time.LocalTime;

@Entity
@Table(name = "booths")
public class Booth {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private double latitude;

    @Column(nullable = false)
    private double longitude;

    @Column(nullable = false, length = 1000)
    private String description;

    @Column(nullable = false)
    private Integer displayOrder;

    @Column(nullable = false)
    private String imageUrl;

    private Integer estimatedWaitMinutes;

    private Integer remainingStock;

    @Column(length = 1000)
    private String liveStatusMessage;

    private LocalDateTime liveStatusUpdatedAt;

    @Column
    private Integer maxReservationMinutes;

    @Column(length = 2000)
    private String boothIntro;

    @Column(length = 1000)
    private String menuImageUrl;

    @Column(length = 4000)
    private String menuBoardJson;

    private String category = "\uC8FC\uC810";

    private String dayPart = "\uC57C\uAC04";

    private LocalTime openTime;

    private LocalTime closeTime;

    @Column(length = 1000)
    private String tags;

    @Column(length = 4000)
    private String contentJson;

    private Boolean reservationEnabled = true;

    /** 테이블 QR 주문 접수 여부. null 이면 켜진 것으로 본다. */
    private Boolean orderEnabled = true;

    /** 계좌이체 입금 계좌 (예: "국민 000000-00-000000"). */
    @Column(length = 200)
    private String bankAccount;

    @Column(length = 60)
    private String bankHolder;

    protected Booth() {
    }

    public Booth(String name, double latitude, double longitude, String description, Integer displayOrder, String imageUrl,
                 Integer estimatedWaitMinutes, Integer remainingStock, String liveStatusMessage, LocalDateTime liveStatusUpdatedAt) {
        this(name, latitude, longitude, description, displayOrder, imageUrl, estimatedWaitMinutes, remainingStock, liveStatusMessage, liveStatusUpdatedAt, 10);
    }

    public Booth(String name, double latitude, double longitude, String description, Integer displayOrder, String imageUrl,
                 Integer estimatedWaitMinutes, Integer remainingStock, String liveStatusMessage, LocalDateTime liveStatusUpdatedAt,
                 Integer maxReservationMinutes) {
        this.name = name;
        this.latitude = latitude;
        this.longitude = longitude;
        this.description = description;
        this.displayOrder = displayOrder;
        this.imageUrl = imageUrl;
        this.estimatedWaitMinutes = estimatedWaitMinutes;
        this.remainingStock = remainingStock;
        this.liveStatusMessage = liveStatusMessage;
        this.liveStatusUpdatedAt = liveStatusUpdatedAt;
        this.maxReservationMinutes = maxReservationMinutes == null || maxReservationMinutes < 1 ? 10 : maxReservationMinutes;
    }

    public void update(String name, double latitude, double longitude, String description, Integer displayOrder, String imageUrl,
                       Integer estimatedWaitMinutes, Integer remainingStock, String liveStatusMessage, LocalDateTime liveStatusUpdatedAt) {
        update(name, latitude, longitude, description, displayOrder, imageUrl, estimatedWaitMinutes, remainingStock, liveStatusMessage, liveStatusUpdatedAt, this.maxReservationMinutes);
    }

    public void update(String name, double latitude, double longitude, String description, Integer displayOrder, String imageUrl,
                       Integer estimatedWaitMinutes, Integer remainingStock, String liveStatusMessage, LocalDateTime liveStatusUpdatedAt,
                       Integer maxReservationMinutes) {
        this.name = name;
        this.latitude = latitude;
        this.longitude = longitude;
        this.description = description;
        this.displayOrder = displayOrder;
        this.imageUrl = imageUrl;
        this.estimatedWaitMinutes = estimatedWaitMinutes;
        this.remainingStock = remainingStock;
        this.liveStatusMessage = liveStatusMessage;
        this.liveStatusUpdatedAt = liveStatusUpdatedAt;
        if (maxReservationMinutes != null && maxReservationMinutes > 0) {
            this.maxReservationMinutes = maxReservationMinutes;
        }
    }

    public void updateContentInfo(String category, String dayPart, LocalTime openTime, LocalTime closeTime, String tags,
                                  String contentJson, Boolean reservationEnabled) {
        this.category = normalizeRequired(category, "\uC8FC\uC810");
        this.dayPart = normalizeRequired(dayPart, "\uC57C\uAC04");
        this.openTime = openTime;
        this.closeTime = closeTime;
        this.tags = normalizeBlank(tags);
        this.contentJson = normalizeBlank(contentJson);
        this.reservationEnabled = reservationEnabled != null ? reservationEnabled : true;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public void setDisplayOrder(Integer displayOrder) {
        this.displayOrder = displayOrder;
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public double getLatitude() {
        return latitude;
    }

    public double getLongitude() {
        return longitude;
    }

    public String getDescription() {
        return description;
    }

    public Integer getDisplayOrder() {
        return displayOrder;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public Integer getEstimatedWaitMinutes() {
        return estimatedWaitMinutes;
    }

    public void setEstimatedWaitMinutes(Integer estimatedWaitMinutes) {
        this.estimatedWaitMinutes = estimatedWaitMinutes;
    }

    public Integer getRemainingStock() {
        return remainingStock;
    }

    public void setRemainingStock(Integer remainingStock) {
        this.remainingStock = remainingStock;
    }

    public String getLiveStatusMessage() {
        return liveStatusMessage;
    }

    public void setLiveStatusMessage(String liveStatusMessage) {
        this.liveStatusMessage = liveStatusMessage;
    }

    public LocalDateTime getLiveStatusUpdatedAt() {
        return liveStatusUpdatedAt;
    }

    public void setLiveStatusUpdatedAt(LocalDateTime liveStatusUpdatedAt) {
        this.liveStatusUpdatedAt = liveStatusUpdatedAt;
    }

    public Integer getMaxReservationMinutes() {
        return maxReservationMinutes;
    }

    public void setMaxReservationMinutes(Integer maxReservationMinutes) {
        if (maxReservationMinutes == null || maxReservationMinutes < 1) {
            this.maxReservationMinutes = 10;
            return;
        }
        this.maxReservationMinutes = maxReservationMinutes;
    }

    public String getBoothIntro() {
        return boothIntro;
    }

    public void setBoothIntro(String boothIntro) {
        this.boothIntro = boothIntro;
    }

    public String getMenuImageUrl() {
        return menuImageUrl;
    }

    public void setMenuImageUrl(String menuImageUrl) {
        this.menuImageUrl = menuImageUrl;
    }

    public String getMenuBoardJson() {
        return menuBoardJson;
    }

    public void setMenuBoardJson(String menuBoardJson) {
        this.menuBoardJson = menuBoardJson;
    }

    public String getCategory() {
        return category;
    }

    public String getDayPart() {
        return dayPart;
    }

    public LocalTime getOpenTime() {
        return openTime;
    }

    public LocalTime getCloseTime() {
        return closeTime;
    }

    public String getTags() {
        return tags;
    }

    public String getContentJson() {
        return contentJson;
    }

    public Boolean getReservationEnabled() {
        return reservationEnabled;
    }

    public boolean isOrderEnabled() {
        return orderEnabled == null || orderEnabled;
    }

    public String getBankAccount() {
        return bankAccount;
    }

    public String getBankHolder() {
        return bankHolder;
    }

    public void updateOrderConfig(Boolean orderEnabled, String bankAccount, String bankHolder) {
        if (orderEnabled != null) {
            this.orderEnabled = orderEnabled;
        }
        this.bankAccount = normalizeBlank(bankAccount);
        this.bankHolder = normalizeBlank(bankHolder);
    }

    private String normalizeBlank(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private String normalizeRequired(String value, String fallback) {
        String normalized = normalizeBlank(value);
        return normalized != null ? normalized : fallback;
    }
}
