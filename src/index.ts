import dotenv from "dotenv-safe";
import cron from "node-cron";
dotenv.config(); // Ensure this is the first line

import { ExpressAdapter } from "@bull-board/express";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";

import axios from "axios";
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
import { allQueues } from "./utils/queue/index";
import { pdfTextExtractorQueue } from "./utils/queue/pdfExtractor/producer";

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
  return res.json({ message: "Chartlamp server 🤟" });
});

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");

createBullBoard({
  queues: [...allQueues, pdfTextExtractorQueue].map(
    (q) => new BullMQAdapter(q)
  ),
  serverAdapter,
});

app.use("/admin/queues", serverAdapter.getRouter());

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use("/api/v1", api);
app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

console.log("Scheduling cron job...");

cron.schedule("* * * * *", async () => {
  console.log("Running a task every minute!!");
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
    // console.error = () => {};
    await connectToMongo();
    app.listen(PORT, () => {
      console.log(`Server started on port ${PORT}!!!!!!!`);
    });
  } catch (error) {
    // console.error(error);
    process.exit(1);
  }
};

void start();
