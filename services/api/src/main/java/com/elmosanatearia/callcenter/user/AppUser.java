package com.elmosanatearia.callcenter.user;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "app_users")
public class AppUser {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, unique = true, length = 80)
    private String username;
    @Column(name = "password_hash", nullable = false)
    private String passwordHash;
    @Column(name = "display_name", nullable = false)
    private String displayName;
    @Enumerated(EnumType.STRING) @Column(nullable = false)
    private Role role;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "supervisor_id")
    private AppUser supervisor;
    @Column(nullable = false)
    private boolean active = true;
    @Column(name = "must_change_password", nullable = false)
    private boolean mustChangePassword = true;
    @Column(name="avatar_bytes") private byte[] avatarBytes;
    @Column(name="avatar_content_type",length=80) private String avatarContentType;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @PreUpdate void preUpdate() { updatedAt = Instant.now(); }
    public Long getId() { return id; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
    public Role getRole() { return role; }
    public void setRole(Role role) { this.role = role; }
    public AppUser getSupervisor() { return supervisor; }
    public void setSupervisor(AppUser supervisor) { this.supervisor = supervisor; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public boolean isMustChangePassword() { return mustChangePassword; }
    public void setMustChangePassword(boolean mustChangePassword) { this.mustChangePassword = mustChangePassword; }
    public byte[] getAvatarBytes(){return avatarBytes;} public void setAvatarBytes(byte[] value){avatarBytes=value;}
    public String getAvatarContentType(){return avatarContentType;} public void setAvatarContentType(String value){avatarContentType=value;}
}
