package com.festflow.backend.dto;

public record OrderMenuItemDto(
        String name,
        String description,
        String priceLabel,
        Integer price,
        Boolean soldOut,
        String imageUrl
) {
}
