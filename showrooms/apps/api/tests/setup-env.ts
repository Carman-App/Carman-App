// Runs in each test worker before any app module is imported, so config/env.ts sees these values.
process.env.NODE_ENV = "test";
process.env.APP_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.MONGODB_URI ??= "mongodb://placeholder-replaced-per-test-file";
process.env.JWT_ACCESS_SECRET = "test-access-secret-that-is-long-enough-123";
process.env.BCRYPT_ROUNDS = "4";
process.env.CORS_ORIGINS = "http://localhost:3000";
process.env.RATE_LIMIT_ENABLED = "false";
process.env.EMAIL_PROVIDER = "console";
process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
process.env.POSTER_SIGNING_SECRET = "test-poster-secret-that-is-long-enough-0123";
process.env.MPESA_CALLBACK_TOKEN = "test-callback-token-0123456789abcdef";
process.env.JOBS_ENABLED = "false";
