package terracraft.config;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Env — minimal .env loader.
 *
 * Values from the real process environment take precedence over the .env file,
 * matching dotenv's behaviour. Quotes around values are stripped.
 */
public final class Env {

    private static final Map<String, String> FILE_VALUES = new HashMap<>();

    private Env() {
    }

    /** Read KEY=VALUE lines from a file, ignoring blank lines and # comments. */
    public static void load(String file) {
        Path path = Path.of(file);
        if (!Files.isRegularFile(path)) {
            return;
        }
        try {
            List<String> lines = Files.readAllLines(path, StandardCharsets.UTF_8);
            for (String line : lines) {
                String trimmed = line.trim();
                if (trimmed.isEmpty() || trimmed.startsWith("#")) {
                    continue;
                }
                int eq = trimmed.indexOf('=');
                if (eq < 0) {
                    continue;
                }
                String key = trimmed.substring(0, eq).trim();
                String value = stripQuotes(trimmed.substring(eq + 1).trim());
                FILE_VALUES.putIfAbsent(key, value);
            }
        } catch (IOException e) {
            System.err.println("Could not read env file " + file + ": " + e.getMessage());
        }
    }

    private static String stripQuotes(String value) {
        if (value.length() >= 2) {
            char first = value.charAt(0);
            char last = value.charAt(value.length() - 1);
            if ((first == '"' && last == '"') || (first == '\'' && last == '\'')) {
                return value.substring(1, value.length() - 1);
            }
        }
        return value;
    }

    public static String get(String key, String fallback) {
        String fromEnv = System.getenv(key);
        if (fromEnv != null && !fromEnv.isBlank()) {
            return fromEnv;
        }
        String fromFile = FILE_VALUES.get(key);
        return (fromFile == null || fromFile.isBlank()) ? fallback : fromFile;
    }

    public static int getInt(String key, int fallback) {
        try {
            return Integer.parseInt(get(key, String.valueOf(fallback)));
        } catch (NumberFormatException e) {
            return fallback;
        }
    }
}
