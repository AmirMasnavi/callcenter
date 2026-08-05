package com.elmosanatearia.callcenter.attendance;

import org.springframework.data.jpa.repository.*;
import java.util.List;
import java.util.Optional;

public interface PayrollPeriodRepository extends JpaRepository<PayrollPeriod, Long> {

    Optional<PayrollPeriod> findByClosedAtIsNull();

    /**
     * Lines are fetched with the periods: the list view sums them, and lazy-loading one
     * collection per period is a query per row for data that is small and always wanted.
     */
    @Query("select distinct p from PayrollPeriod p left join fetch p.lines order by p.startsOn desc")
    List<PayrollPeriod> newestFirst();

    @Query("select p from PayrollPeriod p left join fetch p.lines where p.id = :id")
    Optional<PayrollPeriod> withLines(Long id);
}
