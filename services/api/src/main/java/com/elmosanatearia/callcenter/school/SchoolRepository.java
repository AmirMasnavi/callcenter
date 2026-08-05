package com.elmosanatearia.callcenter.school;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface SchoolRepository extends JpaRepository<School, Long> {
    Optional<School> findByNormalizedName(String normalizedName);
    List<School> findByActiveTrueOrderByNameAsc();
    List<School> findAllByOrderByNameAsc();
}
