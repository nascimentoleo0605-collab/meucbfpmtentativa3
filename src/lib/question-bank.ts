export const QUESTION_BANK_LIMIT = 1_500;
const QUESTION_PAGE_SIZE = 1_000;

type PageResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

export async function loadQuestionBank<T>(
  loadPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  const questions: T[] = [];

  for (let from = 0; from < QUESTION_BANK_LIMIT; from += QUESTION_PAGE_SIZE) {
    const to = Math.min(from + QUESTION_PAGE_SIZE - 1, QUESTION_BANK_LIMIT - 1);
    const { data, error } = await loadPage(from, to);
    if (error) throw new Error(error.message);

    const page = data ?? [];
    questions.push(...page);
    if (page.length < to - from + 1) break;
  }

  return questions.slice(0, QUESTION_BANK_LIMIT);
}