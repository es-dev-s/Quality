import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getMyVisibleAgents } from "@/lib/actions/agent-assignment";
import { isAuthSessionError } from "@/lib/auth-errors";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAuth();
    const agents = await getMyVisibleAgents();
    return NextResponse.json(
      { agents, fetchedAt: new Date().toISOString() },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    if (isAuthSessionError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to load agents." }, { status: 500 });
  }
}
