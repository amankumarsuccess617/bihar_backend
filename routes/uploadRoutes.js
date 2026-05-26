import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { authMiddleware } from "../middleware/auth.js";
import { attachDocumentToApplication } from "../controllers/uploadController.js";

const router = express.Router();

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const base = path.join(process.cwd(), "uploads");
    const type = (req.body?.type || "").toLowerCase();

    let sub = "misc";
    if (type === "photo") sub = "photos";
    else if (type === "signature") sub = "signatures";
    else if (type === "certificate") sub = "certificates";

    const dest = path.join(base, sub);
    ensureDir(dest);
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "");
    cb(null, `${Date.now()}_${Math.floor(Math.random() * 1e6)}_${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});

router.post(
  "/application/:applicationId",
  authMiddleware,
  upload.single("file"),
  attachDocumentToApplication
);

export default router;