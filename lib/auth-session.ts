import { cache } from "react";
import { auth } from "@/lib/auth";

/** Dedupes session reads within the same server request (layout + page). */
export const getServerSession = cache(async () => auth());
