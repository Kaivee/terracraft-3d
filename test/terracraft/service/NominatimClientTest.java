package terracraft.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

/** Unit tests for display-name shortening (port of tests/reverseGeocode.test.js). */
class NominatimClientTest {

    @Test
    void shortenNameKeepsTheFirstThreeSegmentsTrimmed() {
        assertEquals(
            "Mount Fuji, Shizuoka, Yamanashi",
            NominatimClient.shortenName("Mount Fuji, Shizuoka, Yamanashi, Japan")
        );
    }

    @Test
    void shortenNameHandlesFewerThanThreeSegments() {
        assertEquals("Auckland, New Zealand", NominatimClient.shortenName("Auckland, New Zealand"));
    }

    @Test
    void shortenNameReturnsEmptyStringForEmptyInput() {
        assertEquals("", NominatimClient.shortenName(""));
        assertEquals("", NominatimClient.shortenName(null));
    }
}
