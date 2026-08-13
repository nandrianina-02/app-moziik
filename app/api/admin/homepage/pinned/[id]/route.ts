import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import HomepagePinned from "@/models/HomepagePinned";
import { requireAdmin } from "@/lib/requireAdmin";
import { ApiError, withApiErrors } from "@/lib/apiError";

export const DELETE = withApiErrors(async (_req: Request, { params }: { params: { id: string } }) => {
  await requireAdmin();
  await connectDB();
  const deleted = await HomepagePinned.findByIdAndDelete(params.id);
  if (!deleted) throw new ApiError("Contenu épinglé introuvable.", 404);
  return NextResponse.json({ success: true });
});
