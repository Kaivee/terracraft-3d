package terracraft.service;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;

import javax.imageio.ImageIO;

import terracraft.model.TerrainMatrix;
import terracraft.model.Tile;

/**
 * TileDownloader — DEM elevation tile fetching.
 *
 * Downloads Mapzen Terrarium tiles from AWS S3 and decodes RGB to elevation.
 * Hardened with request timeouts, retries with backoff, and a concurrency limit
 * so a slow tile never stalls the whole map. Port of services/tileDownloader.js.
 */
public final class TileDownloader {

    private static final String TILE_URL_TEMPLATE = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium";
    private static final Duration TIMEOUT = Duration.ofSeconds(15);
    private static final int MAX_RETRIES = 2;
    private static final int MAX_CONCURRENCY = 3;

    private final HttpClient http = HttpClient.newBuilder()
        .connectTimeout(TIMEOUT)
        .build();

    /**
     * Fetch a gridSize x gridSize elevation matrix for a location by downloading
     * a 3x3 block of tiles centered on it, stitching, and downsampling.
     */
    public TerrainMatrix getElevationMatrix(double lat, double lon, int zoom, int gridSize) throws Exception {
        int centerX = TileMath.lon2tile(lon, zoom);
        int centerY = TileMath.lat2tile(lat, zoom);

        System.out.println("  Tile center: z=" + zoom + ", x=" + centerX + ", y=" + centerY);

        List<int[]> specs = new ArrayList<>();
        for (int dy = -1; dy <= 1; dy++) {
            for (int dx = -1; dx <= 1; dx++) {
                specs.add(new int[] { centerX + dx, centerY + dy, dx + 1, dy + 1 });
            }
        }

        System.out.println("  Downloading 9 tiles (concurrency 3)...");
        AtomicInteger failed = new AtomicInteger(0);

        ExecutorService pool = Executors.newFixedThreadPool(MAX_CONCURRENCY);
        List<Future<Tile>> futures = new ArrayList<>();
        try {
            for (int[] spec : specs) {
                final int tileX = spec[0];
                final int tileY = spec[1];
                final int gridX = spec[2];
                final int gridY = spec[3];
                futures.add(pool.submit(() -> fetchTileWithFallback(zoom, tileX, tileY, gridX, gridY, failed)));
            }

            List<Tile> tiles = new ArrayList<>();
            for (Future<Tile> future : futures) {
                tiles.add(future.get());
            }

            System.out.println("  Tiles downloaded, stitching...");
            double[][] stitched = TileMath.stitchTiles(tiles, 3, 3);

            System.out.println("  Downsampling to " + gridSize + "x" + gridSize + "...");
            double[][] matrix = TileMath.downsample(stitched, gridSize, gridSize);

            double minElev = Double.POSITIVE_INFINITY;
            double maxElev = Double.NEGATIVE_INFINITY;
            for (double[] row : matrix) {
                for (double value : row) {
                    if (value < minElev) minElev = value;
                    if (value > maxElev) maxElev = value;
                }
            }

            System.out.printf("  Elevation range: %.1fm - %.1fm%n", minElev, maxElev);
            return new TerrainMatrix(matrix, minElev, maxElev, failed.get());
        } finally {
            pool.shutdownNow();
        }
    }

    private Tile fetchTileWithFallback(int zoom, int tileX, int tileY, int gridX, int gridY, AtomicInteger failed) {
        try {
            double[][] elevation = downloadTile(zoom, tileX, tileY);
            return new Tile(elevation, gridX, gridY);
        } catch (Exception err) {
            failed.incrementAndGet();
            int zoom1X = Math.floorDiv(tileX, 2);
            int zoom1Y = Math.floorDiv(tileY, 2);
            try {
                double[][] low = downloadTile(zoom - 1, zoom1X, zoom1Y);
                double[][] elevation = TileMath.upscale2x(low);
                System.out.println("  Warning: tile " + zoom + "/" + tileX + "/" + tileY + " failed ("
                    + err.getMessage() + "); using zoom-1 fallback " + (zoom - 1) + "/" + zoom1X + "/" + zoom1Y);
                return new Tile(elevation, gridX, gridY);
            } catch (Exception fallbackErr) {
                System.out.println("  Warning: tile " + zoom + "/" + tileX + "/" + tileY + " failed ("
                    + err.getMessage() + "); zoom-1 fallback also failed (" + fallbackErr.getMessage()
                    + "); zero-filling");
                return new Tile(new double[TileMath.TILE_SIZE][TileMath.TILE_SIZE], gridX, gridY);
            }
        }
    }

    /** Download a single Terrarium tile and decode it to elevation. */
    private double[][] downloadTile(int z, int x, int y) throws Exception {
        String url = TILE_URL_TEMPLATE + "/" + z + "/" + x + "/" + y + ".png";
        byte[] bytes = fetchBytes(url);

        BufferedImage image = ImageIO.read(new ByteArrayInputStream(bytes));
        if (image == null) {
            throw new IOException("Not a valid image");
        }
        int width = image.getWidth();
        int height = image.getHeight();
        int[] pixels = image.getRGB(0, 0, width, height, null, 0, width);
        return TileMath.decodeTileElevation(pixels, width, height);
    }

    /** Fetch a URL to bytes with a hard timeout and retries with backoff. */
    private byte[] fetchBytes(String url) throws Exception {
        IOException lastError = null;
        for (int attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                    .timeout(TIMEOUT)
                    .GET()
                    .build();
                HttpResponse<byte[]> response = http.send(request, HttpResponse.BodyHandlers.ofByteArray());
                if (response.statusCode() < 200 || response.statusCode() >= 300) {
                    throw new IOException("HTTP " + response.statusCode());
                }
                return response.body();
            } catch (IOException e) {
                lastError = e;
                if (attempt < MAX_RETRIES) {
                    Thread.sleep(500L * (attempt + 1));
                }
            }
        }
        throw lastError;
    }
}
