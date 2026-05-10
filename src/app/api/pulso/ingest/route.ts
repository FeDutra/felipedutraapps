import { NextRequest, NextResponse } from "next/server";
import { ingestionService } from "@/apps/pulso/services/ingestionService";
import crypto from "crypto";

/**
 * @api POST /api/pulso/ingest
 * @description Secure ingestion endpoint for OpenClaw/Lótus
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Basic Auth Validation (Bearer Token)
    const authHeader = req.headers.get("Authorization");
    const serverToken = process.env.PULSO_INGEST_TOKEN;

    if (!serverToken || authHeader !== `Bearer ${serverToken}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Body Parsing
    const body = await req.json();

    // 3. HMAC Signature Validation (Optional but prepared)
    const signature = req.headers.get("X-Pulso-Signature");
    const hmacSecret = process.env.PULSO_INGEST_HMAC_SECRET;

    if (hmacSecret && signature) {
      const hmac = crypto.createHmac("sha256", hmacSecret);
      const computedSignature = `sha256=${hmac.update(JSON.stringify(body)).digest("hex")}`;
      
      if (signature !== computedSignature) {
        return NextResponse.json({ error: "Invalid Signature" }, { status: 403 });
      }
    }

    // 4. Schema Validation (Simplified v1)
    if (!body.event_id || !body.event_type || !body.payload) {
      return NextResponse.json({ error: "Invalid payload: missing event_id, event_type or payload" }, { status: 400 });
    }

    if (body.version !== "v1") {
      return NextResponse.json({ error: "Unsupported protocol version. Expected v1." }, { status: 400 });
    }

    // 5. Ingestion Service Call (Mapping OpenClaw v1 to Pulso)
    const result = await ingestionService.receive({
      event_id: body.event_id,
      dedupe_key: body.dedupe_key || body.event_id,
      type: body.event_type,
      rawInput: body,
      summary: body.payload?.title || body.summary || `Evento vindo de ${body.source?.agent || 'OpenClaw'}`,
      originLabel: body.source?.product || "openclaw",
      originAgentRef: body.source?.agent,
      confidence: body.payload?.confidence || "medium",
      payload: body.payload,
      areaRef: body.payload?.area_ref,
      projectRef: body.payload?.project_ref,
      should_create_inbox_item: body.should_create_inbox_item || false
    });

    // 6. Response
    return NextResponse.json({
      accepted: true,
      status: result.ingestionStatus,
      event_id: result.event_id,
      dedupe_key: result.dedupe_key,
      ingestion_event_ref: result.id,
      target_entity_ref: result.target_entity_ref || null,
      message: "Event received and scheduled for processing"
    }, { status: 201 });

  } catch (error: any) {
    console.error("Ingestion API Error:", error);
    return NextResponse.json({ 
      error: "Internal Server Error", 
      message: error.message 
    }, { status: 500 });
  }
}

// Support OPTIONS for CORS if needed (though this is server-to-server)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Pulso-Signature",
    },
  });
}
