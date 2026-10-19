package terracraft.web;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * RateLimiter — dependency-free fixed-window, in-memory rate limiter.
 * Port of middleware/rateLimit.js.
 */
public final class RateLimiter {

    private static final int PRUNE_THRESHOLD = 10_000;

    private final long windowMs;
    private final int max;
    private final Map<String, Bucket> hits = new ConcurrentHashMap<>();

    public RateLimiter(long windowMs, int max) {
        this.windowMs = windowMs;
        this.max = max;
    }

    /** Record a hit for {@code ip} and decide whether it is allowed. */
    public synchronized Decision check(String ip) {
        long now = System.currentTimeMillis();
        if (hits.size() > PRUNE_THRESHOLD) {
            hits.entrySet().removeIf(e -> e.getValue().resetAt <= now);
        }

        Bucket bucket = hits.get(ip);
        if (bucket == null || bucket.resetAt <= now) {
            hits.put(ip, new Bucket(1, now + windowMs));
            return new Decision(true, 0);
        }

        bucket.count++;
        if (bucket.count > max) {
            long retryAfter = Math.max(1, (bucket.resetAt - now + 999) / 1000);
            return new Decision(false, retryAfter);
        }
        return new Decision(true, 0);
    }

    private static final class Bucket {
        int count;
        final long resetAt;

        Bucket(int count, long resetAt) {
            this.count = count;
            this.resetAt = resetAt;
        }
    }

    /** Outcome of a rate-limit check. */
    public record Decision(boolean allowed, long retryAfterSeconds) {
    }
}
