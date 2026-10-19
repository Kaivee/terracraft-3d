package terracraft.service;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

import terracraft.db.Database;
import terracraft.model.CachedTerrain;

/**
 * TerrainCache — SQLite CRUD for cached terrain matrices.
 *
 * Uses a bounding-box range query so the (latitude, longitude) index is used,
 * and stores matrices as gzip-compressed Float32 blobs. Methods are
 * synchronized because the underlying JDBC connection is shared.
 */
public final class TerrainCache {

    private static final String SELECT_COLUMNS =
        "id, location_name, latitude, longitude, zoom_level, grid_size, "
        + "height_matrix, min_elevation, max_elevation, has_water, auto_water_level, created_at";

    /**
     * Find cached terrain near a coordinate within a tolerance
     * (~0.01 degrees, about 1.1km). Returns null when nothing matches.
     */
    public synchronized CachedTerrain findNear(double lat, double lon, double tolerance) throws SQLException {
        String sql =
            "SELECT " + SELECT_COLUMNS + " FROM terrain_cache "
            + "WHERE latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ? "
            + "ORDER BY created_at DESC LIMIT 1";

        try (PreparedStatement ps = Database.connection().prepareStatement(sql)) {
            ps.setDouble(1, lat - tolerance);
            ps.setDouble(2, lat + tolerance);
            ps.setDouble(3, lon - tolerance);
            ps.setDouble(4, lon + tolerance);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? mapRow(rs) : null;
            }
        }
    }

    /** Insert a terrain record and return its generated id. */
    public synchronized long save(
        String locationName,
        double lat,
        double lon,
        double[][] matrix,
        double minElev,
        double maxElev,
        int zoom,
        int gridSize,
        boolean hasWater,
        double autoWaterLevel
    ) throws SQLException {
        byte[] compressed = MatrixCodec.encode(matrix);

        String sql =
            "INSERT INTO terrain_cache "
            + "(location_name, latitude, longitude, zoom_level, grid_size, height_matrix, "
            + "min_elevation, max_elevation, has_water, auto_water_level) "
            + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

        try (PreparedStatement ps = Database.connection().prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, locationName);
            ps.setDouble(2, lat);
            ps.setDouble(3, lon);
            ps.setInt(4, zoom);
            ps.setInt(5, gridSize);
            ps.setBytes(6, compressed);
            ps.setDouble(7, minElev);
            ps.setDouble(8, maxElev);
            ps.setInt(9, hasWater ? 1 : 0);
            ps.setDouble(10, autoWaterLevel);
            ps.executeUpdate();

            try (ResultSet keys = ps.getGeneratedKeys()) {
                long id = keys.next() ? keys.getLong(1) : -1;
                System.out.println("  Cached terrain for \"" + locationName + "\" (id=" + id
                    + ", size=" + compressed.length + " bytes)");
                return id;
            }
        }
    }

    /** Fetch a cached terrain record by id, or null. */
    public synchronized CachedTerrain getById(long id) throws SQLException {
        String sql = "SELECT " + SELECT_COLUMNS + " FROM terrain_cache WHERE id = ?";
        try (PreparedStatement ps = Database.connection().prepareStatement(sql)) {
            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? mapRow(rs) : null;
            }
        }
    }

    private CachedTerrain mapRow(ResultSet rs) throws SQLException {
        int gridSize = rs.getInt("grid_size");
        double[][] matrix = MatrixCodec.decode(rs.getBytes("height_matrix"), gridSize);
        return new CachedTerrain(
            rs.getLong("id"),
            rs.getString("location_name"),
            rs.getDouble("latitude"),
            rs.getDouble("longitude"),
            rs.getInt("zoom_level"),
            gridSize,
            matrix,
            rs.getDouble("min_elevation"),
            rs.getDouble("max_elevation"),
            rs.getInt("has_water") != 0,
            rs.getDouble("auto_water_level"),
            rs.getString("created_at")
        );
    }
}
