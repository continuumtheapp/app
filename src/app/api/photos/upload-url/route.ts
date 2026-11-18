import { createUploadUrl, photoKey, isAllowedPhotoType, idBucket, idCheckKey } from "@/lib/photos";
import { requireContactableUser, requireUser, authErrorResponse } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const { contentType, purpose } = (await request.json()) as {
      contentType?: string; purpose?: "listing" | "avatar" | "id-check";
    };
    // Anyone signed in may set a profile photo, even before they're approved:
    // admins look at the profile when deciding. Listing photos need a member.
    if (purpose === "avatar") await requireUser();
    else await requireContactableUser();

    if (!contentType || !isAllowedPhotoType(contentType)) {
      return Response.json({ error: "Only JPEG, PNG or WebP images." }, { status: 400 });
    }

    // ID photos and selfies go to the private bucket, never the public one.
    if (purpose === "id-check") {
      return Response.json(await createUploadUrl(idCheckKey(contentType), contentType, idBucket()));
    }

    // Keyed by a random id rather than a listing id: the listing may not exist
    // yet when photos are uploaded during creation.
    const key = photoKey(0, contentType)
      .replace("listings/0/", purpose === "avatar" ? "avatars/" : "uploads/");
    return Response.json(await createUploadUrl(key, contentType));
  } catch (error) {
    return authErrorResponse(error) ?? Response.json(
      { error: "Couldn't prepare the upload." }, { status: 500 },
    );
  }
}
