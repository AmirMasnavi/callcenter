package com.elmosanatearia.callcenter.payroll;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface WorkPeriodRepository extends JpaRepository<WorkPeriod, Long> {

    Optional<WorkPeriod> findByUserIdAndClosedAtIsNull(Long userId);

    @Query("select p from WorkPeriod p join fetch p.user where p.closedAt is null")
    List<WorkPeriod> allOpen();

    @Query("select p from WorkPeriod p join fetch p.user where p.user.id = :userId order by p.seq desc")
    List<WorkPeriod> historyFor(@Param("userId") Long userId);

    @Query("select coalesce(max(p.seq), 0) from WorkPeriod p where p.user.id = :userId")
    int lastSeq(@Param("userId") Long userId);

    /** Settled cycles, newest first — the archive the manager compares against. */
    @Query("select p from WorkPeriod p join fetch p.user where p.closedAt is not null order by p.closedAt desc")
    List<WorkPeriod> settled();
}
