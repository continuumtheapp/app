import { createUploadUrl, photoKey, isAllowedPhotoType } from "@/lib/photos";
import { requireContactableUser, authErrorResponse } from "@/lib/session";

export async function POST(request: Request) {
  try {
    await requireContactableUser();

    const { contentType } = (await request.json()) as { contentType?: string };
    if (!contentType || !isAllowedPhotoType(contentType)) {
      return Response.json({ error: "Only JPEG, PNG or WebP images." }, { status: 400 });
    }

    // Keyed by a random id rather than a listing id: the listing may not exist
    // yet when photos are uploaded during creation.
    const key = photoKey(0, contentType).replace("listings/0/", "uploads/");
    return Response.json(await createUploadUrl(key, contentType));
  } catch (error) {
    return authErrorResponse(error) ?? Response.json(
      { error: "Couldn't prepare the upload." }, { status: 500 },
    );
  }
}
