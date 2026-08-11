type ModulePageProps = {
  params: Promise<{ slug: string }>;
};

const toTitle = (slug: string) =>
  slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

export default async function ModulePage({ params }: ModulePageProps) {
  const { slug } = await params;

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">{toTitle(slug)}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Module page is ready to connect with HRMS business components.
      </p>
    </section>
  );
}
