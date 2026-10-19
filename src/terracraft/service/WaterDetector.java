package terracraft.service;

import java.util.HashMap;
import java.util.Map;

import terracraft.model.WaterAnalysis;

/**
 * WaterDetector — detect large flat bodies of water in an elevation matrix.
 *
 * Finds the most frequent elevation (mode) and flags it as water when it covers
 * more than ~4.5% of the map. Port of services/waterDetect.js.
 */
public final class WaterDetector {

    private static final double WATER_FRACTION = 0.045;

    private WaterDetector() {
    }

    public static WaterAnalysis analyze(double[][] matrix) {
        Map<Long, Integer> counts = new HashMap<>();
        long total = 0;

        for (double[] row : matrix) {
            for (double value : row) {
                long key = Math.round(value); // round to nearest meter
                counts.merge(key, 1, Integer::sum);
                total++;
            }
        }

        long maxCount = 0;
        long modeElevation = 0;
        for (Map.Entry<Long, Integer> entry : counts.entrySet()) {
            if (entry.getValue() > maxCount) {
                maxCount = entry.getValue();
                modeElevation = entry.getKey();
            }
        }

        boolean hasWater = maxCount > total * WATER_FRACTION;
        return new WaterAnalysis(hasWater, hasWater ? modeElevation : 0);
    }
}
