package terracraft.model;

/** Result of scanning a terrain matrix for a large flat water body. */
public record WaterAnalysis(boolean hasWater, double autoWaterLevel) {
}
