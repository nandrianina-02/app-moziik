import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Artist from "@/models/Artist";
import { withApiErrors } from "@/lib/apiError";

export const GET = withApiErrors(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search");

  await connectDB();
  const query = search ? { stageName: { $regex: search, $options: "i" } } : {};
  const artists = await Artist.find(query).select("stageName verified coverUrl").limit(20);

  return NextResponse.json({ artists });
});
