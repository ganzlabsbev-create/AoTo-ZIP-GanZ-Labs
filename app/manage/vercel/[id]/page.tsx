import { redirect } from "next/navigation";

export default function VercelProjectIndex({ params }: { params: { id: string } }) {
  redirect(`/manage/vercel/${params.id}/deployments`);
}
