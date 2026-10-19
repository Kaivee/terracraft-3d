package terracraft.model;

/** A named geographic place (geocoding result). */
public record Location(String name, double lat, double lon) {

    public Coordinate coordinate() {
        return new Coordinate(lat, lon);
    }
}
