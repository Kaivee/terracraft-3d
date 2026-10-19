package terracraft.web.handler;

import java.util.List;

import terracraft.model.Suggestion;
import terracraft.service.NominatimClient;
import terracraft.web.Handler;
import terracraft.web.Request;

/** GET /api/suggest?q=shimla — up to 5 autocomplete suggestions. */
public final class SuggestHandler implements Handler {

    private static final int MAX_QUERY_LENGTH = 120;
    private static final int MAX_SUGGESTIONS = 5;

    private final NominatimClient nominatim;

    public SuggestHandler(NominatimClient nominatim) {
        this.nominatim = nominatim;
    }

    @Override
    public void handle(Request request) throws Exception {
        String query = request.queryParam("q");
        query = query == null ? "" : query.trim();

        if (query.isEmpty() || query.length() > MAX_QUERY_LENGTH) {
            request.json(200, List.of());
            return;
        }

        List<Suggestion> suggestions = nominatim.searchSuggestions(query, MAX_SUGGESTIONS);
        request.json(200, suggestions);
    }
}
