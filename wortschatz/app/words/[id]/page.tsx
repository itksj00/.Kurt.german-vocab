import WordForm from "../WordForm";

export default async function EditWordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const wordId = Number(id);

  return (
    <main className="site-main narrow">
      <WordForm wordId={wordId} />
    </main>
  );
}
