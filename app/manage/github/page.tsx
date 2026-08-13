import { redirect } from "next/navigation";

export default function GithubRepoIndex({
  searchParams,
}: {
  searchParams: { owner?: string; repo?: string; branch?: string };
}) {
  const owner = searchParams.owner || "";
  const repo = searchParams.repo || "";
  const branch = searchParams.branch || "main";
  redirect(
    `/manage/github/files?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(branch)}`
  );
}
