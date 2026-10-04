import PatternForm from "../PatternForm";

export default async function EditPatternPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="site-main narrow">
      <PatternForm patternId={Number(id)} />
    </main>
  );
}
