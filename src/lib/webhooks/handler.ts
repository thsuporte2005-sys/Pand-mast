import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getWebhookSecret, type WebhookPlatform } from '@/lib/env';
import { getErrorMessage } from '@/lib/errors';
import { processWebhookEvent, type StandardWebhookData } from '@/lib/webhooks/processor';
import type { JsonValue } from '@/lib/types';

const payloadSchema = z.record(z.string(), z.unknown());

type RawPayload = z.infer<typeof payloadSchema>;

function asRecord(value: unknown): RawPayload {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as RawPayload) : {};
}

function readString(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value);
}

function readOptionalString(value: unknown) {
  const text = readString(value).trim();
  return text.length > 0 ? text : null;
}

function getPath(record: RawPayload, path: string[]) {
  let current: unknown = record;

  for (const key of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return undefined;
    }

    current = (current as RawPayload)[key];
  }

  return current;
}

function normalizeStatus(status: string, approval: string[], refunds: string[], chargebacks: string[], cancels: string[]) {
  const value = status.toLowerCase();

  if (approval.includes(value)) return 'approved';
  if (refunds.includes(value)) return 'refunded';
  if (chargebacks.includes(value)) return 'chargeback';
  if (cancels.includes(value)) return 'canceled';

  return 'pending';
}

function normalizePayload(platform: WebhookPlatform, body: RawPayload): StandardWebhookData {
  if (platform === 'hotmart') {
    const data = asRecord(body.data);
    const buyer = asRecord(data.buyer);
    const product = asRecord(data.product);
    const purchase = asRecord(data.purchase);

    return {
      platform,
      event_type: readString(body.event || 'PURCHASE_APPROVED'),
      buyer_name: readOptionalString(buyer.name),
      buyer_email: readString(buyer.email),
      product_id: readString(product.id),
      product_name: readOptionalString(product.name),
      transaction_id: readString(purchase.transaction || `tx_${Date.now()}`),
      order_status: normalizeStatus(
        readString(purchase.status),
        ['approved', 'complete', 'completed', 'active'],
        ['refunded', 'devolvida', 'reembolsada'],
        ['chargedback', 'chargeback', 'disputed'],
        ['canceled', 'cancelled', 'cancelada', 'expired']
      ),
      subscription_status: readOptionalString(purchase.subscription_status),
      raw_payload: body as JsonValue,
    };
  }

  if (platform === 'kiwify') {
    const customer = asRecord(body.Customer || body.customer);
    const product = asRecord(body.product);
    const purchase = asRecord(body.purchase);

    return {
      platform,
      event_type: readString(body.event_type || 'order_approved'),
      buyer_name: readOptionalString(customer.name),
      buyer_email: readString(customer.email),
      product_id: readString(body.product_id || product.product_id),
      product_name: readOptionalString(body.product_name || product.product_name),
      transaction_id: readString(body.order_id || purchase.id || `tx_${Date.now()}`),
      order_status: normalizeStatus(
        readString(body.order_status),
        ['paid', 'approved', 'complete', 'completed', 'active'],
        ['refunded', 'devolvida', 'reembolsada'],
        ['chargedback', 'chargeback', 'disputed'],
        ['canceled', 'cancelled', 'cancelada']
      ),
      subscription_status: readOptionalString(body.subscription_status),
      raw_payload: body as JsonValue,
    };
  }

  if (platform === 'eduzz') {
    const data = asRecord(body.data || body);

    return {
      platform,
      event_type: readString(body.event || 'invoice_status_change'),
      buyer_name: readOptionalString(data.cus_name || data.cliente_nome),
      buyer_email: readString(data.cus_email || data.cliente_email),
      product_id: readString(data.product_id || data.produto_cod),
      product_name: readOptionalString(data.product_name || data.produto_nome),
      transaction_id: readString(data.transacao_cod || data.id || `tx_${Date.now()}`),
      order_status: normalizeStatus(
        readString(data.transacao_status || data.status),
        ['3', 'pago', 'approved', 'complete', 'completed', 'active'],
        ['4', 'reembolsado', 'refunded', 'devolvido'],
        ['6', 'chargeback', 'contestada', 'disputed'],
        ['7', 'cancelado', 'canceled', 'cancelled']
      ),
      subscription_status: readOptionalString(data.subscription_status),
      raw_payload: body as JsonValue,
    };
  }

  if (platform === 'monetizze') {
    const comprador = asRecord(body.comprador);
    const produto = asRecord(body.produto);
    const venda = asRecord(body.venda);

    return {
      platform,
      event_type: readString(body.event_type || 'sale_status_changed'),
      buyer_name: readOptionalString(comprador.nome),
      buyer_email: readString(comprador.email),
      product_id: readString(produto.codigo),
      product_name: readOptionalString(produto.nome),
      transaction_id: readString(venda.codigo || `tx_${Date.now()}`),
      order_status: normalizeStatus(
        readString(venda.status),
        ['finalizada', 'completa', 'approved', 'paid', 'ativa', 'active'],
        ['reembolsada', 'refunded', 'devolvida'],
        ['chargeback', 'contestada', 'disputed'],
        ['cancelada', 'canceled', 'cancelled']
      ),
      subscription_status: readOptionalString(body.subscription_status),
      raw_payload: body as JsonValue,
    };
  }

  if (platform === 'cartpanda') {
    const customer = asRecord(body.customer);
    const product = asRecord(body.product);
    const lineItems = Array.isArray(body.line_items) ? body.line_items : [];
    const firstItem = asRecord(lineItems[0]);
    const firstName = readOptionalString(customer.first_name);
    const lastName = readOptionalString(customer.last_name);

    return {
      platform,
      event_type: readString(body.event || 'order.paid'),
      buyer_name: firstName ? `${firstName} ${lastName || ''}`.trim() : readOptionalString(customer.name),
      buyer_email: readString(customer.email),
      product_id: readString(body.product_id || firstItem.product_id || product.id),
      product_name: readOptionalString(firstItem.name || product.name),
      transaction_id: readString(body.id || body.order_id || `tx_${Date.now()}`),
      order_status: normalizeStatus(
        readString(body.status),
        ['paid', 'approved', 'success', 'succeeded', 'complete', 'completed', 'active'],
        ['refunded', 'reembolsado'],
        ['chargedback', 'chargeback', 'disputed'],
        ['canceled', 'cancelled', 'cancelado']
      ),
      subscription_status: readOptionalString(body.subscription_status),
      raw_payload: body as JsonValue,
    };
  }

  if (platform === 'ticto') {
    const customer = asRecord(body.customer);
    const product = asRecord(body.product);

    return {
      platform,
      event_type: readString(body.event || 'purchase_approved'),
      buyer_name: readOptionalString(customer.name),
      buyer_email: readString(customer.email),
      product_id: readString(body.product_id || product.id),
      product_name: readOptionalString(product.name),
      transaction_id: readString(body.hash || body.transaction_id || body.id || `tx_${Date.now()}`),
      order_status: normalizeStatus(
        readString(body.status),
        ['paid', 'approved', 'success', 'succeeded', 'complete', 'completed', 'active', 'pago'],
        ['refunded', 'reembolsado', 'devolvido'],
        ['chargedback', 'chargeback', 'disputed', 'contestada'],
        ['canceled', 'cancelled', 'cancelado']
      ),
      subscription_status: readOptionalString(body.subscription_status),
      raw_payload: body as JsonValue,
    };
  }

  const customer = asRecord(body.customer);
  const product = asRecord(body.product);
  const payment = asRecord(body.payment);

  return {
    platform,
    event_type: readString(body.event || body.event_type || 'payment.success'),
    buyer_name: readOptionalString(customer.name),
    buyer_email: readString(customer.email),
    product_id: readString(body.product_id || product.id),
    product_name: readOptionalString(product.name),
    transaction_id: readString(payment.id || body.id || `tx_${Date.now()}`),
    order_status: normalizeStatus(
      readString(payment.status || body.status),
      ['paid', 'approved', 'success', 'succeeded', 'complete', 'completed', 'active'],
      ['refunded', 'reembolsado', 'devolvido'],
      ['chargedback', 'chargeback', 'disputed'],
      ['canceled', 'cancelled', 'cancelado']
    ),
    subscription_status: readOptionalString(body.subscription_status),
    raw_payload: body as JsonValue,
  };
}

