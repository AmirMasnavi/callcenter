package com.elmosanatearia.callcenter.common;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

/**
 * These cases are the reason school names are managed data. Each pair below looks identical
 * on screen but differs byte-for-byte, and each one previously created a second "school" in
 * the manager's per-school comparison.
 */
class TextNormalizerTest {

    @Test void foldsArabicYehToPersian() {
        assertEquals(TextNormalizer.normalize("دبیرستان فردوسی"),
                     TextNormalizer.normalize("دبيرستان فردوسي"));
    }

    @Test void foldsArabicKafToPersian() {
        assertEquals(TextNormalizer.normalize("کوثر"), TextNormalizer.normalize("كوثر"));
    }

    @Test void collapsesRepeatedWhitespaceAndTrims() {
        assertEquals("دبیرستان فردوسی", TextNormalizer.normalize("  دبیرستان   فردوسی  "));
    }

    @Test void stripsZeroWidthCharacters() {
        // A zero-width non-joiner is invisible but breaks string equality.
        assertEquals(TextNormalizer.normalize("هنرستان ابن‌سینا"),
                     TextNormalizer.normalize("هنرستان ابنسینا".replace("ابن", "ابن")));
    }

    @Test void convertsPersianAndArabicDigitsToAscii() {
        assertEquals("منطقه 12", TextNormalizer.normalize("منطقه ۱۲"));
        assertEquals("منطقه 12", TextNormalizer.normalize("منطقه ١٢"));
    }

    @Test void tabsAndNewlinesCountAsWhitespace() {
        assertEquals("مدرسه نمونه", TextNormalizer.normalize("مدرسه\t\nنمونه"));
    }

    @Test void cleanTrimsButKeepsWhatWasTyped() {
        // clean() is for storage/display, so it must NOT fold the characters away.
        assertEquals("دبيرستان فردوسي", TextNormalizer.clean("  دبيرستان   فردوسي "));
    }

    @Test void cleanReturnsNullForBlankInput() {
        assertNull(TextNormalizer.clean("   "));
        assertNull(TextNormalizer.clean(null));
    }

    @Test void normalizeHandlesNull() {
        assertNull(TextNormalizer.normalize(null));
    }
}
