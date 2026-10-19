package terracraft.service;

import terracraft.model.CachedTerrain;
import terracraft.model.SearchResult;
import terracraft.model.TerrainMatrix;
import terracraft.model.WaterAnalysis;

/**
 * TerrainService — orchestrates cache lookups and DEM downloads.
 *
 * Port of the processCoordinates flow in routes/terrain.js: check the cache,
 * and on a miss download tiles, detect water, and persist the result.
 */
public final class TerrainService {

    public static final int ZOOM_LEVEL = 12;
    public static final int GRID_SIZE = 250;
    private static final double CACHE_TOLERANCE = 0.01;

    private final TerrainCache cache;
    private final TileDownloader downloader;

    public TerrainService(TerrainCache cache, TileDownloader downloader) {
        this.cache = cache;
        this.downloader = downloader;
    }

    /** Fetch elevation data by lat/lon, checking the cache first. */
    public SearchResult processCoordinates(double lat, double lon, String customLocationName) throws Exception {
        System.out.printf("  Coordinates: (%.4f, %.4f)%n", lat, lon);

        System.out.println("  Checking cache...");
        CachedTerrain cached = cache.findNear(lat, lon, CACHE_TOLERANCE);
        if (cached != null) {
            System.out.println("  Cache HIT (id=" + cached.id() + ")");
            return new SearchResult(
                cached.locationName(),
                cached.lat(),
                cached.lon(),
                cached.gridSize(),
                cached.heightMatrix(),
                cached.minElev(),
                cached.maxElev(),
                cached.hasWater(),
                cached.autoWaterLevel(),
                true,
                0
            );
        }

        System.out.println("  Cache MISS - downloading DEM tiles...");

        TerrainMatrix terrain = downloader.getElevationMatrix(lat, lon, ZOOM_LEVEL, GRID_SIZE);

        String displayName = (customLocationName != null && !customLocationName.isBlank())
            ? customLocationName
            : String.format("Coordinates (%.4f, %.4f)", lat, lon);

        // Analyze water once here, then persist it so future cache hits skip the scan.
        WaterAnalysis water = WaterDetector.analyze(terrain.matrix());
        cache.save(
            displayName, lat, lon, terrain.matrix(),
            terrain.minElev(), terrain.maxElev(), ZOOM_LEVEL, GRID_SIZE,
            water.hasWater(), water.autoWaterLevel()
        );

        System.out.println("  Done!");
        return new SearchResult(
            displayName,
            lat,
            lon,
            GRID_SIZE,
            terrain.matrix(),
            terrain.minElev(),
            terrain.maxElev(),
            water.hasWater(),
            water.autoWaterLevel(),
            false,
            terrain.failedTileCount()
        );
    }
}
