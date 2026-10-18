import path from "node:path";
import os from "node:os";

// TEST_EMBEDDED=1 runs everything against the built-in in-memory database instead.
if (process.env.TEST_EMBEDDED === "1") process.env.DATABASE_URL = ""; // empty, so dotenv can't refill it
else process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://webster:webster@localhost:5432/webster_test";
process.env.STORAGE_DIR = path.join(os.tmpdir(), `webster-test-${process.pid}`);
// Integration tests never call real providers.
delete process.env.ANTHROPIC_API_KEY;
delete process.env.OPENAI_API_KEY;
delete process.env.ELEVENLABS_API_KEY;
delete process.env.YOUTUBE_REFRESH_TOKEN;
process.env.LEARNING_MIN_VIEWERS = "10";
