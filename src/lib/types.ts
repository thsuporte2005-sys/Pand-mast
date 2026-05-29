export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

export type JsonRecord = Record<string, JsonValue>;

export interface AppRecord {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  cover_url: string | null;
  description: string | null;
  status: 'draft' | 'published';
  product_ids: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AppTheme {
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  text_color: string;
}

export interface AuditLogRecord {
  id: string;
  action: string;
  user_id: string | null;
  user_email: string | null;
  details: JsonRecord | null;
  created_at: string;
}

export interface WebhookEventRecord {
  id: string;
  platform: string;
  event_type: string;
  buyer_name: string | null;
  buyer_email: string | null;
  product_id: string | null;
  product_name: string | null;
  transaction_id: string | null;
  order_status: string | null;
  subscription_status: string | null;
  status: 'pending' | 'processed' | 'failed';
  error_message: string | null;
  raw_payload: JsonValue | null;
  received_at: string;
  processed_at?: string | null;
}
