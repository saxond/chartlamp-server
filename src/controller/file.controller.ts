import { Request, Response } from "express";

export class FileController {
  
  async upload(req: Request, res: Response) {
    const { file } = req;
    if (!file) {
      return res.status(400).send('No file uploaded.');
    }

    res.status(200).json({ file });

    /*
    const filePath = path.join(__dirname, file.path);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
     */
  }
}
