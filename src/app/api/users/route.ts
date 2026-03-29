import { clerkClient } from "@clerk/nextjs/server";
import { getAuthContext, jsonResponse, errorResponse } from "@/lib/api-utils";
import { NextRequest } from "next/server";

// GET /api/users?ids=id1,id2,...
// Returns basic public user info for the given Clerk user IDs.
export async function GET(request: NextRequest) {
  try {
    await getAuthContext(); // ensure caller is authenticated
    const ids = request.nextUrl.searchParams.get("ids");
    if (!ids) return jsonResponse([]);

    const userIds = ids.split(",").filter(Boolean).slice(0, 50); // cap at 50
    const client = await clerkClient();
    const users = await client.users.getUserList({ userId: userIds, limit: 50 });

    const result = users.data.map((u) => ({
      id: u.id,
      name: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.emailAddresses[0]?.emailAddress || u.id,
      imageUrl: u.imageUrl,
    }));

    return jsonResponse(result);
  } catch {
    return errorResponse("Unauthorized", 401);
  }
}
