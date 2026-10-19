package terracraft.service;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;

import org.junit.jupiter.api.Test;

import terracraft.model.Tile;

/** Unit tests for the pure terrain math (port of tests/tileMath.test.js + terrain.test.js). */
class TileMathTest {

    private static final double EPS = 1e-9;

    @Test
    void decodeElevationDecodesTerrariumRgbToMeters() {
        assertEquals(0.0, TileMath.decodeElevation(128, 0, 0), EPS);
        assertEquals(256.0, TileMath.decodeElevation(129, 0, 0), EPS);
        assertTrue(Math.abs(TileMath.decodeElevation(128, 0, 255) - (255.0 / 256.0)) < 0.01);
        assertEquals(-0.00390625, TileMath.decodeElevation(127, 255, 255), EPS);
    }

    @Test
    void lon2tileFollowsSlippyMapConvention() {
        assertEquals(0, TileMath.lon2tile(0, 0));
        assertEquals(0, TileMath.lon2tile(-180, 0));
        assertEquals(1, TileMath.lon2tile(0, 1));
        assertEquals(1, TileMath.lon2tile(90, 1));
        assertEquals(1, TileMath.lon2tile(179, 1));
    }

    @Test
    void lat2tileMapsEquatorToMiddleOfTileRange() {
        assertEquals(0, TileMath.lat2tile(0, 0));
        assertEquals(1, TileMath.lat2tile(0, 1));
        assertEquals(0, TileMath.lat2tile(85, 1));
        assertEquals(1, TileMath.lat2tile(-85, 1));
    }

    @Test
    void decodeTileElevationDecodesRows() {
        int[] argb = {
            (128 << 16),
            (129 << 16),
            (128 << 16) | 255,
            (127 << 16) | (255 << 8) | 255,
        };
        double[][] grid = TileMath.decodeTileElevation(argb, 4, 1);

        assertEquals(1, grid.length);
        assertEquals(0.0, grid[0][0], EPS);
        assertEquals(256.0, grid[0][1], EPS);
        assertTrue(Math.abs(grid[0][2] - (255.0 / 256.0)) < 0.01);
        assertEquals(-0.00390625, grid[0][3], EPS);
    }

    @Test
    void stitchTilesPlacesTilesAtGridCoordinates() {
        List<Tile> tiles = List.of(
            new Tile(filledTile(1), 0, 0),
            new Tile(filledTile(2), 1, 0),
            new Tile(filledTile(3), 0, 1),
            new Tile(filledTile(4), 1, 1)
        );
        double[][] stitched = TileMath.stitchTiles(tiles, 2, 2);

        assertEquals(512, stitched.length);
        assertEquals(512, stitched[0].length);
        assertEquals(1.0, stitched[0][0], EPS);
        assertEquals(2.0, stitched[0][300], EPS);
        assertEquals(3.0, stitched[300][0], EPS);
        assertEquals(4.0, stitched[300][300], EPS);
    }

    @Test
    void downsampleBilinearlySamplesCorners() {
        double[][] source = {
            {0, 10},
            {20, 30},
        };
        double[][] big = TileMath.downsample(source, 4, 4);

        assertEquals(4, big.length);
        assertEquals(4, big[0].length);
        assertEquals(15.0, big[1][1], EPS);
        assertEquals(0.0, big[0][0], EPS);
        assertEquals(30.0, big[3][3], EPS);
    }

    @Test
    void downsampleMapsEdgesWithoutOverruns() {
        double[][] source = filledTile(7);
        double[][] small = TileMath.downsample(source, 250, 250);

        assertEquals(250, small.length);
        assertEquals(7.0, small[249][249], EPS);
    }

    @Test
    void upscale2xMaps1x1To2x2Copy() {
        double[][] out = TileMath.upscale2x(new double[][] {{7}});
        assertArrayEquals(new double[][] {{7, 7}, {7, 7}}, out);
    }

    @Test
    void upscale2xReplicatesBlocks() {
        double[][] out = TileMath.upscale2x(new double[][] {{1, 2}, {3, 4}});
        assertArrayEquals(
            new double[][] {
                {1, 1, 2, 2},
                {1, 1, 2, 2},
                {3, 3, 4, 4},
                {3, 3, 4, 4},
            },
            out
        );
    }

    @Test
    void upscale2xHandlesRectangularInput() {
        double[][] out = TileMath.upscale2x(new double[][] {{1, 2, 3}, {4, 5, 6}});
        assertEquals(4, out.length);
        assertEquals(6, out[0].length);
        assertArrayEquals(
            new double[][] {
                {1, 1, 2, 2, 3, 3},
                {1, 1, 2, 2, 3, 3},
                {4, 4, 5, 5, 6, 6},
                {4, 4, 5, 5, 6, 6},
            },
            out
        );
    }

    @Test
    void upscale2xEmptyInputReturnsEmptyArray() {
        assertEquals(0, TileMath.upscale2x(new double[0][0]).length);
    }

    private static double[][] filledTile(double value) {
        double[][] tile = new double[TileMath.TILE_SIZE][TileMath.TILE_SIZE];
        for (double[] row : tile) {
            java.util.Arrays.fill(row, value);
        }
        return tile;
    }
}
