import { Router } from "express";
import { seedDiseaseClass } from "../scripts/dieaseClassification";

const router = Router();

router.post("/diseaseClass", (_req, _res) => seedDiseaseClass());

export default router;
