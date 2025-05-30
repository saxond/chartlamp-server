import { Router } from "express";
import { isAuthenticated } from "../middleware/isAuth";
import {FileController} from "../controller/file.controller";
import multer from 'multer';

const router = Router();
const fileController = new FileController();

const upload = multer({ dest: 'uploads/' }); // Specify the destination folder for uploads

router.post("/upload", [isAuthenticated, upload.single('file')], (req, res) =>
  fileController.upload(req, res)
);

// Export the router
export default router;
