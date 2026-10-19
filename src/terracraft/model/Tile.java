package terracraft.model;

/** One decoded DEM tile placed at its grid position in the 3x3 stitch. */
public record Tile(double[][] elevation, int gridX, int gridY) {
}
