package com.elmosanatearia.callcenter.common;

import java.text.Normalizer;

/**
 * Canonical form for user-typed Persian text used as a key (school names).
 *
 * <p>Persian input varies in ways that look identical on screen but differ byte-for-byte:
 * the Arabic yeh (ي) and kaf (ك) sit on most keyboards next to their Persian counterparts
 * (ی, ک), zero-width non-joiners are invisible, and Arabic-Indic digits differ from
 * Persian ones. Without folding these, "دبیرستان فردوسی" typed twice can produce two
 * separate schools — which is exactly what made the per-school comparison unreliable.
 */
public final class TextNormalizer {
    private TextNormalizer() {}

    public static String normalize(String value) {
        if (value == null) return null;
        String s = Normalizer.normalize(value, Normalizer.Form.NFC);
        s = s.replace('ي', 'ی')   // Arabic yeh   -> Persian yeh
             .replace('ى', 'ی')   // alef maksura -> Persian yeh
             .replace('ك', 'ک')   // Arabic kaf   -> Persian kaf
             .replace('ة', 'ه')   // teh marbuta  -> heh
             .replace('ۀ', 'ه');  // heh with yeh -> heh
        // Zero-width joiner/non-joiner and the BOM are invisible but break equality.
        s = s.replaceAll("[​-‍﻿]", "");
        // Arabic-Indic and Persian digits -> ASCII, so "۱۲" and "12" match.
        StringBuilder digits = new StringBuilder(s.length());
        for (char c : s.toCharArray()) {
            if (c >= '٠' && c <= '٩') digits.append((char) ('0' + c - '٠'));
            else if (c >= '۰' && c <= '۹') digits.append((char) ('0' + c - '۰'));
            else digits.append(c);
        }
        // Collapse runs of any whitespace to a single space, then trim.
        return digits.toString().replaceAll("\\s+", " ").trim();
    }

    /** Trimmed for storage/display, but not folded — we keep what the user actually typed. */
    public static String clean(String value) {
        if (value == null) return null;
        String s = value.replaceAll("\\s+", " ").trim();
        return s.isEmpty() ? null : s;
    }
}
