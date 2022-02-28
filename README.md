# prompt-engineering-toolkit

> Lab project — experimenting with prompt patterns, evaluation, and chaining strategies.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

A comprehensive TypeScript toolkit for engineering, testing, and optimizing AI prompts. Build robust prompt templates, chain them together, optimize with A/B testing, and maintain a categorized library.

## Features

- **Template Engine** - Variable interpolation with `{{variables}}`, conditionals, loops
- **Prompt Chains** - Pipe outputs between prompts with branching and parallel execution
- **A/B Optimizer** - Test variations, score responses, track metrics
- **Prompt Library** - Categorized templates with search, versioning, and forking
- **Response Evaluator** - Format compliance, hallucination detection, rubric scoring
- **Format Helpers** - Convert to Markdown, JSON, CSV, XML; add context and few-shot examples

## Installation

```bash
npm install prompt-engineering-toolkit
```

## Quick Start

### Template Syntax

```typescript
import { PromptTemplate } from 'prompt-engineering-toolkit';

// Create from string - variables auto-detected
const template = PromptTemplate.fromString(
  'Write a {{tone}} email about {{topic}} for {{audience}}'
);

// Fill all variables
const prompt = template.fill({
  tone: 'professional',
  topic: 'quarterly results',
  audience: 'stakeholders',
});

// Partial fill - returns a new template with remaining variables
const partial = template.partialFill({ tone: 'casual' });
```

### Conditionals and Loops

```typescript
const template = PromptTemplate.fromString(`
Analyze this code:
{{code}}

{{#if language}}Language: {{language}}{{/if}}

Focus areas:
{{#each areas}}
- {{this}}
{{/each}}
`);

const result = template.fill({
  code: 'const x = 42;',
  language: 'TypeScript',
  areas: 'performance, readability, security',
});
```

### Prompt Chains

```typescript
import { PromptChain } from 'prompt-engineering-toolkit';

const chain = new PromptChain('analyze-and-fix', executor)
  .setContext({ code: myCode, language: 'TypeScript' })
  .addStep({
    promptId: 'Analyze: {{code}}',
    inputMapping: { code: 'code' },
    outputKey: 'analysis',
  })
  .addStep({
    promptId: 'Fix based on: {{analysis}}',
    inputMapping: { analysis: 'analysis' },
    outputKey: 'fixedCode',
  });

const result = await chain.execute();
console.log(result.fixedCode);
```

### Prompt Library

Built-in categories with search and versioning:

| Category   | Description                        |
|------------|------------------------------------|
| `coding`   | Code review, refactoring, debugging |
| `writing`  | Content creation, copywriting       |
| `analysis` | Data analysis, insights             |
| `creative` | Brainstorming, ideation             |
| `data`     | Data transformation, ETL            |

```typescript
import { PromptLibrary } from 'prompt-engineering-toolkit';

const library = new PromptLibrary(); // Includes seed templates

// Search by tag
const codingPrompts = library.searchByTag('code-review');

// Fork and customize
const forkedId = library.fork(originalId, {
  content: 'Modified prompt...',
  tags: ['custom', 'v2'],
});

// Export/import
const json = library.export();
library.import(json);
```

### A/B Testing

```typescript
import { PromptOptimizer } from 'prompt-engineering-toolkit';

const optimizer = new PromptOptimizer(executor);

optimizer.addVariation('v1', 'Explain {{topic}} simply');
optimizer.addVariation('v2', 'Explain {{topic}} step by step with examples');

const result = await optimizer.abTest('v1', 'v2', { model: 'gpt-4' }, 5);
console.log(`Winner: ${result.winner}`);

const suggestions = optimizer.suggestImprovements('v1');
```

### Format Helpers

```typescript
import { addExamples, addContext, toMarkdown } from 'prompt-engineering-toolkit';

// Few-shot examples
const prompt = addExamples('Classify this text', [
  { input: 'Great product!', output: 'positive' },
  { input: 'Terrible service', output: 'negative' },
]);

// Add context
const withContext = addContext('Answer the question', [
  'The company was founded in 2020',
  'Revenue grew 50% YoY',
]);
```

## API Reference

### PromptTemplate

| Method | Description |
|--------|-------------|
| `fromString(template)` | Create template with auto-detected variables |
| `fill(vars)` | Fill all variables and return string |
| `validate(vars)` | Check for missing required variables |
| `partialFill(vars)` | Fill some variables, return new template |
| `compose(other)` | Combine two templates |

### PromptChain

| Method | Description |
|--------|-------------|
| `addStep(step)` | Add a step to the chain |
| `setErrorStrategy(strategy)` | Set error handling: stop, skip, retry |
| `execute()` | Run all steps and return context |

### ResponseEvaluator

| Method | Description |
|--------|-------------|
| `evaluate(response, format?)` | Run all checks on a response |
| `extractStructuredData(response, fields)` | Pull structured data from text |
| `addRubric(criteria, weight, scorer)` | Add custom scoring rubric |

## License

MIT
