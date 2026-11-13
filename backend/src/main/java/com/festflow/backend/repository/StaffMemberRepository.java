package com.festflow.backend.repository;

import com.festflow.backend.entity.StaffMember;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StaffMemberRepository extends JpaRepository<StaffMember, Long> {
    Optional<StaffMember> findByStaffNoIgnoreCase(String staffNo);

    List<StaffMember> findByAssignedBoothId(Long assignedBoothId);
}

