import { NextResponse } from "next/server";
import { CUMTA_DATASETS, CUMTA_CATALOG_META } from "@/lib/cumta-datasets";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    meta: CUMTA_CATALOG_META,
    datasets: CUMTA_DATASETS,
  });
}

