import mongoose from "mongoose";

export async function connectToMongo() {
  const MONGODB_CONNECTION_STRING = process.env.MONGODB_CONNECTION_STRING as string;
  if (!MONGODB_CONNECTION_STRING) {
    console.error("MONGODB_CONNECTION_STRING is not defined in environment variables.");
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_CONNECTION_STRING);
    console.log("Successfully connected to MongoDB.");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1);
  }
}