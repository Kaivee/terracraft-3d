package terracraft.web.handler;

import terracraft.model.Location;
import terracraft.model.SearchResult;
import terracraft.service.NominatimClient;
import terracraft.service.TerrainService;
import terracraft.web.Handler;
import terracraft.web.Params;
import terracraft.web.Request;

/** GET /api/search?q=Mount Fuji */
public final class SearchHandler implements Handler {

    private static final int MAX_QUERY_LENGTH = 120;

    private final NominatimClient nominatim;
    private final TerrainService terrain;

    public SearchHandler(NominatimClient nominatim, TerrainService terrain) {
        this.nominatim = nominatim;
        this.terrain = terrain;
    }

    @Override
    public void handle(Request request) throws Exception {
        String query = request.queryParam("q");
        query = query == null ? "" : query.trim();

        if (query.isEmpty()) {
            request.error(400, "Missing query parameter \"q\"");
            return;
        }
        if (query.length() > MAX_QUERY_LENGTH) {
            request.error(400, "Query too long (max " + MAX_QUERY_LENGTH + " characters)");
            return;
        }

        System.out.println("\nSearching: \"" + query + "\"");
        Location geo = nominatim.geocode(query);
        System.out.println("  Found: " + geo.name());

        SearchResult result = terrain.processCoordinates(geo.lat(), geo.lon(), geo.name());
        request.json(200, result);
    }
}
