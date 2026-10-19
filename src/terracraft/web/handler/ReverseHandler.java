package terracraft.web.handler;

import terracraft.model.Coordinate;
import terracraft.model.NameResponse;
import terracraft.service.NominatimClient;
import terracraft.web.Handler;
import terracraft.web.Params;
import terracraft.web.Request;

/** GET /api/reverse?lat=35.36&lon=138.72 — reverse-geocode to a short name. */
public final class ReverseHandler implements Handler {

    private final NominatimClient nominatim;

    public ReverseHandler(NominatimClient nominatim) {
        this.nominatim = nominatim;
    }

    @Override
    public void handle(Request request) throws Exception {
        Double lat = Params.parseDouble(request.queryParam("lat"));
        Double lon = Params.parseDouble(request.queryParam("lon"));

        if (lat == null || lon == null || !Coordinate.isValid(lat, lon)) {
            request.error(400, "Invalid coordinates");
            return;
        }

        try {
            String name = nominatim.reverseGeocode(lat, lon);
            request.json(200, new NameResponse(name));
        } catch (Exception e) {
            request.error(502, "Reverse geocoding failed");
        }
    }
}
