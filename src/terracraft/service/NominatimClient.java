package terracraft.service;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import terracraft.model.Location;
import terracraft.model.Suggestion;

/**
 * NominatimClient — geocoding via OpenStreetMap Nominatim.
 *
 * Respects the Nominatim usage policy: a minimum 1 request/second, a
 * descriptive User-Agent, retries with backoff, and a hard timeout.
 * Port of services/nominatimClient.js.
 */
public final class NominatimClient {

    private static final String SEARCH_URL = "https://nominatim.openstreetmap.org/search";
    private static final String REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";
    private static final String USER_AGENT = "TerraCraft3D/1.0 (college-project)";

    // Nominatim policy: max 1 req/sec. Add a small buffer.
    private static final long REQUEST_INTERVAL_MS = 1100;
    private static final Duration TIMEOUT = Duration.ofSeconds(10);
    private static final int MAX_RETRIES = 2;

    private final HttpClient http = HttpClient.newBuilder()
        .connectTimeout(TIMEOUT)
        .build();

    private final Object throttleLock = new Object();
    private long lastRequestAt = 0;

    /**
     * Geocode a location name to coordinates.
     */
    public Location geocode(String query) throws Exception {
        String url = SEARCH_URL + "?q=" + encode(query) + "&format=json&limit=1";
        JsonElement json = fetchJsonThrottled(url);

        JsonArray results = json != null && json.isJsonArray() ? json.getAsJsonArray() : new JsonArray();
        if (results.isEmpty()) {
            throw new IOException("Location not found: \"" + query + "\"");
        }

        JsonObject first = results.get(0).getAsJsonObject();
        return new Location(
            first.get("display_name").getAsString(),
            Double.parseDouble(first.get("lat").getAsString()),
            Double.parseDouble(first.get("lon").getAsString())
        );
    }

    /**
     * Fetch up to {@code limit} autocomplete suggestions for a query.
     */
    public List<Suggestion> searchSuggestions(String query, int limit) throws Exception {
        String url = SEARCH_URL + "?q=" + encode(query)
            + "&format=json&limit=" + limit + "&accept-language=en";
        JsonElement json = fetchJsonThrottled(url);

        List<Suggestion> suggestions = new ArrayList<>();
        if (json == null || !json.isJsonArray()) {
            return suggestions;
        }
        for (JsonElement element : json.getAsJsonArray()) {
            JsonObject item = element.getAsJsonObject();
            String displayName = item.has("display_name") ? item.get("display_name").getAsString() : "";
            String name = displayName.contains(",") ? displayName.split(",")[0] : displayName;
            suggestions.add(new Suggestion(
                name,
                displayName,
                "\uD83D\uDCCD", // 📍
                Double.parseDouble(item.get("lat").getAsString()),
                Double.parseDouble(item.get("lon").getAsString())
            ));
        }
        return suggestions;
    }

    /**
     * Reverse-geocode coordinates to a short place name, or null if none.
     */
    public String reverseGeocode(double lat, double lon) throws Exception {
        String url = REVERSE_URL + "?format=jsonv2&lat=" + lat + "&lon=" + lon
            + "&zoom=16&accept-language=en";
        JsonElement json = fetchJsonThrottled(url);
        if (json == null || !json.isJsonObject()) {
            return null;
        }
        JsonObject object = json.getAsJsonObject();
        if (!object.has("display_name") || object.get("display_name").isJsonNull()) {
            return null;
        }
        return shortenName(object.get("display_name").getAsString());
    }

    /** Reduce a long display_name to its first {@code parts} comma segments. */
    public static String shortenName(String displayName) {
        return shortenName(displayName, 3);
    }

    public static String shortenName(String displayName, int parts) {
        if (displayName == null || displayName.isEmpty()) {
            return "";
        }
        String[] split = displayName.split(",", -1);
        int count = Math.min(parts, split.length);
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < count; i++) {
            if (i > 0) {
                sb.append(", ");
            }
            sb.append(split[i].trim());
        }
        return sb.toString();
    }

    // --- internals -------------------------------------------------------

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    /** Run an async task with retry + backoff. Throws the last error. */
    private JsonElement withRetry(Callable<JsonElement> task) throws Exception {
        Exception lastError = null;
        for (int attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                return task.call();
            } catch (Exception e) {
                lastError = e;
                if (attempt < MAX_RETRIES) {
                    Thread.sleep(600L * (attempt + 1));
                }
            }
        }
        throw lastError;
    }

    /** Serialize every Nominatim request through a shared 1 req/sec throttle. */
    private JsonElement fetchJsonThrottled(String url) throws Exception {
        return withRetry(() -> {
            synchronized (throttleLock) {
                long wait = Math.max(0, REQUEST_INTERVAL_MS - (System.currentTimeMillis() - lastRequestAt));
                if (wait > 0) {
                    Thread.sleep(wait);
                }
                lastRequestAt = System.currentTimeMillis();
                return fetchJson(url);
            }
        });
    }

    private JsonElement fetchJson(String url) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
            .timeout(TIMEOUT)
            .header("User-Agent", USER_AGENT)
            .header("Accept", "application/json")
            .GET()
            .build();

        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IOException("Nominatim API error: " + response.statusCode());
        }
        return JsonParser.parseString(response.body());
    }
}
