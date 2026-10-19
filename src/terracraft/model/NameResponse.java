package terracraft.model;

/** Response payload for /api/reverse: { "name": "..." }. */
public class NameResponse {
    public String name;

    public NameResponse(String name) {
        this.name = name;
    }
}
