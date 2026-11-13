package com.festflow.backend.init;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Locale;

@Configuration
public class ReservationSchemaInitializer {

    private static final Logger log = LoggerFactory.getLogger(ReservationSchemaInitializer.class);

    @Bean
    @Order(Ordered.HIGHEST_PRECEDENCE)
    public ApplicationRunner reservationSchemaGuard(JdbcTemplate jdbcTemplate) {
        return args -> {
            try {
                String databaseProductName = jdbcTemplate.execute((ConnectionCallback<String>) connection ->
                        connection.getMetaData().getDatabaseProductName().toLowerCase(Locale.ROOT)
                );
                if (databaseProductName == null || !databaseProductName.contains("postgresql")) {
                    return;
                }

                jdbcTemplate.execute("""
                        alter table booth_reservations
                        drop constraint if exists booth_reservations_status_check
                        """);
                jdbcTemplate.execute("""
                        alter table booth_reservations
                        add constraint booth_reservations_status_check
                        check (status in ('RESERVED', 'CHECKED_IN', 'EXPIRED', 'COMPLETED', 'CANCELED', 'CANCELLED'))
                        """);
            } catch (Exception exception) {
                log.warn("Could not reconcile reservation status schema.", exception);
            }
        };
    }
}
