package hr.zavrsni.incidentapp.security;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.jspecify.annotations.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;

/**
 * WHY THIS FILE EXISTS
 * --------------------
 * Brute-force protection for /api/auth/**. Each client IP gets its own
 * token bucket: capacity 5, refills 5 tokens every 60 seconds. Each request
 * consumes one token; a request that finds the bucket empty is rejected with
 * HTTP 429 Too Many Requests and a Retry-After header.
 *
 * Token-bucket vs fixed-window: a fixed window (e.g. "5 per minute, reset on
 * the 0th second") allows a burst of 10 across a window boundary (5 at 0:59,
 * 5 at 1:00). A token bucket drains and refills smoothly, so the cap holds
 * even across boundaries. Bucket4j is the standard Java implementation.
 *
 * State lives in an in-memory map. Two consequences worth knowing:
 *   1. The map grows by one entry per unique IP that ever hits an auth
 *      endpoint and never shrinks. For a thesis-scale app this is fine; in
 *      production we'd add expiry or move state to Redis.
 *   2. State is per-instance — running multiple backend replicas behind a
 *      load balancer would let an attacker get N * 5 attempts. Single
 *      instance is the assumption here.
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final int CAPACITY = 5;
    private static final Duration WINDOW = Duration.ofMinutes(1);

    private final ConcurrentHashMap<String, Bucket> buckets = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain chain)
            throws ServletException, IOException {

        Bucket bucket = buckets.computeIfAbsent(clientIp(request), ip -> newBucket());

        if (bucket.tryConsume(1)) {
            chain.doFilter(request, response);
            return;
        }

        // 429 Too Many Requests — the jakarta Servlet API never added a SC_ constant for this.
        response.setStatus(429);
        response.setHeader("Retry-After", String.valueOf(WINDOW.toSeconds()));
        response.setContentType("application/json");
        response.getWriter().write(
                "{\"status\":429,\"message\":\"Too many requests. Try again in a minute.\"}");
    }

    /**
     * Skip this filter for everything except /api/auth/**. Returning true here
     * means doFilterInternal is not invoked, so the rest of the request flows
     * straight through Spring Security with no rate-limit overhead.
     */
    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/auth/");
    }

    private Bucket newBucket() {
        // Bucket4j 8.x builder API (replaces the deprecated Bandwidth.classic/Refill):
        // capacity 5, refilling all 5 tokens once per WINDOW ("intervally").
        Bandwidth limit = Bandwidth.builder()
                .capacity(CAPACITY)
                .refillIntervally(CAPACITY, WINDOW)
                .build();
        return Bucket.builder().addLimit(limit).build();
    }

    /**
     * Pull the client IP. Behind a reverse proxy (Nginx, Caddy) the original
     * IP is in X-Forwarded-For; the proxy chain adds itself, so we take the
     * first entry. Direct connections fall back to remoteAddr.
     *
     * Note: X-Forwarded-For is client-controllable when no trusted proxy
     * strips/sets it. In our deployment Nginx always sets it, so this is
     * acceptable here — but if this ever ran without a proxy in front, an
     * attacker could vary the header to dodge the limit. PHASE_07 wires up
     * Caddy as the trusted edge.
     */
    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
