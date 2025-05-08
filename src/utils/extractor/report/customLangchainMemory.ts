import { BufferMemory, BufferMemoryInput } from "langchain/memory";

class CustomLangchainMemory extends BufferMemory {
  private maxPages: number;

  constructor({
    maxPages = 3,
    ...rest
  }: { maxPages?: number } & BufferMemoryInput) {
    super({ ...rest });
    this.maxPages = maxPages;
  }

  async saveContext(inputValues: any, outputValues: any) {
    await super.saveContext(inputValues, outputValues);

    const allMessages = await this.chatHistory.getMessages();

    const maxMessages = this.maxPages * 2;

    if (allMessages.length > maxMessages) {
      const keepMessages = allMessages.slice(-maxMessages);

      await this.chatHistory.clear();

      for (const msg of keepMessages) {
        await this.chatHistory.addMessage(msg);
      }
    }
  }
}

export default CustomLangchainMemory;
