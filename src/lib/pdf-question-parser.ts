export type PdfQuestion = {
  sourceNumber: string;
  statement: string;
  options: string[];
  correct_index: number | null;
  explanation: string;
};

const QUESTION = /^(?:(?:quest[aã]o|quest(?:ion)?)[\s.:º°-]*)?(\d{1,4})\s*(?:[.)º°:\-]|–|—)\s*(.*)$/i;
const OPTION = /^(?:alternativa\s+)?\(?([A-Fa-f])\)?\s*(?:[).:\-]|–|—)\s*(.+)$/i;
const INLINE_ANSWER = /(?:resposta|gabarito|alternativa\s+correta|resposta\s+correta)\s*[:\-]?\s*\(?([A-Fa-f])\)?\b/i;

function cleanLine(line: string) {
  return line.replace(/\s+/g, " ").trim();
}

function normalizeLayout(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(/[\u00a0\u2007\u202f]/g, " ")
    .replace(/([^\n])\s+(?=(?:quest[aã]o\s*)?\d{1,4}\s*(?:[.)º°:\-]|–|—)\s+)/gi, "$1\n")
    .replace(/([^\n])\s+(?=(?:alternativa\s+\(?[A-F]\)?|(?<!alternativa\s)\(?[A-F]\)?)\s*(?:[).:\-]|–|—)\s+)/gi, "$1\n")
    .replace(/([^\n])\s+(?=(?:resposta|alternativa\s+correta)\s*[:\-])/gi, "$1\n");
}

function collectAnswerKey(lines: string[]) {
  const answers = new Map<string, string>();
  let inKey = false;

  for (const rawLine of lines) {
    const line = cleanLine(rawLine);
    if (/^(?:gabarito|respostas?)\b/i.test(line)) inKey = true;
    if (!inKey) continue;

    for (const match of line.matchAll(/(?:^|\s|[;,|])(?:quest[aã]o\s*)?(\d{1,4})\s*[-.):]?\s*\(?([A-Fa-f])\)?(?=\s|$|[;,|])/gi)) {
      const number = match[1];
      const answer = match[2];
      if (number && answer) answers.set(number, answer.toUpperCase());
    }
  }
  return answers;
}

export function parsePdfQuestions(text: string): PdfQuestion[] {
  const lines = normalizeLayout(text)
    .split("\n")
    .map(cleanLine)
    .filter(Boolean);
  const answerKey = collectAnswerKey(lines);
  const questions: PdfQuestion[] = [];
  let current: PdfQuestion | null = null;
  let optionIndex = -1;
  let readingKey = false;

  const finish = () => {
    if (!current || current.options.length < 2 || !current.statement.trim()) return;
    const keyed = answerKey.get(current.sourceNumber);
    if (current.correct_index === null && keyed) {
      const index = keyed.charCodeAt(0) - 65;
      current.correct_index = index < current.options.length ? index : null;
    }
    questions.push(current);
  };

  for (const line of lines) {
    if (/^(?:gabarito|respostas?)\b/i.test(line) && !INLINE_ANSWER.test(line)) {
      readingKey = true;
      continue;
    }
    if (readingKey) continue;

    const question = line.match(QUESTION);
    if (question && !OPTION.test(line)) {
      const sourceNumber = question[1];
      const statement = question[2];
      if (!sourceNumber) continue;
      finish();
      current = {
        sourceNumber,
        statement: statement ?? "",
        options: [],
        correct_index: null,
        explanation: "",
      };
      optionIndex = -1;
      continue;
    }
    if (!current) continue;

    const option = line.match(OPTION);
    if (option) {
      const optionLetter = option[1];
      const optionText = option[2];
      if (!optionLetter || !optionText) continue;
      optionIndex = optionLetter.toUpperCase().charCodeAt(0) - 65;
      if (optionIndex === current.options.length && current.options.length < 6) {
        current.options.push(optionText);
      }
      const inline = optionText.match(INLINE_ANSWER);
      const inlineLetter = inline?.[1];
      if (inlineLetter) current.correct_index = inlineLetter.toUpperCase().charCodeAt(0) - 65;
      continue;
    }

    const inline = line.match(INLINE_ANSWER);
    const inlineLetter = inline?.[1];
    if (inlineLetter) {
      const index = inlineLetter.toUpperCase().charCodeAt(0) - 65;
      current.correct_index = index < current.options.length ? index : null;
      current.explanation = line.replace(INLINE_ANSWER, "").trim();
    } else if (optionIndex >= 0 && optionIndex < current.options.length) {
      current.options[optionIndex] = `${current.options[optionIndex]} ${line}`.trim();
    } else {
      current.statement = `${current.statement} ${line}`.trim();
    }
  }

  finish();
  return questions;
}