export interface CloudRuEndpoint {
  method?: string;
  path?: string;
  uri?: string;
  [key: string]: unknown;
}

export interface CloudRuReasoningMetadata {
  supported_efforts?: string[];
  efforts?: string[];
  optional?: boolean;
}

export interface CloudRuMetadata {
  provider?: string;
  type?: string;
  name?: string;
  company?: string;
  endpoints?: CloudRuEndpoint[];
  input_modalities?: string[];
  output_modalities?: string[];
  prompt_tokens_cost?: number;
  generated_tokens_cost?: number;
  cache_read_tokens_cost?: number;
  cache_write_tokens_cost?: number;
  task_type?: string[];
  reasoning?: CloudRuReasoningMetadata;
  max_output_tokens?: number;
  max_completion_tokens?: number;
  max_generated_tokens?: number;
  [key: string]: unknown;
}

export interface CloudRuModel {
  id: string;
  object?: string;
  owned_by?: string;
  context_length?: number;
  max_model_len?: number;
  max_output_tokens?: number;
  max_completion_tokens?: number;
  max_generated_tokens?: number;
  function_calling?: boolean;
  structure_output?: boolean;
  reasoning?: boolean;
  reasoning_optional?: boolean;
  capabilities?: string[];
  metadata?: CloudRuMetadata;
  [key: string]: unknown;
}

export interface CloudRuModelsResponse {
  object?: string;
  data: CloudRuModel[];
}
