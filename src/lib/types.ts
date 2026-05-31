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
  logo_path?: string | null;
  cover_url: string | null;
  description: string | null;
  status: 'draft' | 'published';
  product_ids: string | null;
  display_name?: string | null;
  subtitle?: string | null;
  square_icon_url?: string | null;
  square_icon_path?: string | null;
  brand_mode?: 'text' | 'image' | string | null;
  brand_font?: string | null;
  default_language?: string | null;
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

export interface AppSettingsRecord extends AppTheme {
  app_id: string;
  custom_domain?: string | null;
  support_enabled?: boolean | null;
  support_type?: 'whatsapp' | 'email' | 'external_link' | string | null;
  support_whatsapp?: string | null;
  support_email?: string | null;
  support_external_url?: string | null;
  support_button_text?: string | null;
  support_icon_url?: string | null;
  support_icon_path?: string | null;
  support_position?: string | null;
  carousel_enabled?: boolean | null;
  display_name?: string | null;
  subtitle?: string | null;
  logo_url?: string | null;
  logo_path?: string | null;
  square_icon_url?: string | null;
  square_icon_path?: string | null;
  brand_mode?: 'text' | 'image' | string | null;
  brand_font?: string | null;
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
