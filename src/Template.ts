import { v4 as uuidv4 } from 'uuid';
import { Prompt, Variable, PromptTemplateConfig } from './types';

export class PromptTemplate {
  private prompt: Prompt;

  constructor(config: PromptTemplateConfig) {
    this.prompt = {
      id: uuidv4(),
      content: config.template,
      variables: config.variables,
      metadata: {
        category: config.category ?? 'general',
        tags: config.tags ?? [],
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
  }

  static fromString(template: string): PromptTemplate {
    const variableRegex = /\{\{(\w+)\}\}/g;
    const variables: Variable[] = [];
    const seen = new Set<string>();
    let match: RegExpExecArray | null;

    while ((match = variableRegex.exec(template)) !== null) {
      const name = match[1];
      if (!seen.has(name)) {
        seen.add(name);
        variables.push({ name, required: true });
      }
    }

    return new PromptTemplate({ name: 'untitled', template, variables });
  }

  fill(vars: Record<string, string>): string {
    this.validate(vars);
    let result = this.prompt.content;

    // Process conditionals: {{#if var}}...{{/if}}
    result = this.processConditionals(result, vars);

    // Process loops: {{#each items}}...{{/each}}
    result = this.processLoops(result, vars);

    // Replace simple variables
    for (const [key, value] of Object.entries(vars)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }

    // Apply defaults for remaining variables
    for (const variable of this.prompt.variables) {
      if (variable.defaultValue) {
        result = result.replace(
          new RegExp(`\\{\\{${variable.name}\\}\\}`, 'g'),
          variable.defaultValue
        );
      }
    }

    return result;
  }

  validate(vars: Record<string, string>): { valid: boolean; missing: string[] } {
    const missing = this.prompt.variables
      .filter((v) => v.required && !(v.name in vars) && !v.defaultValue)
      .map((v) => v.name);

    const invalid = this.prompt.variables.filter(
      (v) => v.validator && vars[v.name] && !v.validator(vars[v.name])
    );

    if (missing.length > 0) {
      throw new Error(`Missing required variables: ${missing.join(', ')}`);
    }
    if (invalid.length > 0) {
      throw new Error(`Invalid values for: ${invalid.map((v) => v.name).join(', ')}`);
    }

    return { valid: true, missing: [] };
  }

  partialFill(vars: Record<string, string>): PromptTemplate {
    let result = this.prompt.content;
    for (const [key, value] of Object.entries(vars)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }

    const remaining = this.prompt.variables.filter((v) => !(v.name in vars));
    return new PromptTemplate({
      name: `partial-${this.prompt.id}`,
      template: result,
      variables: remaining,
      category: this.prompt.metadata.category,
      tags: this.prompt.metadata.tags,
    });
  }

  compose(other: PromptTemplate, separator: string = '\n\n'): PromptTemplate {
    const combinedVars = [...this.prompt.variables];
    for (const v of other.prompt.variables) {
      if (!combinedVars.find((cv) => cv.name === v.name)) {
        combinedVars.push(v);
      }
    }

    return new PromptTemplate({
      name: `composed-${this.prompt.id}-${other.prompt.id}`,
      template: `${this.prompt.content}${separator}${other.prompt.content}`,
      variables: combinedVars,
    });
  }

  private processConditionals(template: string, vars: Record<string, string>): string {
    const conditionalRegex = /\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
    return template.replace(conditionalRegex, (_match, varName, content) => {
      return vars[varName] ? content : '';
    });
  }

  private processLoops(template: string, vars: Record<string, string>): string {
    const loopRegex = /\{\{#each (\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
    return template.replace(loopRegex, (_match, varName, content) => {
      const items = vars[varName];
      if (!items) return '';
      const list = items.split(',').map((s) => s.trim());
      return list.map((item) => content.replace(/\{\{this\}\}/g, item)).join('');
    });
  }

  getId(): string {
    return this.prompt.id;
  }

  getContent(): string {
    return this.prompt.content;
  }

  getVariables(): Variable[] {
    return [...this.prompt.variables];
  }

  getMetadata(): Prompt['metadata'] {
    return { ...this.prompt.metadata };
  }
}
