interface PromptSection {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export function toMarkdown(data: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    lines.push(`## ${key}`);
    if (Array.isArray(value)) {
      value.forEach((item) => lines.push(`- ${String(item)}`));
    } else if (typeof value === 'object' && value !== null) {
      lines.push('```json');
      lines.push(JSON.stringify(value, null, 2));
      lines.push('```');
    } else {
      lines.push(String(value));
    }
    lines.push('');
  }
  return lines.join('\n');
}

export function toJSON(data: unknown, pretty: boolean = true): string {
  return pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
}

export function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    const values = headers.map((h) => {
      const val = String(row[h] ?? '');
      return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
    });
    lines.push(values.join(','));
  }
  return lines.join('\n');
}

export function toXML(data: Record<string, unknown>, rootTag: string = 'data'): string {
  const serializeValue = (key: string, value: unknown, indent: number): string => {
    const pad = '  '.repeat(indent);
    if (Array.isArray(value)) {
      return value.map((v) => serializeValue(key, v, indent)).join('\n');
    }
    if (typeof value === 'object' && value !== null) {
      const inner = Object.entries(value as Record<string, unknown>)
        .map(([k, v]) => serializeValue(k, v, indent + 1))
        .join('\n');
      return `${pad}<${key}>\n${inner}\n${pad}</${key}>`;
    }
    return `${pad}<${key}>${String(value)}</${key}>`;
  };

  const body = Object.entries(data)
    .map(([k, v]) => serializeValue(k, v, 1))
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<${rootTag}>\n${body}\n</${rootTag}>`;
}

export function addSystemPrompt(userPrompt: string, systemPrompt: string): PromptSection[] {
  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
}

export function addContext(prompt: string, context: string | string[]): string {
  const contextBlock = Array.isArray(context) ? context.join('\n\n') : context;
  return `Context:\n${contextBlock}\n\n---\n\n${prompt}`;
}

export function addExamples(
  prompt: string,
  examples: Array<{ input: string; output: string }>
): string {
  const exampleBlock = examples
    .map((ex, i) => `Example ${i + 1}:\nInput: ${ex.input}\nOutput: ${ex.output}`)
    .join('\n\n');
  return `${exampleBlock}\n\n---\n\nNow, ${prompt}`;
}
