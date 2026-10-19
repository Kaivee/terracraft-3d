package terracraft.model;

/** A square grid of elevations plus its summary stats. */
public record TerrainMatrix(double[][] matrix, double minElev, double maxElev, int failedTileCount) {
}
