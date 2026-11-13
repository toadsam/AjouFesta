package com.festflow.backend.repository;

import com.festflow.backend.entity.CrewMember;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CrewMemberRepository extends JpaRepository<CrewMember, Long> {

    List<CrewMember> findAllByOrderBySortOrderAscIdAsc();

    Optional<CrewMember> findByName(String name);
}
