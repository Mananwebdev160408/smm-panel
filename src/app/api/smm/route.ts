import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, key, ...rest } = body;

    if (!key) {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 400 }
      );
    }

    if (!action) {
      return NextResponse.json(
        { error: "Action is required" },
        { status: 400 }
      );
    }

    // Build standard urlencoded form parameters
    const params = new URLSearchParams();
    params.append("key", key);
    params.append("action", action);

    // Append all other properties
    for (const [paramKey, val] of Object.entries(rest)) {
      if (val !== undefined && val !== null) {
        params.append(paramKey, String(val));
      }
    }

    console.log(`[API PROXY] Routing action "${action}" to NextWaveSMM`);

    const response = await fetch("https://buzzplussmm.com/api/v2", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/4.0 (compatible; MSIE 5.01; Windows NT 5.0)"
      },
      body: params.toString(),
      cache: "no-store", // disable Next.js page level caching
    });

    if (!response.ok) {
      const textErr = await response.text();
      console.error(`[API PROXY ERROR] HTTP status ${response.status}:`, textErr);
      return NextResponse.json(
        { error: `API responded with HTTP status ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error("[API PROXY FATAL ERROR]:", error);
    const errMsg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: errMsg },
      { status: 500 }
    );
  }
}
