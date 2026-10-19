package terracraft.web;

/** A route handler that may throw; the router maps failures to HTTP 500. */
@FunctionalInterface
public interface Handler {
    void handle(Request request) throws Exception;
}
