package com.festflow.backend.init;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.util.Locale;

@Configuration
public class AiMatchSchemaInitializer {

    private static final Logger log = LoggerFactory.getLogger(AiMatchSchemaInitializer.class);
    private static final String FAVORITES_TABLE = "ai_match_favorites";
    private static final String REQUESTS_TABLE = "ai_match_requests";
    private static final String FAVORITE_PROFILE_COLUMN = "favorite_profile_id";
    private static final String LEGACY_PROFILE_COLUMN = "profile_id";
    private static final String LEGACY_VIEWER_COLUMN = "viewer_profile_id";
    private static final String REQUESTER_PROFILE_COLUMN = "requester_profile_id";

    @Bean
    public ApplicationRunner aiMatchFavoriteSchemaGuard(JdbcTemplate jdbcTemplate) {
        return args -> {
            try {
                if (!tableExists(jdbcTemplate, FAVORITES_TABLE)) {
                    makeRequestRequesterColumnNullableIfPresent(jdbcTemplate);
                    return;
                }

                reconcileFavoriteColumns(jdbcTemplate);
                makeRequestRequesterColumnNullableIfPresent(jdbcTemplate);
            } catch (Exception exception) {
                log.warn("Could not reconcile AI match legacy schema.", exception);
            }
        };
    }

    private boolean tableExists(JdbcTemplate jdbcTemplate, String tableName) {
        return jdbcTemplate.execute((ConnectionCallback<Boolean>) connection -> {
            DatabaseMetaData metadata = connection.getMetaData();
            try (ResultSet resultSet = metadata.getTables(connection.getCatalog(), null, tableName, null)) {
                if (resultSet.next()) {
                    return true;
                }
            }
            try (ResultSet resultSet = metadata.getTables(connection.getCatalog(), null, tableName.toUpperCase(Locale.ROOT), null)) {
                return resultSet.next();
            }
        });
    }

    private boolean columnExists(JdbcTemplate jdbcTemplate, String tableName, String columnName) {
        return jdbcTemplate.execute((ConnectionCallback<Boolean>) connection -> {
            DatabaseMetaData metadata = connection.getMetaData();
            try (ResultSet resultSet = metadata.getColumns(connection.getCatalog(), null, tableName, columnName)) {
                if (resultSet.next()) {
                    return true;
                }
            }
            try (ResultSet resultSet = metadata.getColumns(
                    connection.getCatalog(),
                    null,
                    tableName.toUpperCase(Locale.ROOT),
                    columnName.toUpperCase(Locale.ROOT)
            )) {
                return resultSet.next();
            }
        });
    }

    private void reconcileFavoriteColumns(JdbcTemplate jdbcTemplate) {
        boolean hasFavoriteProfileColumn = columnExists(jdbcTemplate, FAVORITES_TABLE, FAVORITE_PROFILE_COLUMN);
        boolean hasRequesterProfileColumn = columnExists(jdbcTemplate, FAVORITES_TABLE, REQUESTER_PROFILE_COLUMN);
        boolean hasLegacyProfileColumn = columnExists(jdbcTemplate, FAVORITES_TABLE, LEGACY_PROFILE_COLUMN);
        boolean hasLegacyViewerColumn = columnExists(jdbcTemplate, FAVORITES_TABLE, LEGACY_VIEWER_COLUMN);

        if (hasFavoriteProfileColumn && hasLegacyProfileColumn) {
            jdbcTemplate.update("""
                    update ai_match_favorites
                    set favorite_profile_id = profile_id
                    where profile_id is not null
                      and (favorite_profile_id is null or favorite_profile_id <> profile_id)
                    """);
            jdbcTemplate.update("""
                    update ai_match_favorites
                    set profile_id = favorite_profile_id
                    where profile_id is null
                      and favorite_profile_id is not null
                    """);
            makeColumnNullable(jdbcTemplate, FAVORITES_TABLE, LEGACY_PROFILE_COLUMN);
        }

        if (hasRequesterProfileColumn && hasLegacyViewerColumn) {
            jdbcTemplate.update("""
                    update ai_match_favorites
                    set requester_profile_id = viewer_profile_id
                    where viewer_profile_id is not null
                      and (requester_profile_id is null or requester_profile_id <> viewer_profile_id)
                    """);
            jdbcTemplate.update("""
                    update ai_match_favorites
                    set viewer_profile_id = requester_profile_id
                    where viewer_profile_id is null
                      and requester_profile_id is not null
                    """);
            makeColumnNullable(jdbcTemplate, FAVORITES_TABLE, LEGACY_VIEWER_COLUMN);
        }
    }

    private void makeRequestRequesterColumnNullableIfPresent(JdbcTemplate jdbcTemplate) {
        if (tableExists(jdbcTemplate, REQUESTS_TABLE) && columnExists(jdbcTemplate, REQUESTS_TABLE, REQUESTER_PROFILE_COLUMN)) {
            makeColumnNullable(jdbcTemplate, REQUESTS_TABLE, REQUESTER_PROFILE_COLUMN);
        }
    }

    private void makeColumnNullable(JdbcTemplate jdbcTemplate, String tableName, String columnName) {
        String databaseProductName = jdbcTemplate.execute((ConnectionCallback<String>) connection ->
                connection.getMetaData().getDatabaseProductName().toLowerCase(Locale.ROOT)
        );

        if (databaseProductName == null) {
            return;
        }

        if (databaseProductName.contains("mysql") || databaseProductName.contains("mariadb")) {
            jdbcTemplate.execute("alter table " + tableName + " modify column " + columnName + " bigint null");
            return;
        }

        if (databaseProductName.contains("postgresql")) {
            jdbcTemplate.execute("alter table " + tableName + " alter column " + columnName + " drop not null");
            return;
        }

        if (databaseProductName.contains("h2")) {
            jdbcTemplate.execute("alter table " + tableName + " alter column " + columnName + " bigint null");
        }
    }
}
