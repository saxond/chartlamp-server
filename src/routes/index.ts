import express from "express";
import { verifyApiKey } from "../middleware/verifyApiKey";
import openAiRoutes from "./openai";
import seedRoutes from "./seed";
import userRoutes from "./user";

const router = express.Router();

// Apply verifyApiKey middleware to all routes
router.use(verifyApiKey);

router.use("/user", userRoutes);

router.use("/openai", openAiRoutes);

router.use("/seed", seedRoutes);

export default router;
