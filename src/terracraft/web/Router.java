package terracraft.web;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import com.sun.net.httpserver.HttpExchange;

/**
 * Router — maps GET paths under /api to handlers.
 *
 * Supports exact paths (with an optional rate limiter) and prefix paths.
 * Unmatched API requests return a JSON 404, and any handler exception becomes a
 * JSON 500, mirroring the Express app.
 */
public final class Router {

    private final List<Route> routes = new ArrayList<>();

    public void add(String method, String path, Handler handler) {
        routes.add(new Route(method, path, false, handler, null));
    }

    public void add(String method, String path, Handler handler, RateLimiter limiter) {
        routes.add(new Route(method, path, false, handler, limiter));
    }

    public void addPrefix(String method, String pathPrefix, Handler handler) {
        routes.add(new Route(method, pathPrefix, true, handler, null));
    }

    /** Entry point wired into the HTTP server for /api/. */
    public void dispatch(HttpExchange exchange) {
        long start = System.currentTimeMillis();
        Request request = new Request(exchange);
        String method = request.method();
        String path = request.path();

        try {
            Route route = find(method, path);
            if (route == null) {
                request.error(404, "Not found");
                return;
            }
            if (route.limiter != null) {
                RateLimiter.Decision decision = route.limiter.check(request.clientIp());
                if (!decision.allowed()) {
                    request.addHeader("Retry-After", String.valueOf(decision.retryAfterSeconds()));
                    request.error(429, "Too many requests. Please try again shortly.");
                    return;
                }
            }
            route.handler.handle(request);
        } catch (Exception e) {
            System.err.println("  Error: " + e.getMessage());
            try {
                if (exchange.getResponseCode() == -1) {
                    request.error(500, "Internal server error");
                }
            } catch (IOException ignored) {
                // Response already committed; nothing more we can do.
            }
        } finally {
            int status = exchange.getResponseCode();
            System.out.println(method + " " + path + " - " + status + " (" + (System.currentTimeMillis() - start) + "ms)");
            exchange.close();
        }
    }

    private Route find(String method, String path) {
        for (Route route : routes) {
            if (!route.method.equals(method)) {
                continue;
            }
            boolean matches = route.prefix ? path.startsWith(route.path) : path.equals(route.path);
            if (matches) {
                return route;
            }
        }
        return null;
    }

    private static final class Route {
        final String method;
        final String path;
        final boolean prefix;
        final Handler handler;
        final RateLimiter limiter;

        Route(String method, String path, boolean prefix, Handler handler, RateLimiter limiter) {
            this.method = method;
            this.path = path;
            this.prefix = prefix;
            this.handler = handler;
            this.limiter = limiter;
        }
    }
}
