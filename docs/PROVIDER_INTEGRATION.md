# Provider Integration

Every provider implements `WatermarkProvider` from `packages/provider-core`.

Provider adapters translate vendor output into detections; they do not decide
attribution, reward, or payment. Provider keys stay server-side. Unavailable or
degraded providers must return safe health state and allow visible-code or QR
fallback without inventing a detection.

A mock provider may use an obvious test carrier for deterministic development
tests. It must be labeled test-only and never represented as robust invisible
watermarking.
