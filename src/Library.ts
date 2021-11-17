import { v4 as uuidv4 } from 'uuid';
import { Prompt, Variable } from './types';

interface LibraryEntry {
  prompt: Prompt;
  forks: string[];
  parent?: string;
}

const CATEGORIES = ['coding', 'writing', 'analysis', 'creative', 'data'] as const;
type Category = (typeof CATEGORIES)[number];

export class PromptLibrary {
  private entries: Map<string, LibraryEntry> = new Map();

  constructor() {
    this.seedDefaults();
  }

  add(
    content: string,
    category: Category,
    tags: string[],
    variables: Variable[] = [],
    description?: string
  ): string {
    const id = uuidv4();
    const prompt: Prompt = {
      id,
      content,
      variables,
      metadata: {
        category,
        tags,
        version: 1,
        author: description,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    this.entries.set(id, { prompt, forks: [] });
    return id;
  }

  get(id: string): Prompt | undefined {
    return this.entries.get(id)?.prompt;
  }

  search(query: string): Prompt[] {
    const terms = query.toLowerCase().split(/\s+/);
    return Array.from(this.entries.values())
      .filter(({ prompt }) => {
        const searchable = [
          prompt.content,
          prompt.metadata.category,
          ...prompt.metadata.tags,
        ]
          .join(' ')
          .toLowerCase();
        return terms.every((term) => searchable.includes(term));
      })
      .map(({ prompt }) => prompt);
  }

  searchByTag(tag: string): Prompt[] {
    return Array.from(this.entries.values())
      .filter(({ prompt }) =>
        prompt.metadata.tags.some((t) => t.toLowerCase() === tag.toLowerCase())
      )
      .map(({ prompt }) => prompt);
  }

  searchByCategory(category: Category): Prompt[] {
    return Array.from(this.entries.values())
      .filter(({ prompt }) => prompt.metadata.category === category)
      .map(({ prompt }) => prompt);
  }

  fork(id: string, modifications?: Partial<{ content: string; tags: string[] }>): string {
    const entry = this.entries.get(id);
    if (!entry) throw new Error(`Prompt ${id} not found`);

    const forkedId = uuidv4();
    const forkedPrompt: Prompt = {
      ...entry.prompt,
      id: forkedId,
      content: modifications?.content ?? entry.prompt.content,
      metadata: {
        ...entry.prompt.metadata,
        tags: modifications?.tags ?? [...entry.prompt.metadata.tags],
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    this.entries.set(forkedId, { prompt: forkedPrompt, forks: [], parent: id });
    entry.forks.push(forkedId);
    return forkedId;
  }

  update(id: string, content: string): void {
    const entry = this.entries.get(id);
    if (!entry) throw new Error(`Prompt ${id} not found`);
    entry.prompt.content = content;
    entry.prompt.metadata.version++;
    entry.prompt.metadata.updatedAt = new Date();
  }

  remove(id: string): boolean {
    return this.entries.delete(id);
  }

  export(): string {
    const data = Array.from(this.entries.entries()).map(([id, entry]) => ({
      id,
      ...entry,
    }));
    return JSON.stringify(data, null, 2);
  }

  import(json: string): number {
    const data = JSON.parse(json) as Array<{ id: string } & LibraryEntry>;
    let count = 0;
    for (const item of data) {
      if (!this.entries.has(item.id)) {
        this.entries.set(item.id, {
          prompt: item.prompt,
          forks: item.forks ?? [],
          parent: item.parent,
        });
        count++;
      }
    }
    return count;
  }

  list(): Prompt[] {
    return Array.from(this.entries.values()).map(({ prompt }) => prompt);
  }

  getCategories(): string[] {
    return [...CATEGORIES];
  }

  size(): number {
    return this.entries.size;
  }

  private seedDefaults(): void {
    this.add(
      'You are an expert {{language}} developer. Analyze the following code and suggest improvements:\n\n```{{language}}\n{{code}}\n```\n\nFocus on: performance, readability, and best practices.',
      'coding',
      ['code-review', 'refactoring'],
      [
        { name: 'language', required: true },
        { name: 'code', required: true },
      ]
    );

    this.add(
      'Write a {{tone}} {{format}} about {{topic}}. The target audience is {{audience}}. Length: approximately {{length}} words.',
      'writing',
      ['content', 'copywriting'],
      [
        { name: 'tone', required: true },
        { name: 'format', required: true },
        { name: 'topic', required: true },
        { name: 'audience', required: true },
        { name: 'length', required: true },
      ]
    );

    this.add(
      'Analyze the following data and provide insights:\n\n{{data}}\n\nFocus on: trends, anomalies, and actionable recommendations. Present findings in a structured format.',
      'analysis',
      ['data-analysis', 'insights'],
      [{ name: 'data', required: true }]
    );

    this.add(
      'Generate {{count}} creative {{type}} ideas for {{context}}. Each idea should be unique, feasible, and include a brief description of implementation.',
      'creative',
      ['brainstorm', 'ideation'],
      [
        { name: 'count', required: true },
        { name: 'type', required: true },
        { name: 'context', required: true },
      ]
    );

    this.add(
      'Transform the following {{inputFormat}} data into {{outputFormat}} format:\n\n{{data}}\n\nEnsure data integrity and proper escaping.',
      'data',
      ['transform', 'etl'],
      [
        { name: 'inputFormat', required: true },
        { name: 'outputFormat', required: true },
        { name: 'data', required: true },
      ]
    );
  }
}
