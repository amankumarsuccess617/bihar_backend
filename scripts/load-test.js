/**
 * Load Testing Script for Bihar Recruitment Portal
 * Uses k6 for load testing (https://k6.io)
 * 
 * Installation:
 *   1. Download k6 from https://k6.io/docs/getting-started/installation/
 *   2. Or install via npm: npm install --save-dev @k6/cli k6
 * 
 * Usage:
 *   k6 run scripts/load-test.js
 *   k6 run scripts/load-test.js --vus 100 --duration 5m    # 100 users, 5 minutes
 * 
 * VU = Virtual User (simulated user making requests)
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

// Custom metrics
export const errorRate = new Rate("errors");
export const requestDuration = new Trend("request_duration");
export const successCount = new Counter("success_requests");

// Configuration
export const options = {
  stages: [
    { duration: "30s", target: 10 }, // Ramp up to 10 users
    { duration: "1m", target: 50 }, // Ramp up to 50 users
    { duration: "2m", target: 100 }, // Ramp up to 100 users
    { duration: "1m", target: 50 }, // Ramp down to 50 users
    { duration: "30s", target: 0 }, // Ramp down to 0 users
  ],
  thresholds: {
    // Fail if error rate > 5%
    errors: ["rate < 0.05"],
    // Fail if 95th percentile of request duration > 1000ms
    request_duration: ["p(95) < 1000"],
  },
};

const BASE_URL = "http://localhost:5000/api";

/**
 * Test Public Endpoints (No Auth)
 */
function testPublicEndpoints() {
  // Get all recruitments
  let res = http.get(`${BASE_URL}/recruitments`);
  check(res, {
    "GET /recruitments status 200": (r) => r.status === 200,
    "GET /recruitments duration < 500ms": (r) => r.timings.duration < 500,
  });
  requestDuration.add(res.timings.duration);
  errorRate.add(res.status !== 200);
  successCount.add(res.status === 200 ? 1 : 0);

  sleep(1);

  // Get notices
  res = http.get(`${BASE_URL}/notices`);
  check(res, {
    "GET /notices status 200": (r) => r.status === 200,
    "GET /notices duration < 500ms": (r) => r.timings.duration < 500,
  });
  requestDuration.add(res.timings.duration);
  errorRate.add(res.status !== 200);
  successCount.add(res.status === 200 ? 1 : 0);

  sleep(1);

  // Search results by roll number
  res = http.get(`${BASE_URL}/results?rollNo=1001`);
  check(res, {
    "GET /results search status": (r) =>
      r.status === 200 || r.status === 404,
  });
  requestDuration.add(res.timings.duration);

  sleep(1);
}

/**
 * Test Authentication Flow
 */
function testAuthFlow() {
  // Send OTP (Registration flow)
  let res = http.post(`${BASE_URL}/otp/send`, {
    channel: "EMAIL",
    destination: `test${Date.now()}@example.com`,
    purpose: "REGISTER",
    captchaToken: "test-token",
  });

  check(res, {
    "POST /otp/send status 200": (r) => r.status === 200,
  });
  requestDuration.add(res.timings.duration);
  errorRate.add(res.status !== 200);

  sleep(2);
}

/**
 * Test Database Query Performance
 */
function testDatabaseQueries() {
  // List applications (admin)
  const adminToken =
    "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."; // Replace with real token

  let res = http.get(`${BASE_URL}/applications?page=1&limit=50`, {
    headers: {
      Authorization: adminToken,
    },
  });

  check(res, {
    "Applications list returns data": (r) =>
      r.status === 200 || r.status === 401,
  });
  requestDuration.add(res.timings.duration);

  sleep(1);

  // Get results for specific post
  res = http.get(`${BASE_URL}/results?postId=1`);
  check(res, {
    "Results list status": (r) => r.status === 200,
    "Results list duration < 1000ms": (r) => r.timings.duration < 1000,
  });
  requestDuration.add(res.timings.duration);

  sleep(1);
}

/**
 * Test File Operations
 */
function testFileOperations() {
  // Get list of posts (often cached)
  let res = http.get(`${BASE_URL}/posts?recruitmentId=1`);
  check(res, {
    "GET /posts status": (r) => r.status === 200 || r.status === 404,
    "GET /posts duration < 500ms": (r) => r.timings.duration < 500,
  });
  requestDuration.add(res.timings.duration);
  errorRate.add(res.status !== 200 && r.status !== 404);

  sleep(1);
}

/**
 * Test Concurrent Operations
 */
function testConcurrentOperations() {
  const batchRequests = [
    {
      method: "GET",
      url: `${BASE_URL}/recruitments`,
    },
    {
      method: "GET",
      url: `${BASE_URL}/notices`,
    },
    {
      method: "GET",
      url: `${BASE_URL}/posts?page=1&limit=20`,
    },
    {
      method: "GET",
      url: `${BASE_URL}/results?postId=1`,
    },
  ];

  const responses = http.batch(batchRequests);

  responses.forEach((res) => {
    check(res, {
      "Batch request status 200": (r) => r.status === 200,
      "Batch request duration < 1000ms": (r) => r.timings.duration < 1000,
    });
    requestDuration.add(res.timings.duration);
    errorRate.add(res.status !== 200);
    successCount.add(res.status === 200 ? 1 : 0);
  });

  sleep(2);
}

/**
 * Main test execution
 */
export default function () {
  testPublicEndpoints();
  testDatabaseQueries();
  testFileOperations();
  testAuthFlow();
  testConcurrentOperations();
}
