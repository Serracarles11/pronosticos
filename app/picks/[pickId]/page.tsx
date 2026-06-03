import { redirect } from "next/navigation";

export default async function PickPage({
  params,
}: {
  params: Promise<{ pickId: string }>;
}) {
  const { pickId } = await params;
  redirect(`/detalle?id=${encodeURIComponent(pickId)}`);
}
