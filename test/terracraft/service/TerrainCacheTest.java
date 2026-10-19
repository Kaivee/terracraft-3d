package terracraft.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import terracraft.db.Database;
import terracraft.model.CachedTerrain;

/** Integration tests for the SQLite terrain cache (port of tests/terrainCache.test.js). */
class TerrainCacheTest {

    private static final double EPS = 1e-4;
    private static final TerrainCache cache = new TerrainCache();

    @BeforeAll
    static void initDatabase() {
        Database.init(":memory:");
    }

    @Test
    void saveAndGetByIdRoundTripMatrixAndMetadata() throws Exception {
        double[][] matrix = {
            {1, 2},
            {3, 4},
        };

        long id = cache.save("Test Peak", 10.1234, 20.5678, matrix, 1, 4, 12, 2, true, 2);
        CachedTerrain record = cache.getById(id);

        assertNotNull(record);
        assertEquals("Test Peak", record.locationName());
        assertEquals(1.0, record.heightMatrix()[0][0], EPS);
        assertEquals(2.0, record.heightMatrix()[0][1], EPS);
        assertEquals(3.0, record.heightMatrix()[1][0], EPS);
        assertEquals(4.0, record.heightMatrix()[1][1], EPS);
        assertEquals(1.0, record.minElev(), EPS);
        assertEquals(4.0, record.maxElev(), EPS);
        assertTrue(record.hasWater());
        assertEquals(2.0, record.autoWaterLevel(), EPS);
    }

    @Test
    void getByIdReturnsNullForUnknownIds() throws Exception {
        assertNull(cache.getById(999_999));
    }

    @Test
    void findNearMatchesNearbyCoordinatesAndMissesDistantOnes() throws Exception {
        double[][] matrix = {
            {10, 20},
            {30, 40},
        };
        cache.save("Spot", -5, 100, matrix, 10, 40, 12, 2, false, 0);

        CachedTerrain hit = cache.findNear(-5.005, 100.004, 0.01);
        assertNotNull(hit);
        assertEquals("Spot", hit.locationName());

        assertNull(cache.findNear(-5.5, 100, 0.01));
        assertNull(cache.findNear(-5, 100.5, 0.01));
    }
}
