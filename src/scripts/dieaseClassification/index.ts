import { DiseaseClassificationModel } from "../../models/diseaseClassification.model";
import diseaseByClassification from "./icd-10-cm-codes.json";

export const seedDiseaseClass = async () => {
  try {
    const data = JSON.parse(JSON.stringify(diseaseByClassification));
    const existingData = await DiseaseClassificationModel.find({}).lean();
    if (existingData) {
      console.log("Data already seeded");
      await DiseaseClassificationModel.deleteMany({});
      console.log("Data cleared");
    }
    const insertedData = await DiseaseClassificationModel.insertMany(data);
    console.log(`Data seeded successfully: ${insertedData.length} records`);
  } catch (error) {
    console.log(error);
  }
};
