package terracraft.service;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.zip.GZIPInputStream;
import java.util.zip.GZIPOutputStream;

/**
 * MatrixCodec — encode/decode elevation matrices for storage.
 *
 * Matrices are flattened to little-endian Float32 and gzip-compressed. This is
 * far faster to parse than JSON and keeps the stored blob small.
 */
public final class MatrixCodec {

    private MatrixCodec() {
    }

    /** Flatten a 2D matrix into a gzip-compressed Float32 byte array. */
    public static byte[] encode(double[][] matrix) {
        int rows = matrix.length;
        int cols = rows == 0 ? 0 : matrix[0].length;

        ByteBuffer buffer = ByteBuffer.allocate(rows * cols * 4).order(ByteOrder.LITTLE_ENDIAN);
        for (double[] row : matrix) {
            for (double value : row) {
                buffer.putFloat((float) value);
            }
        }

        try (ByteArrayOutputStream out = new ByteArrayOutputStream();
             GZIPOutputStream gzip = new GZIPOutputStream(out)) {
            gzip.write(buffer.array());
            gzip.finish();
            return out.toByteArray();
        } catch (IOException e) {
            throw new RuntimeException("Failed to encode matrix", e);
        }
    }

    /** Decompress a stored blob back into a gridSize x gridSize matrix. */
    public static double[][] decode(byte[] data, int gridSize) {
        try (GZIPInputStream gzip = new GZIPInputStream(new ByteArrayInputStream(data))) {
            byte[] raw = gzip.readAllBytes();
            ByteBuffer buffer = ByteBuffer.wrap(raw).order(ByteOrder.LITTLE_ENDIAN);

            double[][] matrix = new double[gridSize][gridSize];
            for (int r = 0; r < gridSize; r++) {
                for (int c = 0; c < gridSize; c++) {
                    matrix[r][c] = buffer.getFloat();
                }
            }
            return matrix;
        } catch (IOException e) {
            throw new RuntimeException("Failed to decode matrix", e);
        }
    }
}
