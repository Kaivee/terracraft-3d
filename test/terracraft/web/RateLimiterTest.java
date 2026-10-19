package terracraft.web;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

/** Unit tests for the fixed-window rate limiter (port of tests/rateLimit.test.js). */
class RateLimiterTest {

    @Test
    void allowsRequestsUpToTheMax() {
        RateLimiter limiter = new RateLimiter(60_000, 3);
        int allowed = 0;
        for (int i = 0; i < 3; i++) {
            if (limiter.check("127.0.0.1").allowed()) {
                allowed++;
            }
        }
        assertEquals(3, allowed);
    }

    @Test
    void rejectsRequestsOverTheMaxWithRetryAfter() {
        RateLimiter limiter = new RateLimiter(60_000, 3);
        for (int i = 0; i < 3; i++) {
            assertTrue(limiter.check("127.0.0.1").allowed());
        }

        RateLimiter.Decision decision = limiter.check("127.0.0.1");
        assertFalse(decision.allowed());
        assertTrue(decision.retryAfterSeconds() >= 1);
    }

    @Test
    void usesSeparateBucketsPerIp() {
        RateLimiter limiter = new RateLimiter(60_000, 2);

        assertTrue(limiter.check("1.1.1.1").allowed());
        assertTrue(limiter.check("1.1.1.1").allowed());
        assertFalse(limiter.check("1.1.1.1").allowed());

        assertTrue(limiter.check("2.2.2.2").allowed());
        assertTrue(limiter.check("2.2.2.2").allowed());
    }
}
