export type PastedQuestion = {
  sourceNumber: string;
  statement: string;
  options: string[];
  correct_index: number | null;
};

const questionLine = /^(?:quest[aã]o\s*)?(\d{1,4})\s*[.):º°\-–—]?\s*(.*)$/i;
const optionLine = /^\(?([a-f])\)?\s*[).:\-–—]\s*(.+)$/i;
const answerLine = /^(?:resposta(?:\s+correta)?|gabarito)\s*[:\-]\s*\(?([a-f])\)?\s*$/i;
const mark = /✅|✔️|✔|☑️|☑|\[x\]/gi;

export function parsePastedQuestions(text: string): PastedQuestion[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").map((line) => line.trim()).filter(Boolean);
  const found: PastedQuestion[] = [];
  let current: PastedQuestion | null = null;
  let lastOption = -1;
  let inAnswers = false;
  const answerKey = new Map<string, number>();

  const finish = () => {
    if (current && current.statement && current.options.length >= 2) found.push(current);
  };

  for (const line of lines) {
    if (/^(?:gabarito|respostas)\s*:?(?:\s|$)/i.test(line) && !answerLine.test(line)) {
      finish(); current = null; inAnswers = true;
    }
    if (inAnswers) {
      for (const match of line.matchAll(/(?:^|[\s,;])(?:quest[aã]o\s*)?(\d{1,4})\s*[-.):]?\s*\(?([a-f])\)?(?=$|[\s,;])/gi)) {
        if (match[1] && match[2]) answerKey.set(match[1], match[2].toUpperCase().charCodeAt(0) - 65);
      }
      continue;
    }
    const question = line.match(questionLine);
    if (question && !optionLine.test(line) && question[1]) {
      finish();
      current = { sourceNumber: question[1], statement: question[2] ?? "", options: [], correct_index: null };
      lastOption = -1;
      continue;
    }
    if (!current) continue;

    const option = line.match(optionLine);
    if (option?.[1] && option[2]) {
      const index = option[1].toUpperCase().charCodeAt(0) - 65;
      if (index !== current.options.length || index > 5) continue;
      const isCorrect = mark.test(option[2]);
      mark.lastIndex = 0;
      current.options.push(option[2].replace(mark, "").trim());
      if (isCorrect) current.correct_index = index;
      lastOption = index;
      continue;
    }

    const answer = line.match(answerLine);
    if (answer?.[1]) {
      current.correct_index = answer[1].toUpperCase().charCodeAt(0) - 65;
    } else if (lastOption >= 0) {
      current.options[lastOption] += ` ${line.replace(mark, "").trim()}`;
      if (mark.test(line)) current.correct_index = lastOption;
      mark.lastIndex = 0;
    } else {
      current.statement += `${current.statement ? " " : ""}${line}`;
    }
  }
  finish();
  return found.map((item) => {
    const keyIndex = answerKey.get(item.sourceNumber);
    return {
      ...item,
      correct_index: item.correct_index !== null && item.correct_index < item.options.length
        ? item.correct_index
        : keyIndex !== undefined && keyIndex < item.options.length ? keyIndex : null,
    };
  });
}