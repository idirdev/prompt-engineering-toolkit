export interface Variable {
  name: string;
  description?: string;
  required: boolean;
  defaultValue?: string;
  validator?: (value: string) => boolean;
}

export interface Prompt {
  id: string;
  content: string;
  variables: Variable[];
  metadata: {
    category: string;
    tags: string[];
    version: number;
    author?: string;
    createdAt: Date;
    updatedAt: Date;
  };
}

export interface PromptTemplateConfig {
  name: string;
  description?: string;
  template: string;
  variables: Variable[];
  category?: string;
  tags?: string[];
}

export interface ChainStep {
  id: string;
  promptId: string;
  inputMapping: Record<string, string>;
  outputKey: string;
  condition?: (context: Record<string, unknown>) => boolean;
  retryCount?: number;
  retryDelay?: number;
  parallel?: boolean;
}

export interface Chain {
  id: string;
  name: string;
  steps: ChainStep[];
  context: Record<string, unknown>;
  onError?: 'stop' | 'skip' | 'retry';
}

export interface ModelConfig {
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
}

export interface CompletionResult {
  text: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: string;
  latencyMs: number;
}

export interface PromptTest {
  id: string;
  promptId: string;
  input: Record<string, string>;
  expectedOutput?: string;
  rubric?: Record<string, number>;
  model: ModelConfig;
}

export interface TestResult {
  testId: string;
  passed: boolean;
  score: number;
  metrics: {
    relevance: number;
    coherence: number;
    conciseness: number;
    formatCompliance: number;
  };
  response: CompletionResult;
  evaluationNotes: string[];
}
