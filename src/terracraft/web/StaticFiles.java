package terracraft.web;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

/**
 * StaticFiles — serves the frontend from a directory.
 *
 * Unknown paths fall back to index.html (SPA behaviour), and path traversal
 * outside the public root is rejected.
 */
public final class StaticFiles implements HttpHandler {

    private final Path root;

    public StaticFiles(String publicDir) {
        this.root = Path.of(publicDir).toAbsolutePath().normalize();
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        String method = exchange.getRequestMethod();
        if (!method.equals("GET") && !method.equals("HEAD")) {
            exchange.sendResponseHeaders(405, -1);
            exchange.close();
            return;
        }

        String uriPath = exchange.getRequestURI().getPath();
        if (uriPath.equals("/")) {
            uriPath = "/index.html";
        }

        Path file = root.resolve(uriPath.substring(1)).normalize();
        if (!file.startsWith(root)) {
            exchange.sendResponseHeaders(403, -1);
            exchange.close();
            return;
        }
        if (!Files.isRegularFile(file)) {
            file = root.resolve("index.html");
        }

        byte[] bytes = Files.readAllBytes(file);
        exchange.getResponseHeaders().set("Content-Type", contentType(file.getFileName().toString()));

        if (method.equals("HEAD")) {
            exchange.sendResponseHeaders(200, -1);
            exchange.close();
            return;
        }

        exchange.sendResponseHeaders(200, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        } finally {
            exchange.close();
        }
    }

    private static String contentType(String name) {
        String lower = name.toLowerCase();
        if (lower.endsWith(".html")) return "text/html; charset=utf-8";
        if (lower.endsWith(".css")) return "text/css; charset=utf-8";
        if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "text/javascript; charset=utf-8";
        if (lower.endsWith(".json")) return "application/json; charset=utf-8";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".gif")) return "image/gif";
        if (lower.endsWith(".ico")) return "image/x-icon";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".woff2")) return "font/woff2";
        if (lower.endsWith(".woff")) return "font/woff";
        if (lower.endsWith(".map")) return "application/json; charset=utf-8";
        return "application/octet-stream";
    }
}
