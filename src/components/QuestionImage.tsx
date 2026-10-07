import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getQuestionImageUrl } from "@/lib/question-image.functions";

export function QuestionImage({ path }: { path: string | null | undefined }) {
  const getImageUrl = useServerFn(getQuestionImageUrl);
  const { data } = useQuery({
    queryKey: ["question-image", path],
    enabled: !!path,
    queryFn: () => getImageUrl({ data: { path: path! } }),
    staleTime: 10 * 60 * 1000,
  });
  return data ? <img src={data} alt="Imagem da questão" className="my-4 max-h-96 max-w-full rounded-md object-contain" /> : null;
}