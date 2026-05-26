import express from "express";
import { authMiddleware } from "../middleware/auth.js";
import { generateApplicationPdf, generateAdmitCardPdf } from "../controllers/pdfController.js";

const router = express.Router();

router.post("/application/:applicationId", authMiddleware, generateApplicationPdf);
router.post("/admit-card/:applicationId", authMiddleware, generateAdmitCardPdf);

export default router;