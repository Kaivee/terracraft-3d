package terracraft.web;

/** Small parsing helpers shared by handlers. */
public final class Params {

    private Params() {
    }

    /** Parse a query parameter as a double, or null when absent/invalid. */
    public static Double parseDouble(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Double.parseDouble(value.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
