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

    console.log(`[API PROXY] Routing action "${action}" to NextWave SMM`);

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

    const responseText = await response.text();
    if (!responseText || responseText.trim() === "") {
      console.error("[API PROXY ERROR] Received empty response from BuzzPlusSMM");
      return NextResponse.json(
        { error: "API returned an empty response" },
        { status: 502 }
      );
    }

    try {
      const data = JSON.parse(responseText);
      return NextResponse.json(data);
    } catch (parseError) {
      console.error("[API PROXY ERROR] Failed to parse JSON response. Raw body:", responseText);
      return NextResponse.json(
        { 
          error: "API returned invalid JSON response",
          details: responseText.slice(0, 500)
        },
        { status: 502 }
      );
    }
  } catch (error: unknown) {
    console.error("[API PROXY FATAL ERROR]:", error);
    const errMsg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: errMsg },
      { status: 500 }
    );
  }
}
