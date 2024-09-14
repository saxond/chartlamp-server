// import axios from 'axios';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv-safe';
import express, { Request, Response } from "express";
import session from 'express-session';
import helmet from 'helmet';
import morgan from 'morgan';
// import cron from 'node-cron';
import swaggerUi from 'swagger-ui-express';
import errorHandlerMiddleware from './middleware/errors/errorHandler';
import notFoundMiddleware from './middleware/errors/notFound';
import api from './routes';
import swaggerDocument from './swagger/swagger.json';
import corsOptions from './utils/corsOption';
import { connectToMongo } from './utils/mongo';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const SESSION_SECRET = process.env.SESSION_SECRET as string;

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));

app.set('trust proxy', 1); // Trust first proxy

app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Ensure this matches your environment
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Adjust based on your needs
      maxAge: 30 * 60 * 1000 
    }
}));

app.get("/", (_req: Request, res: Response): Response => {
  return res.json({ message: "Construction check AI 🤟" });
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use('/api/v1', api);
app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);


// console.log('Scheduling cron job...');
// cron.schedule('* * * * *', async() => {
//   console.log('Running a task every minute');
//   const result = await axios.get('http://localhost:5000/api/v1/dc/disease-classifications?page=1&limit=50',{
//     headers: {
//       'api-key': `${process.env.API_KEY}`
//     }
//   });

//   console.log(result);
//   // Add your task logic here
// });
// console.log('Cron job scheduled.');

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