import { NextResponse } from 'next/server';

const PROCESS_MEETING_URL =
  'https://us-central1-felipedutraapps.cloudfunctions.net/pulsoProcessMeeting';

/**
 * Compatibility proxy for a future server-rendered deployment.
 * Firebase Hosting currently rewrites this route directly to the Function,
 * while the static PULSO client calls the Function URL to support long meetings.
 */
export async function POST(req: Request) {
  const authorization = req.headers.get('authorization');
  if (!authorization) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const response = await fetch(PROCESS_MEETING_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authorization,
    },
    body: await req.text(),
  });

  const body = await response.text();
  return new NextResponse(body, {
    status: response.status,
    headers: { 'Content-Type': response.headers.get('content-type') || 'application/json' },
  });
}