function safeCompare(a: string, b: string) {
  const first = Buffer.from(a);
  const second = Buffer.from(b);

  if (first.length !== second.length) {
    return false;
  }

  return timingSafeEqual(first, second);
}

function extractProvidedSecret(request: Request, body: RawPayload, platform: WebhookPlatform) {
  const headers = request.headers;
  const authHeader = headers.get('authorization') || '';
  const bearer = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
  const bodySecret =
    readOptionalString(body.webhook_secret) ||
    readOptionalString(body.secret) ||
    readOptionalString(body.token) ||
    readOptionalString(body.hottok) ||
    readOptionalString(getPath(body, ['data', 'hottok']));

  return [
    headers.get('x-webhook-secret'),
    headers.get(`x-${platform}-secret`),
    headers.get(`x-${platform}-token`),
    headers.get(`x-${platform}-signature`),
    headers.get('x-hotmart-hottok'),
    bearer,
    bodySecret,
  ].filter((value): value is string => Boolean(value));
}

function validateSecret(request: Request, body: RawPayload, platform: WebhookPlatform) {
  const expectedSecret = getWebhookSecret(platform);

  if (!expectedSecret) {
    return { ok: false, status: 500, message: `Webhook secret for ${platform} is not configured.` };
  }

  const providedSecrets = extractProvidedSecret(request, body, platform);
  const matched = providedSecrets.some((secret) => safeCompare(secret, expectedSecret));

  if (!matched) {
    return { ok: false, status: 401, message: 'Invalid webhook secret.' };
  }

  return { ok: true, status: 200, message: 'ok' };
}

export async function handleWebhookRequest(request: Request, platform: WebhookPlatform) {
  try {
    const rawBody = await request.text();
    const parsedJson = JSON.parse(rawBody) as unknown;
    const body = payloadSchema.parse(parsedJson);
    const secretCheck = validateSecret(request, body, platform);

    if (!secretCheck.ok) {
      return NextResponse.json({ error: secretCheck.message }, { status: secretCheck.status });
    }

    const normalized = normalizePayload(platform, body);

    if (!normalized.buyer_email || !normalized.product_id) {
      return NextResponse.json(
        { error: 'Missing required webhook fields (email/product).' },
        { status: 400 }
      );
    }

    const result = await processWebhookEvent(normalized);
    return NextResponse.json(result, { status: result.success ? 200 : 422 });
  } catch (error: unknown) {
    const isValidationError = error instanceof z.ZodError || error instanceof SyntaxError;
    const status = isValidationError ? 400 : 500;

    return NextResponse.json({ error: getErrorMessage(error) }, { status });
  }
}
