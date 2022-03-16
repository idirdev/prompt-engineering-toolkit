import { describe, it, expect } from 'vitest';
import { PromptTemplate } from '../src/Template';
import { PromptChain } from '../src/Chain';
import { PromptLibrary } from '../src/Library';
import {
  toMarkdown,
  toJSON,
  toCSV,
  toXML,
  addSystemPrompt,
  addContext,
  addExamples,
} from '../src/Formatter';

describe('PromptTemplate', () => {
  it('should create a template and fill variables', () => {
    const template = new PromptTemplate({
      name: 'greeting',
      template: 'Hello, {{name}}! Welcome to {{place}}.',
      variables: [
        { name: 'name', required: true },
        { name: 'place', required: true },
      ],
    });
    const result = template.fill({ name: 'Alice', place: 'Wonderland' });
    expect(result).toBe('Hello, Alice! Welcome to Wonderland.');
  });

  it('should throw for missing required variables', () => {
    const template = new PromptTemplate({
      name: 'test',
      template: 'Hello {{name}}',
      variables: [{ name: 'name', required: true }],
    });
    expect(() => template.fill({})).toThrow('Missing required variables: name');
  });

  it('should apply default values for unset variables', () => {
    const template = new PromptTemplate({
      name: 'test',
      template: 'Hello {{name}}, role: {{role}}',
      variables: [
        { name: 'name', required: true },
        { name: 'role', required: false, defaultValue: 'user' },
      ],
    });
    const result = template.fill({ name: 'Bob' });
    expect(result).toBe('Hello Bob, role: user');
  });

  it('should create a template from a string with auto-detected variables', () => {
    const template = PromptTemplate.fromString('Translate {{text}} to {{language}}');
    const vars = template.getVariables();
    expect(vars).toHaveLength(2);
    expect(vars.map((v) => v.name).sort()).toEqual(['language', 'text']);
    expect(vars.every((v) => v.required)).toBe(true);
  });

  it('should process conditionals (if blocks)', () => {
    const template = new PromptTemplate({
      name: 'conditional',
      template: 'Hello{{#if title}} {{title}}{{/if}} {{name}}',
      variables: [
        { name: 'title', required: false },
        { name: 'name', required: true },
      ],
    });
    const withTitle = template.fill({ name: 'Smith', title: 'Dr.' });
    expect(withTitle).toBe('Hello Dr. Smith');

    const template2 = new PromptTemplate({
      name: 'conditional2',
      template: 'Hello{{#if title}} {{title}}{{/if}} {{name}}',
      variables: [
        { name: 'title', required: false },
        { name: 'name', required: true },
      ],
    });
    const withoutTitle = template2.fill({ name: 'Smith' });
    expect(withoutTitle).toBe('Hello Smith');
  });

  it('should process loops (each blocks)', () => {
    const template = new PromptTemplate({
      name: 'loop',
      template: 'Items: {{#each items}}[{{this}}]{{/each}}',
      variables: [{ name: 'items', required: true }],
    });
    const result = template.fill({ items: 'apple, banana, cherry' });
    expect(result).toBe('Items: [apple][banana][cherry]');
  });

  it('should partially fill a template', () => {
    const template = new PromptTemplate({
      name: 'partial',
      template: '{{greeting}}, {{name}}!',
      variables: [
        { name: 'greeting', required: true },
        { name: 'name', required: true },
      ],
    });
    const partial = template.partialFill({ greeting: 'Hi' });
    expect(partial.getContent()).toBe('Hi, {{name}}!');
    expect(partial.getVariables()).toHaveLength(1);
    expect(partial.getVariables()[0].name).toBe('name');
  });

  it('should compose two templates', () => {
    const t1 = new PromptTemplate({
      name: 'first',
      template: 'System: {{role}}',
      variables: [{ name: 'role', required: true }],
    });
    const t2 = new PromptTemplate({
      name: 'second',
      template: 'Task: {{task}}',
      variables: [{ name: 'task', required: true }],
    });
    const composed = t1.compose(t2);
    expect(composed.getContent()).toContain('System: {{role}}');
    expect(composed.getContent()).toContain('Task: {{task}}');
    expect(composed.getVariables()).toHaveLength(2);
  });

  it('should validate variables with custom validator', () => {
    const template = new PromptTemplate({
      name: 'validated',
      template: 'Count: {{count}}',
      variables: [
        { name: 'count', required: true, validator: (v) => !isNaN(Number(v)) },
      ],
    });
    expect(() => template.fill({ count: 'abc' })).toThrow('Invalid values for: count');
    const result = template.fill({ count: '42' });
    expect(result).toBe('Count: 42');
  });

  it('should expose metadata', () => {
    const template = new PromptTemplate({
      name: 'test',
      template: 'Hello',
      variables: [],
      category: 'testing',
      tags: ['unit', 'example'],
    });
    const meta = template.getMetadata();
    expect(meta.category).toBe('testing');
    expect(meta.tags).toEqual(['unit', 'example']);
    expect(meta.version).toBe(1);
  });

  it('should have a unique ID', () => {
    const t1 = new PromptTemplate({ name: 'a', template: 'A', variables: [] });
    const t2 = new PromptTemplate({ name: 'b', template: 'B', variables: [] });
    expect(t1.getId()).not.toBe(t2.getId());
  });
});

