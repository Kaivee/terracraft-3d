package terracraft.web.handler;

import terracraft.model.Coordinate;
import terracraft.model.SearchResult;
import terracraft.service.TerrainService;
import terracraft.web.Handler;
import terracraft.web.Params;
import terracraft.web.Request;

/** GET /api/coords?lat=35.3628&lon=138.7308 */
public final class CoordsHandler implements Handler {

    private final TerrainService terrain;

    public CoordsHandler(TerrainService terrain) {
        this.terrain = terrain;
    }

    @Override
    public void handle(Request request) throws Exception {
        Double lat = Params.parseDouble(request.queryParam("lat"));
        Double lon = Params.parseDouble(request.queryParam("lon"));

        if (lat == null || lon == null || !Coordinate.isValid(lat, lon)) {
            request.error(400, "Invalid or out-of-range lat/lon parameters");
            return;
        }

        System.out.println("\nDirect Coordinate Search: (" + lat + ", " + lon + ")");
        SearchResult result = terrain.processCoordinates(lat, lon, null);
        request.json(200, result);
    }
}
