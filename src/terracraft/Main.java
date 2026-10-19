package terracraft;

import terracraft.config.Env;
import terracraft.db.Database;
import terracraft.web.Server;

/**
 * Main — application entry point.
 *
 * Loads configuration, initializes the SQLite cache, and starts the HTTP server
 * that serves the frontend and the /api endpoints.
 */
public final class Main {

    private Main() {
    }

    public static void main(String[] args) throws Exception {
        Env.load(".env");

        int port = Env.getInt("PORT", 3000);
        String dbPath = Env.get("DB_PATH", "data/terrain.db");

        System.out.println("Initializing database...");
        Database.init(dbPath);
        System.out.println("Database ready (" + dbPath + ")");

        Server server = new Server(port, "public");
        server.start();

        System.out.println("TerraCraft 3D server running at http://localhost:" + port);
        System.out.println("Open your browser and search for a location!");

        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            System.out.println("\nShutting down...");
            server.stop();
            Database.close();
        }));
    }
}
