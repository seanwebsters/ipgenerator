import path from "node:path";
import os from "node:os";

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://webster:webster@localhost:5432/webster_test";
process.env.STORAGE_DIR = path.join(os.tmpdir(), `webster-test-${process.pid}`);
// Integration tests never call real providers.
delete process.env.ANTHROPIC_API_KEY;
delete process.env.OPENAI_API_KEY;
delete process.env.ELEVENLABS_API_KEY;
delete process.env.YOUTUBE_REFRESH_TOKEN;
process.env.LEARNING_MIN_VIEWERS = "10";
