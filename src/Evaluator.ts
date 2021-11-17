interface EvaluationResult {
  passed: boolean;
  score: number;
  checks: {
    name: string;
    passed: boolean;
    message: string;
  }[];
}

interface Rubric {
  criteria: string;
  weight: number;
  scorer: (response: string) => number;
}

export class ResponseEvaluator {
  private rubrics: Rubric[] = [];

  addRubric(criteria: string, weight: number, scorer: (response: string) => number): void {
    this.rubrics.push({ criteria, weight, scorer });
  }

  evaluate(response: string, expectedFormat?: string): EvaluationResult {
    const checks: EvaluationResult['checks'] = [];

    // Format compliance check
    if (expectedFormat) {
      const formatCheck = this.checkFormat(response, expectedFormat);
      checks.push(formatCheck);
    }

    // Length check
    checks.push(this.checkLength(response));

    // Structure check
    checks.push(this.checkStructure(response));

    // Hallucination pattern detection
    checks.push(this.detectHallucinations(response));

    // Rubric scoring
    let rubricScore = 1;
    if (this.rubrics.length > 0) {
      const totalWeight = this.rubrics.reduce((sum, r) => sum + r.weight, 0);
      rubricScore = this.rubrics.reduce((sum, rubric) => {
        const score = rubric.scorer(response);
        checks.push({
          name: `Rubric: ${rubric.criteria}`,
          passed: score >= 0.5,
          message: `Score: ${(score * 100).toFixed(0)}%`,
        });
        return sum + score * (rubric.weight / totalWeight);
      }, 0);
    }

    const passedChecks = checks.filter((c) => c.passed).length;
    const score = (passedChecks / checks.length + rubricScore) / 2;

    return {
      passed: score >= 0.6 && !checks.some((c) => c.name === 'Hallucination' && !c.passed),
      score,
      checks,
    };
  }

  extractStructuredData(response: string, fields: string[]): Record<string, string> {
    const data: Record<string, string> = {};

    for (const field of fields) {
      const patterns = [
        new RegExp(`${field}\\s*:\\s*(.+?)(?:\\n|$)`, 'i'),
        new RegExp(`\\*\\*${field}\\*\\*\\s*:\\s*(.+?)(?:\\n|$)`, 'i'),
        new RegExp(`"${field}"\\s*:\\s*"?(.+?)"?(?:[,}\\n])`, 'i'),
      ];

      for (const pattern of patterns) {
        const match = response.match(pattern);
        if (match) {
          data[field] = match[1].trim();
          break;
        }
      }
    }

    return data;
  }

  private checkFormat(response: string, format: string): EvaluationResult['checks'][0] {
    switch (format) {
      case 'json': {
        try {
          JSON.parse(response);
          return { name: 'Format (JSON)', passed: true, message: 'Valid JSON' };
        } catch {
          return { name: 'Format (JSON)', passed: false, message: 'Invalid JSON' };
        }
      }
      case 'markdown': {
        const hasHeaders = /^#{1,6}\s/m.test(response);
        return {
          name: 'Format (Markdown)',
          passed: hasHeaders,
          message: hasHeaders ? 'Contains markdown headers' : 'No markdown structure detected',
        };
      }
      case 'list': {
        const hasList = /^[-*\d.]\s/m.test(response);
        return {
          name: 'Format (List)',
          passed: hasList,
          message: hasList ? 'Contains list items' : 'No list structure detected',
        };
      }
      default:
        return { name: 'Format', passed: true, message: 'No format requirement' };
    }
  }

  private checkLength(response: string): EvaluationResult['checks'][0] {
    const words = response.split(/\s+/).length;
    const tooShort = words < 10;
    const tooLong = words > 5000;

    return {
      name: 'Length',
      passed: !tooShort && !tooLong,
      message: tooShort
        ? `Too short (${words} words)`
        : tooLong
          ? `Too long (${words} words)`
          : `Acceptable length (${words} words)`,
    };
  }

  private checkStructure(response: string): EvaluationResult['checks'][0] {
    const sentences = response.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const hasStructure = sentences.length >= 2;

    return {
      name: 'Structure',
      passed: hasStructure,
      message: hasStructure
        ? `${sentences.length} sentences detected`
        : 'Response lacks sentence structure',
    };
  }

  private detectHallucinations(response: string): EvaluationResult['checks'][0] {
    const hedgingPatterns = [
      /I think it (?:was|is) (?:around|approximately|maybe|probably)/i,
      /if I recall correctly/i,
      /I'm not (?:sure|certain) but/i,
      /as far as I (?:know|remember)/i,
    ];

    const fabricationPatterns = [
      /according to a \d{4} study by/i,
      /research published in .+ journal shows/i,
      /statistics show that exactly \d+\.\d+%/i,
    ];

    const hedgingMatches = hedgingPatterns.filter((p) => p.test(response));
    const fabricationMatches = fabricationPatterns.filter((p) => p.test(response));

    const suspicious = hedgingMatches.length + fabricationMatches.length;

    return {
      name: 'Hallucination',
      passed: suspicious === 0,
      message:
        suspicious === 0
          ? 'No hallucination patterns detected'
          : `${suspicious} potential hallucination pattern(s) found`,
    };
  }
}