describe('PromptChain', () => {
  it('should add steps and retrieve them', () => {
    const executor = async (prompt: string) => ({
      text: 'response',
      model: 'test',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      finishReason: 'stop',
      latencyMs: 0,
    });

    const chain = new PromptChain('test-chain', executor);
    chain.addStep({
      promptId: 'Generate a {{topic}} outline',
      inputMapping: { topic: 'subject' },
      outputKey: 'outline',
    });
    chain.addStep({
      promptId: 'Expand on: {{outline}}',
      inputMapping: { outline: 'outline' },
      outputKey: 'expanded',
    });

    const steps = chain.getSteps();
    expect(steps).toHaveLength(2);
    expect(steps[0].outputKey).toBe('outline');
    expect(steps[1].outputKey).toBe('expanded');
  });

  it('should execute steps sequentially', async () => {
    const responses = ['outline result', 'expanded result'];
    let callCount = 0;
    const executor = async (prompt: string) => {
      const text = responses[callCount++];
      return {
        text,
        model: 'test',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        finishReason: 'stop',
        latencyMs: 5,
      };
    };

    const chain = new PromptChain('test', executor);
    chain.setContext({ subject: 'AI' });
    chain.addStep({
      promptId: 'Create outline for {{topic}}',
      inputMapping: { topic: 'subject' },
      outputKey: 'outline',
    });

    const result = await chain.execute();
    expect(result.outline).toBe('outline result');
  });

  it('should set and get context', () => {
    const chain = new PromptChain('test', async () => ({
      text: '', model: '', usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      finishReason: '', latencyMs: 0,
    }));
    chain.setContext({ key1: 'value1' });
    chain.setContext({ key2: 'value2' });
    const ctx = chain.getContext();
    expect(ctx.key1).toBe('value1');
    expect(ctx.key2).toBe('value2');
  });

  it('should support skip error strategy', async () => {
    let callCount = 0;
    const executor = async (prompt: string) => {
      callCount++;
      if (callCount === 1) throw new Error('fail');
      return {
        text: 'success',
        model: 'test',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        finishReason: 'stop',
        latencyMs: 0,
      };
    };

    const chain = new PromptChain('test', executor);
    chain.setErrorStrategy('skip');
    chain.addStep({
      promptId: 'step1',
      inputMapping: {},
      outputKey: 'result1',
    });
    chain.addStep({
      promptId: 'step2',
      inputMapping: {},
      outputKey: 'result2',
    });

    const result = await chain.execute();
    // First step fails (skipped), second succeeds
    expect(result.result2).toBe('success');
  });
});

describe('PromptLibrary', () => {
  it('should initialize with seed prompts', () => {
    const lib = new PromptLibrary();
    expect(lib.size()).toBeGreaterThan(0);
  });

  it('should add and retrieve prompts', () => {
    const lib = new PromptLibrary();
    const id = lib.add('Test prompt', 'coding', ['test']);
    const prompt = lib.get(id);
    expect(prompt).toBeDefined();
    expect(prompt!.content).toBe('Test prompt');
    expect(prompt!.metadata.category).toBe('coding');
  });

  it('should search prompts by text', () => {
    const lib = new PromptLibrary();
    const results = lib.search('code');
    expect(results.length).toBeGreaterThan(0);
  });

  it('should search by tag', () => {
    const lib = new PromptLibrary();
    const results = lib.searchByTag('code-review');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].metadata.tags).toContain('code-review');
  });

  it('should search by category', () => {
    const lib = new PromptLibrary();
    const results = lib.searchByCategory('writing');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].metadata.category).toBe('writing');
  });

  it('should fork a prompt', () => {
    const lib = new PromptLibrary();
    const originalId = lib.add('Original prompt', 'coding', ['original']);
    const forkedId = lib.fork(originalId, { content: 'Forked prompt' });
    const forked = lib.get(forkedId);
    expect(forked).toBeDefined();
    expect(forked!.content).toBe('Forked prompt');
  });

  it('should update a prompt', () => {
    const lib = new PromptLibrary();
    const id = lib.add('V1 prompt', 'coding', ['test']);
    lib.update(id, 'V2 prompt');
    const updated = lib.get(id);
    expect(updated!.content).toBe('V2 prompt');
    expect(updated!.metadata.version).toBe(2);
  });

  it('should remove a prompt', () => {
    const lib = new PromptLibrary();
    const id = lib.add('To delete', 'coding', ['test']);
    expect(lib.remove(id)).toBe(true);
    expect(lib.get(id)).toBeUndefined();
  });

  it('should export and import prompts', () => {
    const lib = new PromptLibrary();
    const id = lib.add('Export me', 'creative', ['export']);
    const json = lib.export();

    const lib2 = new PromptLibrary();
    const initialSize = lib2.size();
    const imported = lib2.import(json);
    expect(imported).toBeGreaterThan(0);
    expect(lib2.size()).toBeGreaterThan(initialSize);
  });

  it('should list all prompts', () => {
    const lib = new PromptLibrary();
    const all = lib.list();
    expect(all.length).toBe(lib.size());
  });

  it('should return available categories', () => {
    const lib = new PromptLibrary();
    const categories = lib.getCategories();
    expect(categories).toContain('coding');
    expect(categories).toContain('writing');
    expect(categories).toContain('analysis');
    expect(categories).toContain('creative');
    expect(categories).toContain('data');
  });
});

