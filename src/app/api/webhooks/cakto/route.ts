import { handleWebhookRequest } from '@/lib/webhooks/handler';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  return handleWebhookRequest(request, 'cakto');
}
