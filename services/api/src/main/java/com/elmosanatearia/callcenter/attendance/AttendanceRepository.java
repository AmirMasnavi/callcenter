package com.elmosanatearia.callcenter.attendance;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.time.Instant;
import java.util.*;

public interface AttendanceRepository extends JpaRepository<AttendanceEntry, Long> {

    Optional<AttendanceEntry> findByUserIdAndExitAtIsNull(Long userId);

    boolean existsByUserId(Long userId);

    /** Everything overlapping a window, used for both the day view and range reports. */
    @Query("select e from AttendanceEntry e join fetch e.user u where e.entryAt >= :from and e.entryAt < :to order by e.entryAt desc")
    List<AttendanceEntry> between(@Param("from") Instant from, @Param("to") Instant to);

    @Query("select e from AttendanceEntry e join fetch e.user u where u.id = :userId and e.entryAt >= :from and e.entryAt < :to order by e.entryAt")
    List<AttendanceEntry> forUserBetween(@Param("userId") Long userId, @Param("from") Instant from, @Param("to") Instant to);
}
