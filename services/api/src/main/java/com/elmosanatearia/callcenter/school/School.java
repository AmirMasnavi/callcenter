package com.elmosanatearia.callcenter.school;

import com.elmosanatearia.callcenter.common.TextNormalizer;
import jakarta.persistence.*;
import java.time.Instant;

/**
 * A school an operator can be calling. Kept as managed data rather than free text so the
 * manager's per-school comparison groups reliably — see {@link TextNormalizer} for why
 * two visually identical Persian strings can otherwise be different rows.
 */
@Entity @Table(name = "schools")
public class School {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** As typed by whoever added it — this is what gets displayed. */
    @Column(nullable = false, length = 160)
    private String name;

    /** Canonical form; carries the uniqueness constraint. */
    @Column(name = "normalized_name", nullable = false, unique = true, length = 160)
    private String normalizedName;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected School() {}

    public School(String name) { setName(name); }

    public Long getId() { return id; }
    public String getName() { return name; }
    public void setName(String value) {
        this.name = TextNormalizer.clean(value);
        this.normalizedName = TextNormalizer.normalize(this.name);
    }
    public String getNormalizedName() { return normalizedName; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public Instant getCreatedAt() { return createdAt; }
}
