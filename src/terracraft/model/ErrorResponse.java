package terracraft.model;

/** Standard error payload: { "error": "message" }. */
public class ErrorResponse {
    public String error;

    public ErrorResponse(String error) {
        this.error = error;
    }
}
