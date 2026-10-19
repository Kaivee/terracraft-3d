package terracraft.web;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.util.concurrent.Executors;

import com.sun.net.httpserver.HttpServer;

import terracraft.service.NominatimClient;
import terracraft.service.TerrainCache;
import terracraft.service.TerrainService;
import terracraft.service.TileDownloader;
import terracraft.web.handler.CacheHandler;
import terracraft.web.handler.CoordsHandler;
import terracraft.web.handler.ReverseHandler;
import terracraft.web.handler.SearchHandler;
import terracraft.web.handler.SuggestHandler;

/**
 * Server — wires services, routes and static files into a JDK HttpServer.
 *
 * Rate limits protect the Nominatim-backed endpoints from abuse, matching the
 * Express middleware configuration.
 */
public final class Server {

    private final int port;
    private final String publicDir;
    private final Router router = new Router();
    private HttpServer server;

    public Server(int port, String publicDir) {
        this.port = port;
        this.publicDir = publicDir;
    }

    public void start() throws IOException {
        TerrainCache cache = new TerrainCache();
        TileDownloader downloader = new TileDownloader();
        TerrainService terrainService = new TerrainService(cache, downloader);
        NominatimClient nominatim = new NominatimClient();

        router.add("GET", "/api/search", new SearchHandler(nominatim, terrainService), new RateLimiter(60_000, 30));
        router.add("GET", "/api/coords", new CoordsHandler(terrainService), new RateLimiter(60_000, 30));
        router.add("GET", "/api/suggest", new SuggestHandler(nominatim), new RateLimiter(60_000, 60));
        router.add("GET", "/api/reverse", new ReverseHandler(nominatim));
        router.addPrefix("GET", "/api/cache/", new CacheHandler(cache));

        server = HttpServer.create(new InetSocketAddress(port), 0);
        server.setExecutor(Executors.newFixedThreadPool(16));
        server.createContext("/api/", router::dispatch);
        server.createContext("/", new StaticFiles(publicDir));
        server.start();
    }

    public void stop() {
        if (server != null) {
            server.stop(0);
        }
    }
}
