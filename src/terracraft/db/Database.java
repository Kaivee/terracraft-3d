package terracraft.db;

import java.io.File;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;

/**
 * Database — owns the single SQLite connection and the schema.
 *
 * The terrain cache is a single-file SQLite database, so no external server is
 * required. Access is synchronized because a single JDBC connection is shared.
 */
public final class Database {

    private static Connection connection;

    private Database() {
    }

    /** Open the database and create the schema if it does not exist yet. */
    public static synchronized void init(String path) {
        try {
            Class.forName("org.sqlite.JDBC");

            String jdbcPath = path;
            if (!":memory:".equals(path)) {
                File file = new File(path).getAbsoluteFile();
                File parent = file.getParentFile();
                if (parent != null) {
                    parent.mkdirs();
                }
                jdbcPath = file.getPath();
            }

            connection = DriverManager.getConnection("jdbc:sqlite:" + jdbcPath);
            try (Statement st = connection.createStatement()) {
                st.execute("PRAGMA journal_mode = WAL");
                st.execute("PRAGMA synchronous = NORMAL");
                st.execute("""
                    CREATE TABLE IF NOT EXISTS terrain_cache (
                      id               INTEGER PRIMARY KEY AUTOINCREMENT,
                      location_name    TEXT    NOT NULL,
                      latitude         REAL    NOT NULL,
                      longitude        REAL    NOT NULL,
                      zoom_level       INTEGER NOT NULL DEFAULT 12,
                      grid_size        INTEGER NOT NULL DEFAULT 250,
                      height_matrix    BLOB    NOT NULL,
                      min_elevation    REAL,
                      max_elevation    REAL,
                      has_water        INTEGER NOT NULL DEFAULT 0,
                      auto_water_level REAL    NOT NULL DEFAULT 0,
                      created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
                    )
                    """);
                st.execute("CREATE INDEX IF NOT EXISTS idx_coords ON terrain_cache (latitude, longitude)");
                st.execute("CREATE INDEX IF NOT EXISTS idx_name ON terrain_cache (location_name)");
                st.execute("CREATE INDEX IF NOT EXISTS idx_created ON terrain_cache (created_at DESC)");
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to initialize database: " + e.getMessage(), e);
        }
    }

    public static synchronized Connection connection() {
        if (connection == null) {
            throw new IllegalStateException("Database has not been initialized");
        }
        return connection;
    }

    public static synchronized void close() {
        if (connection != null) {
            try {
                connection.close();
            } catch (SQLException ignored) {
                // Nothing useful to do while shutting down.
            }
            connection = null;
        }
    }
}
