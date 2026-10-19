package terracraft.service;

import java.util.List;

import terracraft.model.Tile;

/**
 * TileMath — pure terrain math (no I/O).
 *
 * Direct port of the JavaScript services/tileMath.js. Kept free of networking
 * and image decoding so it can be unit tested in isolation.
 */
public final class TileMath {

    public static final int TILE_SIZE = 256;

    // Web Mercator latitude limit — beyond this tan() diverges.
    private static final double MAX_MERCATOR_LAT = 85.05112878;

    private TileMath() {
    }

    /** Convert latitude to tile Y coordinate (Slippy Map convention). */
    public static int lat2tile(double lat, int zoom) {
        double clamped = Math.max(-MAX_MERCATOR_LAT, Math.min(MAX_MERCATOR_LAT, lat));
        double latRad = clamped * Math.PI / 180.0;
        return (int) Math.floor(
            ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2)
                * Math.pow(2, zoom)
        );
    }

    /** Convert longitude to tile X coordinate. */
    public static int lon2tile(double lon, int zoom) {
        return (int) Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
    }

    /**
     * Decode a single pixel into elevation (meters).
     * Terrarium formula: height = (R * 256 + G + B / 256) - 32768
     */
    public static double decodeElevation(int r, int g, int b) {
        return r * 256 + g + b / 256.0 - 32768;
    }

    /**
     * Decode a tile's ARGB pixels (as returned by BufferedImage.getRGB) into a
     * 2D elevation array [row][col].
     */
    public static double[][] decodeTileElevation(int[] argb, int width, int height) {
        double[][] elevation = new double[height][width];
        for (int row = 0; row < height; row++) {
            for (int col = 0; col < width; col++) {
                int argbValue = argb[row * width + col];
                int r = (argbValue >> 16) & 0xFF;
                int g = (argbValue >> 8) & 0xFF;
                int b = argbValue & 0xFF;
                elevation[row][col] = decodeElevation(r, g, b);
            }
        }
        return elevation;
    }

    /**
     * Stitch a grid of tiles into a single large elevation array.
     *
     * @param tiles      decoded tiles with their grid positions
     * @param gridWidth  number of tiles horizontally
     * @param gridHeight number of tiles vertically
     */
    public static double[][] stitchTiles(List<Tile> tiles, int gridWidth, int gridHeight) {
        int totalWidth = gridWidth * TILE_SIZE;
        int totalHeight = gridHeight * TILE_SIZE;
        double[][] stitched = new double[totalHeight][totalWidth];

        for (Tile tile : tiles) {
            int offsetX = tile.gridX() * TILE_SIZE;
            int offsetY = tile.gridY() * TILE_SIZE;
            double[][] elevation = tile.elevation();
            for (int row = 0; row < TILE_SIZE; row++) {
                for (int col = 0; col < TILE_SIZE; col++) {
                    stitched[offsetY + row][offsetX + col] = elevation[row][col];
                }
            }
        }
        return stitched;
    }

    /** Bilinear downsample a 2D array to target dimensions. */
    public static double[][] downsample(double[][] source, int targetWidth, int targetHeight) {
        int srcHeight = source.length;
        int srcWidth = source[0].length;
        double[][] result = new double[targetHeight][targetWidth];

        for (int ty = 0; ty < targetHeight; ty++) {
            for (int tx = 0; tx < targetWidth; tx++) {
                double sx = (double) tx / targetWidth * srcWidth;
                double sy = (double) ty / targetHeight * srcHeight;

                int x0 = (int) Math.floor(sx);
                int y0 = (int) Math.floor(sy);
                int x1 = Math.min(x0 + 1, srcWidth - 1);
                int y1 = Math.min(y0 + 1, srcHeight - 1);
                double fx = sx - x0;
                double fy = sy - y0;

                double v00 = source[y0][x0];
                double v10 = source[y0][x1];
                double v01 = source[y1][x0];
                double v11 = source[y1][x1];

                double value = v00 * (1 - fx) * (1 - fy)
                    + v10 * fx * (1 - fy)
                    + v01 * (1 - fx) * fy
                    + v11 * fx * fy;

                result[ty][tx] = Math.round(value * 100) / 100.0; // 2 decimal places
            }
        }
        return result;
    }

    /**
     * 2x nearest-neighbor upscale: each source pixel becomes a 2x2 block.
     * Handles any rectangular array. Empty input returns an empty array.
     */
    public static double[][] upscale2x(double[][] elevation) {
        if (elevation == null || elevation.length == 0) {
            return new double[0][0];
        }
        int rows = elevation.length;
        int cols = elevation[0].length;
        double[][] result = new double[rows * 2][cols * 2];
        for (int row = 0; row < rows; row++) {
            double[] srcRow = elevation[row];
            for (int col = 0; col < cols; col++) {
                double value = srcRow[col];
                int o = col * 2;
                result[row * 2][o] = value;
                result[row * 2][o + 1] = value;
                result[row * 2 + 1][o] = value;
                result[row * 2 + 1][o + 1] = value;
            }
        }
        return result;
    }
}
