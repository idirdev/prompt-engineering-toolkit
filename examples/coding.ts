import { PromptChain, PromptTemplate, PromptLibrary, ResponseEvaluator } from '../src';

/**
 * Example: Coding prompt chain that goes through
 * analyze -> plan -> implement -> review
 */
async function runCodingChain() {
  const library = new PromptLibrary();

  // Create prompt templates for each step
  const analyzeTemplate = PromptTemplate.fromString(
    'Analyze this {{language}} code and identify issues, complexity, and architecture:\n\n```{{language}}\n{{code}}\n```'
  );

  const planTemplate = PromptTemplate.fromString(
    'Based on this analysis:\n{{analysis}}\n\nCreate a step-by-step improvement plan for the codebase. Focus on: {{priorities}}'
  );

  const implementTemplate = PromptTemplate.fromString(
    'Implement the following improvement plan:\n{{plan}}\n\nOriginal code:\n```{{language}}\n{{code}}\n```\n\nReturn only the improved code.'
  );

  const reviewTemplate = PromptTemplate.fromString(
    'Review the following code changes.\n\nOriginal:\n```{{language}}\n{{original}}\n```\n\nImproved:\n```{{language}}\n{{improved}}\n```\n\nProvide a code review with scoring on: correctness, performance, readability.'
  );

  // Mock executor for demonstration
  const mockExecutor = async (prompt: string) => ({
    text: `[Response to: ${prompt.slice(0, 80)}...]`,
    model: 'gpt-4',
    usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
    finishReason: 'stop',
    latencyMs: 450,
  });

  // Build the chain
  const chain = new PromptChain('coding-improvement', mockExecutor)
    .setContext({
      language: 'TypeScript',
      code: 'function add(a: any, b: any) { return a + b; }',
      priorities: 'type safety, error handling, documentation',
    })
    .addStep({
      promptId: analyzeTemplate.getContent(),
      inputMapping: { language: 'language', code: 'code' },
      outputKey: 'analysis',
    })
    .addStep({
      promptId: planTemplate.getContent(),
      inputMapping: { analysis: 'analysis', priorities: 'priorities' },
      outputKey: 'plan',
    })
    .addStep({
      promptId: implementTemplate.getContent(),
      inputMapping: { plan: 'plan', language: 'language', code: 'code' },
      outputKey: 'improved',
    })
    .addStep({
      promptId: reviewTemplate.getContent(),
      inputMapping: { language: 'language', original: 'code', improved: 'improved' },
      outputKey: 'review',
    });

  // Execute the chain
  console.log('Starting coding improvement chain...');
  const result = await chain.execute();

  console.log('\nChain Results:');
  console.log('Analysis:', result.analysis);
  console.log('Plan:', result.plan);
  console.log('Improved Code:', result.improved);
  console.log('Review:', result.review);

  // Evaluate the final review
  const evaluator = new ResponseEvaluator();
  evaluator.addRubric('completeness', 1.0, (response) => {
    return response.length > 50 ? 0.9 : 0.3;
  });

  const evaluation = evaluator.evaluate(String(result.review), 'markdown');
  console.log('\nEvaluation:', evaluation);
}

runCodingChain().catch(console.error);
