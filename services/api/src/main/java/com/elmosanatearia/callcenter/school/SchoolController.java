package com.elmosanatearia.callcenter.school;

import com.elmosanatearia.callcenter.audit.*;
import com.elmosanatearia.callcenter.auth.AppPrincipal;
import com.elmosanatearia.callcenter.common.TextNormalizer;
import com.elmosanatearia.callcenter.user.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
public class SchoolController {
    private final SchoolRepository schools;
    private final UserRepository users;
    private final AuditRepository audits;

    public SchoolController(SchoolRepository schools, UserRepository users, AuditRepository audits) {
        this.schools = schools; this.users = users; this.audits = audits;
    }

    public record SchoolView(Long id, String name, boolean active) {
        static SchoolView of(School s) { return new SchoolView(s.getId(), s.getName(), s.isActive()); }
    }
    public record SchoolRequest(@NotBlank @Size(max = 160) String name, boolean active) {}

    /**
     * The picker any report form uses. Available to anyone who can file a report — an
     * operator has to choose from this list, which is what keeps the names consistent.
     */
    @GetMapping("/api/v1/schools")
    @Transactional(readOnly = true)
    public List<SchoolView> active() {
        return schools.findByActiveTrueOrderByNameAsc().stream().map(SchoolView::of).toList();
    }

    // --- management (gated on MANAGE_SCHOOLS in SecurityConfig) ---

    @GetMapping("/api/v1/admin/schools")
    @Transactional(readOnly = true)
    public List<SchoolView> all() {
        return schools.findAllByOrderByNameAsc().stream().map(SchoolView::of).toList();
    }

    @PostMapping("/api/v1/admin/schools")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public SchoolView create(@Valid @RequestBody SchoolRequest body, @AuthenticationPrincipal AppPrincipal actor) {
        String normalized = TextNormalizer.normalize(body.name());
        if (normalized == null || normalized.isBlank())
            throw new IllegalArgumentException("نام مدرسه نمی‌تواند خالی باشد");
        // Compared on the canonical form, so a stray space or an Arabic yeh cannot create
        // a second row for a school that already exists.
        schools.findByNormalizedName(normalized).ifPresent(existing -> {
            throw new IllegalArgumentException("این مدرسه از قبل ثبت شده است: " + existing.getName());
        });
        School saved = schools.save(new School(body.name()));
        audit(actor, "CREATE_SCHOOL", saved.getId(), saved.getName());
        return SchoolView.of(saved);
    }

    @PutMapping("/api/v1/admin/schools/{id}")
    @Transactional
    public SchoolView update(@PathVariable Long id, @Valid @RequestBody SchoolRequest body,
                             @AuthenticationPrincipal AppPrincipal actor) {
        School school = schools.findById(id).orElseThrow(() -> new IllegalArgumentException("مدرسه یافت نشد"));
        String normalized = TextNormalizer.normalize(body.name());
        schools.findByNormalizedName(normalized)
                .filter(other -> !other.getId().equals(id))
                .ifPresent(other -> { throw new IllegalArgumentException("مدرسه دیگری با همین نام وجود دارد"); });
        school.setName(body.name());
        school.setActive(body.active());
        audit(actor, "UPDATE_SCHOOL", id, school.getName());
        return SchoolView.of(schools.save(school));
    }

    /**
     * Deactivates rather than deletes: existing reports reference the name, and removing it
     * would silently orphan them in the per-school comparison.
     */
    @DeleteMapping("/api/v1/admin/schools/{id}")
    @Transactional
    public SchoolView deactivate(@PathVariable Long id, @AuthenticationPrincipal AppPrincipal actor) {
        School school = schools.findById(id).orElseThrow(() -> new IllegalArgumentException("مدرسه یافت نشد"));
        school.setActive(false);
        audit(actor, "DEACTIVATE_SCHOOL", id, school.getName());
        return SchoolView.of(schools.save(school));
    }

    private void audit(AppPrincipal actor, String action, Long id, String meta) {
        audits.save(new AuditEvent(users.findById(actor.id()).orElseThrow(), action, "School", String.valueOf(id), meta));
    }
}
