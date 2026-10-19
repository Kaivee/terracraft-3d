package terracraft.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

import terracraft.model.WaterAnalysis;

/** Unit tests for water detection (port of the analyzeWater cases in terrain.test.js). */
class WaterDetectorTest {

    @Test
    void flagsLargeFlatAreasAsWater() {
        double[][] matrix = new double[250][250];
        for (int r = 0; r < 250; r++) {
            for (int c = 0; c < 250; c++) {
                matrix[r][c] = c < 125 ? 1 : 5 + (r * c) % 20;
            }
        }

        WaterAnalysis analysis = WaterDetector.analyze(matrix);
        assertTrue(analysis.hasWater());
        assertEquals(1.0, analysis.autoWaterLevel(), 1e-9);
    }

    @Test
    void ignoresSmallFlatAreas() {
        double[][] matrix = new double[100][100];
        for (int r = 0; r < 100; r++) {
            for (int c = 0; c < 100; c++) {
                matrix[r][c] = r < 1 ? 3 : 10 + (r + c) % 30;
            }
        }

        WaterAnalysis analysis = WaterDetector.analyze(matrix);
        assertFalse(analysis.hasWater());
    }
}
