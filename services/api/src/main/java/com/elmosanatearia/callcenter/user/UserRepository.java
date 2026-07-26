package com.elmosanatearia.callcenter.user;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface UserRepository extends JpaRepository<AppUser, Long> {
    Optional<AppUser> findByUsernameIgnoreCase(String username);
    List<AppUser> findAllByOrderByDisplayNameAsc();
    List<AppUser> findByRoleAndActiveTrueOrderByDisplayNameAsc(Role role);
    boolean existsByUsernameIgnoreCase(String username);
}
