package com.elmosanatearia.callcenter.user;

import com.elmosanatearia.callcenter.audit.*;
import com.elmosanatearia.callcenter.auth.AppPrincipal;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;

@RestController @RequestMapping("/api/v1/users")
public class AvatarController {
    /** Matches spring.servlet.multipart.max-file-size in application.yml. */
    static final long MAX_AVATAR_BYTES = 2_000_000;

    private final UserRepository users;
    private final AuditRepository audits;
    public AvatarController(UserRepository users, AuditRepository audits) {
        this.users = users; this.audits = audits;
    }

    @GetMapping("/{id}/avatar")
    ResponseEntity<byte[]> avatar(@PathVariable Long id) {
        AppUser u = users.findById(id).orElseThrow();
        if (u.getAvatarBytes() == null || u.getAvatarContentType() == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(u.getAvatarContentType()))
                .cacheControl(CacheControl.noCache())
                .body(u.getAvatarBytes());
    }

    /** Anyone may set their OWN picture — no admin involvement needed. */
    @PostMapping(value = "/me/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Transactional
    ResponseEntity<Void> uploadMine(@RequestPart("file") MultipartFile file,
                                    @AuthenticationPrincipal AppPrincipal principal) throws IOException {
        AppUser me = users.findById(principal.id()).orElseThrow();
        validate(file);
        me.setAvatarBytes(file.getBytes());
        me.setAvatarContentType(file.getContentType());
        users.save(me);
        audits.save(new AuditEvent(me, "UPDATE_OWN_AVATAR", "AppUser", String.valueOf(me.getId()), null));
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/me/avatar") @Transactional
    ResponseEntity<Void> removeMine(@AuthenticationPrincipal AppPrincipal principal) {
        AppUser me = users.findById(principal.id()).orElseThrow();
        me.setAvatarBytes(null);
        me.setAvatarContentType(null);
        users.save(me);
        audits.save(new AuditEvent(me, "REMOVE_OWN_AVATAR", "AppUser", String.valueOf(me.getId()), null));
        return ResponseEntity.noContent().build();
    }

    /** Shared by this controller and the admin one, so both reject the same things. */
    static void validate(MultipartFile file) {
        if (file.isEmpty()) throw new IllegalArgumentException("فایلی انتخاب نشده است");
        if (file.getSize() > MAX_AVATAR_BYTES) throw new IllegalArgumentException("حجم عکس باید کمتر از ۲ مگابایت باشد");
        String type = file.getContentType();
        if (type == null || !type.startsWith("image/")) throw new IllegalArgumentException("فایل انتخاب‌شده باید تصویر باشد");
    }
}
