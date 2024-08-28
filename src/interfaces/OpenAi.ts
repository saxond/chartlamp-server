export interface ChatInput {
    context: string;
    prompt: string;
    model: string;
    temperature: number;
}

export interface TrainingDataItem {
    preContext: string;
    objection: string;
    response: string;
}