describe('Formatter', () => {
  describe('toMarkdown', () => {
    it('should format key-value pairs as markdown', () => {
      const md = toMarkdown({ title: 'Test', description: 'A test' });
      expect(md).toContain('## title');
      expect(md).toContain('Test');
      expect(md).toContain('## description');
    });

    it('should format arrays as bullet lists', () => {
      const md = toMarkdown({ items: ['one', 'two', 'three'] });
      expect(md).toContain('- one');
      expect(md).toContain('- two');
      expect(md).toContain('- three');
    });

    it('should format objects as JSON code blocks', () => {
      const md = toMarkdown({ config: { key: 'value' } });
      expect(md).toContain('```json');
      expect(md).toContain('"key": "value"');
    });
  });

  describe('toJSON', () => {
    it('should pretty-print by default', () => {
      const json = toJSON({ a: 1 });
      expect(json).toBe(JSON.stringify({ a: 1 }, null, 2));
    });

    it('should produce compact JSON when pretty=false', () => {
      const json = toJSON({ a: 1 }, false);
      expect(json).toBe('{"a":1}');
    });
  });

  describe('toCSV', () => {
    it('should convert an array of objects to CSV', () => {
      const csv = toCSV([
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ]);
      expect(csv).toContain('name,age');
      expect(csv).toContain('Alice,30');
      expect(csv).toContain('Bob,25');
    });

    it('should handle empty arrays', () => {
      expect(toCSV([])).toBe('');
    });

    it('should quote values containing commas', () => {
      const csv = toCSV([{ name: 'Smith, John', age: 40 }]);
      expect(csv).toContain('"Smith, John"');
    });
  });

  describe('toXML', () => {
    it('should generate valid XML', () => {
      const xml = toXML({ name: 'Test', value: 42 });
      expect(xml).toContain('<?xml version="1.0"');
      expect(xml).toContain('<data>');
      expect(xml).toContain('<name>Test</name>');
      expect(xml).toContain('<value>42</value>');
      expect(xml).toContain('</data>');
    });

    it('should support custom root tags', () => {
      const xml = toXML({ key: 'value' }, 'root');
      expect(xml).toContain('<root>');
      expect(xml).toContain('</root>');
    });
  });

  describe('addSystemPrompt', () => {
    it('should create system and user message sections', () => {
      const sections = addSystemPrompt('What is AI?', 'You are a helpful assistant.');
      expect(sections).toHaveLength(2);
      expect(sections[0].role).toBe('system');
      expect(sections[0].content).toBe('You are a helpful assistant.');
      expect(sections[1].role).toBe('user');
      expect(sections[1].content).toBe('What is AI?');
    });
  });

  describe('addContext', () => {
    it('should prepend context to a prompt', () => {
      const result = addContext('Summarize this.', 'The sky is blue.');
      expect(result).toContain('Context:');
      expect(result).toContain('The sky is blue.');
      expect(result).toContain('Summarize this.');
    });

    it('should join array contexts', () => {
      const result = addContext('Summarize.', ['Fact 1', 'Fact 2']);
      expect(result).toContain('Fact 1');
      expect(result).toContain('Fact 2');
    });
  });

  describe('addExamples', () => {
    it('should prepend examples to a prompt', () => {
      const result = addExamples('do the task', [
        { input: 'Hello', output: 'Hi' },
        { input: 'Bye', output: 'Goodbye' },
      ]);
      expect(result).toContain('Example 1:');
      expect(result).toContain('Input: Hello');
      expect(result).toContain('Output: Hi');
      expect(result).toContain('Example 2:');
      expect(result).toContain('do the task');
    });
  });
});
