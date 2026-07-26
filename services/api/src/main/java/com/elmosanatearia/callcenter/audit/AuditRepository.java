package com.elmosanatearia.callcenter.audit;
import org.springframework.data.jpa.repository.*;
import java.util.List;
public interface AuditRepository extends JpaRepository<AuditEvent,Long>{
 @Query("select a from AuditEvent a left join fetch a.actor order by a.createdAt desc")
 List<AuditEvent> newest();
}
