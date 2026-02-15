interface ChargeParams {
  generateAudio?: boolean;
  isError?: boolean;
  metadata: {
    asyncTaskId: string;
    generationBatchId: string;
    modelId: string;
    topicId?: string;
  };
  model: string;
  prechargeResult?: Record<string, unknown>;
  provider: string;
  usage?: { completionTokens: number; totalTokens: number };
  userId: string;
}

// eslint-disable-next-line unused-imports/no-unused-vars
export async function chargeAfterGenerate(params: ChargeParams): Promise<void> {}
