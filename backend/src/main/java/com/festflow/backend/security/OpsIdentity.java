package com.festflow.backend.security;

public record OpsIdentity(
        String username,
        String role,
        Long boothId
) {
}

