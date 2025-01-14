import dotenv from "dotenv-safe";
import cron from "node-cron";
dotenv.config(); // Ensure this is the first line

import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { Request, Response } from "express";
import helmet from "helmet";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import errorHandlerMiddleware from "./middleware/errors/errorHandler";
import notFoundMiddleware from "./middleware/errors/notFound";
import api from "./routes";
import swaggerDocument from "./swagger/swagger.json";
import corsOptions from "./utils/corsOption";
import { connectToMongo } from "./utils/mongo";
import axios from "axios";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(helmet());
app.use(compression());
app.use(morgan("combined"));

app.set("trust proxy", 1); // Trust first proxy

app.get("/", (_req: Request, res: Response): Response => {
  return res.json({ message: "Construction check AI 🤟" });
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use("/api/v1", api);
app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

console.log("Scheduling cron job...");

// cron.schedule("*/15 * * * *", async () => {
cron.schedule("* * * * *", async () => {
  console.log("Running a task every minute");

  const ocr = await axios.get(
    `${process.env.SERVER_URL as string}/api/v1/case/ocr`,
    {
      headers: {
        "api-key": `${process.env.API_KEY}`,
      },
    }
  );

  console.log(ocr?.data);

  const result = await axios.get(
    `${process.env.SERVER_URL as string}/api/v1/case/process`,
    {
      headers: {
        "api-key": `${process.env.API_KEY}`,
      },
    }
  );

  console.log(result?.data);
  // Add your task logic here
});

console.log("Cron job scheduled....");

const start = async (): Promise<void> => {
  try {
    await connectToMongo();
    app.listen(PORT, () => {
      console.log(`Server started on port ${PORT}`);
    });
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

void start();
