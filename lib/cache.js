import redis from "redis";

let client = null;
let isConnected = false;

/**
 * Initialize Redis connection
 */
export const initRedis = async () => {
  if (isConnected) return client;

  if (!process.env.REDIS_URL) {
    console.warn(
      "[Cache] REDIS_URL not configured. Caching disabled. Set REDIS_URL=redis://localhost:6379 to enable."
    );
    return null;
  }

  try {
    client = redis.createClient({
      url: process.env.REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 500),
      },
    });

    client.on("error", (err) => {
      console.error("[Cache] Redis error:", err);
      isConnected = false;
    });

    client.on("connect", () => {
      console.log("[Cache] Redis connected");
      isConnected = true;
    });

    await client.connect();
    return client;
  } catch (error) {
    console.warn("[Cache] Failed to connect to Redis:", error.message);
    return null;
  }
};

/**
 * Get value from cache
 * @param {string} key - Cache key
 * @returns {Promise<any>} - Cached value or null
 */
export const getCache = async (key) => {
  if (!client || !isConnected) return null;

  try {
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error("[Cache] Error getting key:", key, error.message);
    return null;
  }
};

/**
 * Set value in cache
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttl - Time to live in seconds (default: 300 = 5 minutes)
 */
export const setCache = async (key, value, ttl = 300) => {
  if (!client || !isConnected) return false;

  try {
    await client.setEx(key, ttl, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error("[Cache] Error setting key:", key, error.message);
    return false;
  }
};

/**
 * Delete value from cache
 * @param {string} key - Cache key
 */
export const deleteCache = async (key) => {
  if (!client || !isConnected) return false;

  try {
    await client.del(key);
    return true;
  } catch (error) {
    console.error("[Cache] Error deleting key:", key, error.message);
    return false;
  }
};

/**
 * Clear all cache (use with caution!)
 */
export const clearAllCache = async () => {
  if (!client || !isConnected) return false;

  try {
    await client.flushDb();
    console.log("[Cache] All cache cleared");
    return true;
  } catch (error) {
    console.error("[Cache] Error clearing cache:", error.message);
    return false;
  }
};

/**
 * Cache key builder for common items
 */
export const cacheKeys = {
  recruitment: (id) => `recruitment:${id}`,
  post: (id) => `post:${id}`,
  notice: (id) => `notice:${id}`,
  result: (id) => `result:${id}`,
  admitCard: (id) => `admitcard:${id}`,
  recruitmentList: () => `recruitments:list`,
  postList: (recruitmentId) => `posts:${recruitmentId}:list`,
  noticeList: () => `notices:list`,
  resultsList: (postId) => `results:${postId}:list`,
  meritList: (postId) => `merit:${postId}:list`,
};

/**
 * Middleware to cache GET requests
 * Usage: app.get('/api/route', cacheMiddleware(3600), handler)
 */
export const cacheMiddleware = (ttl = 300) => {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== "GET") {
      return next();
    }

    // Skip authenticated users' personal data
    if (req.path.includes("my") || req.path.includes("profile")) {
      return next();
    }

    const cacheKey = `route:${req.path}`;

    try {
      const cached = await getCache(cacheKey);
      if (cached) {
        console.log("[Cache] Hit:", cacheKey);
        return res.json(cached);
      }
    } catch (error) {
      console.error("[Cache] Error checking cache:", error);
    }

    // Intercept res.json to cache the response
    const originalJson = res.json;
    res.json = function (data) {
      // Cache successful responses only
      if (res.statusCode === 200) {
        setCache(cacheKey, data, ttl).catch(console.error);
      }
      return originalJson.call(this, data);
    };

    next();
  };
};

export default {
  initRedis,
  getCache,
  setCache,
  deleteCache,
  clearAllCache,
  cacheKeys,
  cacheMiddleware,
};
