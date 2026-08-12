import { NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    github: Boolean(process.env.GITHUB_TOKEN),
    githubOrg: process.env.GITHUB_ORG || null,
    vercel: Boolean(process.env.VERCEL_TOKEN),
    vercelTeam: Boolean(process.env.VERCEL_TEAM_ID),
  });
}
