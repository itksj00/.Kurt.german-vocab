import WordForm from "../WordForm";

export default async function EditWordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const wordId = Number(id);

  return (
    <section>
      <WordForm wordId={wordId} />
    </section>
  );
}
