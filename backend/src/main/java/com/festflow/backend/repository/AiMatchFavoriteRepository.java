package com.festflow.backend.repository;

import com.festflow.backend.entity.AiMatchFavorite;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface AiMatchFavoriteRepository extends JpaRepository<AiMatchFavorite, Long> {

    Optional<AiMatchFavorite> findByRequesterProfileIdAndProfileId(Long requesterProfileId, Long profileId);

    @Query("""
            select favorite.profile.id
            from AiMatchFavorite favorite
            where favorite.requesterProfile.id = :requesterProfileId
              and favorite.profile.status = 'ACTIVE'
            order by favorite.createdAt desc
            """)
    List<Long> findActiveProfileIdsByRequesterProfileId(@Param("requesterProfileId") Long requesterProfileId);

    void deleteAllByRequesterProfileIdOrProfileId(Long requesterProfileId, Long profileId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = """
            delete from ai_match_favorites
            where requester_profile_id in (:profileIds)
               or favorite_profile_id in (:profileIds)
            """, nativeQuery = true)
    int deleteAllReferencingProfileIds(@Param("profileIds") List<Long> profileIds);
}
