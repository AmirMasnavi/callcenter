package com.elmosanatearia.callcenter.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.*;

public interface UserRepository extends JpaRepository<AppUser, Long> {
    Optional<AppUser> findByUsernameIgnoreCase(String username);
    List<AppUser> findAllByOrderByDisplayNameAsc();
    boolean existsByUsernameIgnoreCase(String username);

    @Query("select u from AppUser u where :role member of u.roles and u.active = true order by u.displayName")
    List<AppUser> findActiveByRole(@Param("role") Role role);

    /** Used to stop an admin from removing the last remaining active admin. */
    @Query("select count(u) from AppUser u where :role member of u.roles and u.active = true and u.id <> :excludeId")
    long countActiveByRoleExcluding(@Param("role") Role role, @Param("excludeId") Long excludeId);
}
