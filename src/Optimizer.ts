import { CompletionResult, ModelConfig, TestResult } from './types';

type Executor = (prompt: string, config: ModelConfig) => Promise<CompletionResult>;
type Scorer = (response: string, expected?: string) => number;

interface Variation {
  id: string;
  prompt: string;
  scores: number[];
  avgScore: number;
  runCount: number;
}

export class PromptOptimizer {
  private variations: Map<string, Variation> = new Map();
  private executor: Executor;
  private scorers: Map<string, Scorer> = new Map();

  constructor(executor: Executor) {
    this.executor = executor;

    // Built-in scorers
    this.scorers.set('length', (response: string) => {
      const ideal = 500;
      const diff = Math.abs(response.length - ideal);
      return Math.max(0, 1 - diff / ideal);
    });

    this.scorers.set('coherence', (response: string) => {
      const sentences = response.split(/[.!?]+/).filter(Boolean);
      if (sentences.length < 2) return 0.5;
      return Math.min(1, sentences.length / 10);
    });

    this.scorers.set('conciseness', (response: string) => {
      const words = response.split(/\s+/).length;
      if (words < 50) return 1;
      if (words > 1000) return 0.3;
      return 1 - (words - 50) / 1500;
    });
  }

  addVariation(id: string, prompt: string): void {
    this.variations.set(id, { id, prompt, scores: [], avgScore: 0, runCount: 0 });
  }

  addScorer(name: string, scorer: Scorer): void {
    this.scorers.set(name, scorer);
  }

  async testVariation(
    id: string,
    config: ModelConfig,
    expected?: string
  ): Promise<TestResult> {
    const variation = this.variations.get(id);
    if (!variation) throw new Error(`Variation ${id} not found`);

    const start = Date.now();
    const result = await this.executor(variation.prompt, config);
    const latency = Date.now() - start;

    const metrics = {
      relevance: expected
        ? this.calculateRelevance(result.text, expected)
        : 0.5,
      coherence: this.scorers.get('coherence')!(result.text),
      conciseness: this.scorers.get('conciseness')!(result.text),
      formatCompliance: 1,
    };

    const overallScore =
      (metrics.relevance + metrics.coherence + metrics.conciseness + metrics.formatCompliance) / 4;

    variation.scores.push(overallScore);
    variation.avgScore =
      variation.scores.reduce((a, b) => a + b, 0) / variation.scores.length;
    variation.runCount++;

    return {
      testId: `test-${id}-${variation.runCount}`,
      passed: overallScore >= 0.7,
      score: overallScore,
      metrics,
      response: { ...result, latencyMs: latency },
      evaluationNotes: this.generateNotes(metrics),
    };
  }

  async abTest(
    idA: string,
    idB: string,
    config: ModelConfig,
    runs: number = 5
  ): Promise<{ winner: string; scoreA: number; scoreB: number }> {
    for (let i = 0; i < runs; i++) {
      await this.testVariation(idA, config);
      await this.testVariation(idB, config);
    }

    const a = this.variations.get(idA)!;
    const b = this.variations.get(idB)!;

    return {
      winner: a.avgScore >= b.avgScore ? idA : idB,
      scoreA: a.avgScore,
      scoreB: b.avgScore,
    };
  }

  suggestImprovements(id: string): string[] {
    const variation = this.variations.get(id);
    if (!variation) return [];

    const suggestions: string[] = [];
    const prompt = variation.prompt;

    if (!prompt.includes('step by step') && !prompt.includes('Step')) {
      suggestions.push('Add "step by step" instruction for more structured output');
    }
    if (prompt.length < 50) {
      suggestions.push('Prompt may be too short. Add more context or constraints');
    }
    if (!prompt.includes('example') && !prompt.includes('Example')) {
      suggestions.push('Consider adding few-shot examples for better output quality');
    }
    if (!prompt.includes('format') && !prompt.includes('Format')) {
      suggestions.push('Specify desired output format explicitly');
    }
    if (variation.avgScore < 0.5) {
      suggestions.push('Score is low. Consider rewriting the core instruction');
    }

    return suggestions;
  }

  private calculateRelevance(response: string, expected: string): number {
    const responseWords = new Set(response.toLowerCase().split(/\s+/));
    const expectedWords = expected.toLowerCase().split(/\s+/);
    const matches = expectedWords.filter((w) => responseWords.has(w)).length;
    return matches / expectedWords.length;
  }

  private generateNotes(metrics: Record<string, number>): string[] {
    const notes: string[] = [];
    if (metrics.relevance < 0.5) notes.push('Low relevance - response may be off-topic');
    if (metrics.coherence < 0.5) notes.push('Low coherence - response lacks structure');
    if (metrics.conciseness < 0.5) notes.push('Response is too verbose');
    if (metrics.formatCompliance < 0.5) notes.push('Output format does not match expectations');
    return notes;
  }

  getResults(): Map<string, Variation> {
    return new Map(this.variations);
  }
}
