import { TEMPLATE_LIST } from "@/lib/domain/dashboards/templates";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const GET = route({}, async () => ({ templates: [...TEMPLATE_LIST, { id: "blank", name: "Blank", headline: "A *fresh* canvas", description: "Start empty and add widgets from the gallery." }] }));
