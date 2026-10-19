package terracraft.model;

/** One autocomplete suggestion (serialized to JSON with these exact names). */
public class Suggestion {
    public String name;
    public String region;
    public String icon;
    public double lat;
    public double lon;

    public Suggestion(String name, String region, String icon, double lat, double lon) {
        this.name = name;
        this.region = region;
        this.icon = icon;
        this.lat = lat;
        this.lon = lon;
    }
}
