package terracraft.web.handler;

import terracraft.model.CacheResponse;
import terracraft.model.CachedTerrain;
import terracraft.service.TerrainCache;
import terracraft.web.Handler;
import terracraft.web.Request;

/** GET /api/cache/{id} — retrieve a cached terrain record by id. */
public final class CacheHandler implements Handler {

    private static final String PREFIX = "/api/cache/";

    private final TerrainCache cache;

    public CacheHandler(TerrainCache cache) {
        this.cache = cache;
    }

    @Override
    public void handle(Request request) throws Exception {
        String idPart = request.path().substring(PREFIX.length());

        long id;
        try {
            id = Long.parseLong(idPart);
        } catch (NumberFormatException e) {
            request.error(400, "Invalid cache id");
            return;
        }
        if (id <= 0) {
            request.error(400, "Invalid cache id");
            return;
        }

        CachedTerrain record = cache.getById(id);
        if (record == null) {
            request.error(404, "Cached terrain not found");
            return;
        }

        request.json(200, new CacheResponse(record));
    }
}
