import { v4 as uuidv4 } from 'uuid';
import { Chain, ChainStep, CompletionResult } from './types';

type Executor = (prompt: string) => Promise<CompletionResult>;

export class PromptChain {
  private chain: Chain;
  private executor: Executor;

  constructor(name: string, executor: Executor) {
    this.chain = {
      id: uuidv4(),
      name,
      steps: [],
      context: {},
      onError: 'stop',
    };
    this.executor = executor;
  }

  addStep(step: Omit<ChainStep, 'id'>): PromptChain {
    this.chain.steps.push({ ...step, id: uuidv4() });
    return this;
  }

  setErrorStrategy(strategy: 'stop' | 'skip' | 'retry'): PromptChain {
    this.chain.onError = strategy;
    return this;
  }

  setContext(context: Record<string, unknown>): PromptChain {
    this.chain.context = { ...this.chain.context, ...context };
    return this;
  }

  async execute(): Promise<Record<string, unknown>> {
    const context = { ...this.chain.context };

    for (const step of this.chain.steps) {
      // Check conditional execution
      if (step.condition && !step.condition(context)) {
        continue;
      }

      // Find parallel steps
      const parallelSteps = this.chain.steps.filter(
        (s) => s.parallel && s.id !== step.id
      );

      if (parallelSteps.length > 0 && step.parallel) {
        continue; // Will be handled by a non-parallel step
      }

      try {
        const result = await this.executeStep(step, context);
        context[step.outputKey] = result.text;
      } catch (error) {
        if (this.chain.onError === 'stop') {
          throw error;
        }
        if (this.chain.onError === 'retry') {
          const retryResult = await this.retryStep(step, context);
          context[step.outputKey] = retryResult?.text ?? null;
        }
        // 'skip' - just continue
      }

      // Execute parallel steps if any are queued after this step
      const nextParallel = this.chain.steps.filter((s) => s.parallel);
      if (nextParallel.length > 0) {
        const results = await Promise.allSettled(
          nextParallel.map((s) => this.executeStep(s, context))
        );
        results.forEach((result, i) => {
          if (result.status === 'fulfilled') {
            context[nextParallel[i].outputKey] = result.value.text;
          }
        });
      }
    }

    return context;
  }

  private async executeStep(
    step: ChainStep,
    context: Record<string, unknown>
  ): Promise<CompletionResult> {
    let prompt = step.promptId;

    // Map inputs from context
    for (const [varName, contextKey] of Object.entries(step.inputMapping)) {
      const value = context[contextKey];
      prompt = prompt.replace(`{{${varName}}}`, String(value ?? ''));
    }

    return this.executor(prompt);
  }

  private async retryStep(
    step: ChainStep,
    context: Record<string, unknown>
  ): Promise<CompletionResult | null> {
    const maxRetries = step.retryCount ?? 3;
    const delay = step.retryDelay ?? 1000;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await new Promise((resolve) => setTimeout(resolve, delay * (attempt + 1)));
        return await this.executeStep(step, context);
      } catch {
        if (attempt === maxRetries - 1) return null;
      }
    }
    return null;
  }

  getSteps(): ChainStep[] {
    return [...this.chain.steps];
  }

  getContext(): Record<string, unknown> {
    return { ...this.chain.context };
  }
}
