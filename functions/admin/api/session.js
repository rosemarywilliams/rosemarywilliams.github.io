import { requireAdmin } from "../../_lib/access.js";
import { handleError, json } from "../../_lib/http.js";

export async function onRequestGet(context) {
  try {
    const administrator = await requireAdmin(context);
    return json(
      { email: administrator.email },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return handleError(error, context.request, "admin_session");
  }
}
