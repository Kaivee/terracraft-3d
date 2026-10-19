package terracraft.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

/** Unit tests for the gzip + Float32 matrix codec. */
class MatrixCodecTest {

    @Test
    void encodeDecodeRoundTripsAMatrix() {
        double[][] matrix = {
            {1, 2},
            {3, 4},
        };

        double[][] decoded = MatrixCodec.decode(MatrixCodec.encode(matrix), 2);

        assertEquals(1.0, decoded[0][0], 1e-4);
        assertEquals(2.0, decoded[0][1], 1e-4);
        assertEquals(3.0, decoded[1][0], 1e-4);
        assertEquals(4.0, decoded[1][1], 1e-4);
    }

    @Test
    void roundTripsNegativeAndFractionalElevations() {
        double[][] matrix = {
            {-12.5, 4096.25},
            {0.0, -0.5},
        };

        double[][] decoded = MatrixCodec.decode(MatrixCodec.encode(matrix), 2);

        assertEquals(-12.5, decoded[0][0], 1e-3);
        assertEquals(4096.25, decoded[0][1], 1e-3);
        assertEquals(0.0, decoded[1][0], 1e-4);
        assertEquals(-0.5, decoded[1][1], 1e-3);
    }
}
