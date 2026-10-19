package terracraft.web;

import java.io.IOException;
import java.io.OutputStream;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.sun.net.httpserver.HttpExchange;

import terracraft.model.ErrorResponse;

/**
 * Request — thin convenience wrapper over a single HttpExchange.
 *
 * Parses the query string and provides helpers to write JSON responses.
 */
public final class Request {

    private static final Gson GSON = new GsonBuilder().serializeNulls().create();

    private final HttpExchange exchange;
    private final Map<String, String> query;

    public Request(HttpExchange exchange) {
        this.exchange = exchange;
        this.query = parseQuery(exchange.getRequestURI().getRawQuery());
    }

    public String method() {
        return exchange.getRequestMethod();
    }

    public String path() {
        return exchange.getRequestURI().getPath();
    }

    /** First value of a query parameter, or null. */
    public String queryParam(String name) {
        return query.get(name);
    }

    public String clientIp() {
        if (exchange.getRemoteAddress() != null && exchange.getRemoteAddress().getAddress() != null) {
            return exchange.getRemoteAddress().getAddress().getHostAddress();
        }
        return "unknown";
    }

    public void addHeader(String name, String value) {
        exchange.getResponseHeaders().set(name, value);
    }

    public void json(int status, Object body) throws IOException {
        writeJson(status, GSON.toJson(body));
    }

    public void error(int status, String message) throws IOException {
        writeJson(status, GSON.toJson(new ErrorResponse(message)));
    }

    private void writeJson(int status, String json) throws IOException {
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        exchange.sendResponseHeaders(status, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }

    private static Map<String, String> parseQuery(String rawQuery) {
        Map<String, String> map = new HashMap<>();
        if (rawQuery == null || rawQuery.isEmpty()) {
            return map;
        }
        for (String pair : rawQuery.split("&")) {
            int eq = pair.indexOf('=');
            if (eq < 0) {
                map.putIfAbsent(decode(pair), "");
            } else {
                map.putIfAbsent(decode(pair.substring(0, eq)), decode(pair.substring(eq + 1)));
            }
        }
        return map;
    }

    private static String decode(String value) {
        return URLDecoder.decode(value, StandardCharsets.UTF_8);
    }
}
