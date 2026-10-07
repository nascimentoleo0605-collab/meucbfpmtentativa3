import { parsePdfQuestions, type PdfQuestion } from "@/lib/pdf-question-parser";

const OPTION = /^([A-Fa-f])\s*[).:\-]\s*(.+)$/;
const ANSWER = /(?:resposta|gabarito|alternativa\s+correta)\s*[:\-]?\s*([A-Fa-f])\b/i;

// Photos commonly omit question numbers; supply one before using the PDF parser.
export function parseImageQuestion(text: string): PdfQuestion | null {
  const lines = text.replace(/\r/g, "\n").split("\n").map((line) => line.trim()).filter(Boolean);
  const start = lines.findIndex((line) => OPTION.test(line));
  if (start < 1) return null;
  const statement = lines.slice(0, start).join(" ").replace(/^(?:quest[aã]o\s*)?\d{1,4}\s*[.)º°:\-]\s*/i, "").trim();
  const options: string[] = [];
  let correct_index: number | null = null;
  let tail = false;
  for (const line of lines.slice(start)) {
    const answer = line.match(ANSWER)?.[1];
    if (answer) { correct_index = answer.toUpperCase().charCodeAt(0) - 65; tail = true; continue; }
    if (tail) continue;
    const match = line.match(OPTION);
    if (match?.[1] && match[2] && match[1].toUpperCase().charCodeAt(0) - 65 === options.length) {
      options.push(match[2]);
    } else if (options.length) options[options.length - 1] += ` ${line}`;
  }
  if (!statement || options.length < 2) return parsePdfQuestions(text)[0] ?? null;
  return { sourceNumber: "1", statement, options, correct_index: correct_index !== null && correct_index < options.length ? correct_index : null, explanation: "" };
}