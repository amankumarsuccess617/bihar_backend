import "dotenv/config";
import { createApp } from "./app.js";
import { initRedis } from "./lib/cache.js";
import { updateAllRecruitmentsExpiry } from "./lib/recruitmentUtils.js";
import { logger } from "./lib/logger.js";

const app = createApp();
const PORT = process.env.PORT || 5000;

async function startServer() {
  setInterval(async () => {
    try {
      logger.info("Checking recruitment expiry...");
      await updateAllRecruitmentsExpiry();
      logger.info("Recruitment expiry updated");
    } catch (err) {
      logger.error("Recruitment expiry cron failed", {
        message: err.message,
      });
    }
  }, 5 * 60 * 1000);

  await initRedis();

  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`, {
      api: `http://localhost:${PORT}/api`,
      health: `http://localhost:${PORT}/health`,
    });
  });
}

if (process.env.NODE_ENV !== "test") {
  startServer().catch((error) => {
    logger.error("Failed to start server", { message: error.message });
    process.exit(1);
  });
}

export default app;
