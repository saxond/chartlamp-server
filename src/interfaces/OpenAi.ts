export interface ChatInput {
    context: string;
    prompt: string;
    model: string;
    temperature?: number;
    response_format?: any;
}

export interface TrainingDataItem {
    preContext: string;
    objection: string;
    response: string;
}