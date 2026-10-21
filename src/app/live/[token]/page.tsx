export default async function LiveLinkPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  await params;
  return null;
}
