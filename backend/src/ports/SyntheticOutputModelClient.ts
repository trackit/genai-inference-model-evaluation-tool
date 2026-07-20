export interface SyntheticOutputModelClient {
  generate(
    request: SyntheticOutputModelRequest,
  ): Promise<SyntheticOutputModelResult>;
}

export interface SyntheticOutputModelRequest {
  prompt: string;
  modelId?: string;
}

export interface SyntheticOutputModelResult {
  output: string;
  modelId?: string;
}
