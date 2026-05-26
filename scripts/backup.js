#!/usr/bin/env node

/**
 * Database Backup Script
 * Backs up PostgreSQL database to local storage and optionally to AWS S3
 * 
 * Usage:
 *   node scripts/backup.js              # Local backup only
 *   node scripts/backup.js --upload     # Local backup + S3 upload
 * 
 * Setup cron job (runs daily at 2 AM):
 *   0 2 * * * cd /path/to/backend && node scripts/backup.js --upload
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import dotenv from "dotenv";

dotenv.config();

const BACKUP_DIR = path.join(process.cwd(), "backups");
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, "-").split("Z")[0];
const BACKUP_FILE = `backup-${TIMESTAMP}.sql`;
const BACKUP_PATH = path.join(BACKUP_DIR, BACKUP_FILE);

/**
 * Ensure backup directory exists
 */
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log("[Backup] Created backup directory:", BACKUP_DIR);
  }
}

/**
 * Create local database backup
 */
function createLocalBackup() {
  console.log("[Backup] Starting database backup...");

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("[Backup] ERROR: DATABASE_URL not set");
    process.exit(1);
  }

  try {
    // Parse DATABASE_URL to extract connection details
    // Format: postgresql://user:password@host:port/dbname
    const urlMatch = dbUrl.match(
      /postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/
    );

    if (!urlMatch) {
      console.error("[Backup] ERROR: Invalid DATABASE_URL format");
      process.exit(1);
    }

    const [, user, password, host, port, database] = urlMatch;

    // Create backup using pg_dump
    const command = `PGPASSWORD="${password}" pg_dump -h ${host} -p ${port} -U ${user} -F c ${database}`;

    console.log("[Backup] Executing pg_dump...");
    const backup = execSync(command, { stdio: "pipe" });

    fs.writeFileSync(BACKUP_PATH, backup);
    const fileSize = fs.statSync(BACKUP_PATH).size;

    console.log(
      `[Backup] ✅ Backup created successfully: ${BACKUP_FILE} (${(
        fileSize /
        1024 /
        1024
      ).toFixed(2)} MB)`
    );

    return BACKUP_PATH;
  } catch (error) {
    console.error("[Backup] ERROR:", error.message);
    process.exit(1);
  }
}

/**
 * Upload backup to AWS S3
 */
async function uploadToS3(filePath) {
  const {
    S3Client,
    PutObjectCommand,
  } = await import("@aws-sdk/client-s3");

  const s3AccessKey = process.env.AWS_ACCESS_KEY_ID;
  const s3SecretKey = process.env.AWS_SECRET_ACCESS_KEY;
  const s3Bucket = process.env.S3_BACKUP_BUCKET;
  const s3Region = process.env.AWS_REGION || "ap-south-1";

  if (!s3AccessKey || !s3SecretKey || !s3Bucket) {
    console.warn(
      "[Backup] ⚠️  AWS credentials not configured. Skipping S3 upload."
    );
    console.warn(
      "[Backup] Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BACKUP_BUCKET to enable"
    );
    return false;
  }

  try {
    const s3Client = new S3Client({ region: s3Region });
    const fileStream = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);

    const uploadParams = {
      Bucket: s3Bucket,
      Key: `backups/${new Date().getFullYear()}/${String(
        new Date().getMonth() + 1
      ).padStart(2, "0")}/${fileName}`,
      Body: fileStream,
      ContentType: "application/octet-stream",
      Metadata: {
        "backup-date": new Date().toISOString(),
        "database": process.env.DATABASE_URL?.split("/").pop() || "unknown",
      },
    };

    console.log("[Backup] Uploading to S3:", uploadParams.Key);

    const command = new PutObjectCommand(uploadParams);
    await s3Client.send(command);

    console.log("[Backup] ✅ Successfully uploaded to S3");
    return true;
  } catch (error) {
    console.error("[Backup] ERROR uploading to S3:", error.message);
    return false;
  }
}

/**
 * Clean up old backups (keep last 30 days)
 */
function cleanupOldBackups() {
  const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days in ms
  const now = Date.now();

  try {
    const files = fs.readdirSync(BACKUP_DIR);

    files.forEach((file) => {
      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);

      if (now - stats.mtime.getTime() > maxAge) {
        fs.unlinkSync(filePath);
        console.log("[Backup] Deleted old backup:", file);
      }
    });
  } catch (error) {
    console.error("[Backup] ERROR cleaning up old backups:", error.message);
  }
}

/**
 * Generate backup report
 */
function generateReport(filePath, uploadedToS3) {
  const stats = fs.statSync(filePath);
  const reportPath = path.join(BACKUP_DIR, `backup-report-${TIMESTAMP}.json`);

  const report = {
    timestamp: new Date().toISOString(),
    fileName: path.basename(filePath),
    fileSize: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
    uploadedToS3,
    database: process.env.DATABASE_URL?.split("/").pop() || "unknown",
    compression: "custom",
    retentionDays: 30,
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log("[Backup] Report saved:", reportPath);

  return report;
}

/**
 * Main backup function
 */
async function main() {
  const shouldUpload = process.argv.includes("--upload");

  console.log("\n╔════════════════════════════════════════════════════╗");
  console.log("║         Database Backup Script (PostgreSQL)         ║");
  console.log("╚════════════════════════════════════════════════════╝\n");

  // Step 1: Create local backup
  ensureBackupDir();
  const backupPath = createLocalBackup();

  // Step 2: Upload to S3 if requested
  let uploadedToS3 = false;
  if (shouldUpload) {
    uploadedToS3 = await uploadToS3(backupPath);
  }

  // Step 3: Cleanup old backups
  cleanupOldBackups();

  // Step 4: Generate report
  const report = generateReport(backupPath, uploadedToS3);

  console.log("\n[Backup] Summary:");
  console.log(JSON.stringify(report, null, 2));
  console.log("\n✅ Backup process completed successfully!\n");
}

// Run backup
main().catch((error) => {
  console.error("[Backup] Fatal error:", error);
  process.exit(1);
});
