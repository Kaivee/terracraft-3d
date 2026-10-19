package terracraft.model;

/** A row from the terrain_cache table (internal representation). */
public record CachedTerrain(
    long id,
    String locationName,
    double lat,
    double lon,
    int zoomLevel,
    int gridSize,
    double[][] heightMatrix,
    double minElev,
    double maxElev,
    boolean hasWater,
    double autoWaterLevel,
    String createdAt
) {
}
