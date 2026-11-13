package com.festflow.backend.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PublicApiRateLimitFilterTest {

    @Test
    void internalAddressesAreSkipped() {
        assertThat(PublicApiRateLimitFilter.isInternalAddress("10.0.0.3")).isTrue();
        assertThat(PublicApiRateLimitFilter.isInternalAddress("100.64.1.2")).isTrue();
        assertThat(PublicApiRateLimitFilter.isInternalAddress("172.20.0.1")).isTrue();
        assertThat(PublicApiRateLimitFilter.isInternalAddress("192.168.1.10")).isTrue();
        assertThat(PublicApiRateLimitFilter.isInternalAddress("127.0.0.1")).isTrue();
        assertThat(PublicApiRateLimitFilter.isInternalAddress("::1")).isTrue();
        assertThat(PublicApiRateLimitFilter.isInternalAddress("fd12::1")).isTrue();
        assertThat(PublicApiRateLimitFilter.isInternalAddress("203.249.1.7")).isFalse();
        assertThat(PublicApiRateLimitFilter.isInternalAddress("2001:db8::1")).isFalse();
        assertThat(PublicApiRateLimitFilter.isInternalAddress("172.32.0.1")).isFalse();
    }
}
