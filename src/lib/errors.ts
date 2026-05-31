export type AppErrorCategory =
  | 'permission'
  | 'validation'
  | 'connection'
  | 'database'
  | 'upload'
  | 'unknown';

export interface AppErrorDetails {
  category: AppErrorCategory;
  message: string;
  technical: string;
  code: string | null;
}

interface StructuredError {
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  code?: unknown;
  category?: unknown;
  issues?: unknown;
  error?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getStructuredError(error: unknown): StructuredError {
  if (!isRecord(error)) return {};

  const nested = isRecord(error.error) ? error.error : {};
  return { ...nested, ...error };
}

function getValidationMessage(structured: StructuredError) {
  if (!Array.isArray(structured.issues)) return null;

  const firstIssue = structured.issues[0];
  return isRecord(firstIssue) ? toText(firstIssue.message) : null;
}

function classifyError(message: string, code: string | null, context?: AppErrorCategory) {
  const searchable = `${message} ${code || ''}`.toLowerCase();

  if (
    searchable.includes('row-level security') ||
    searchable.includes('permission') ||
    searchable.includes('unauthorized') ||
    searchable.includes('forbidden') ||
    code === '42501' ||
    code === 'PGRST301'
  ) {
    return 'permission' as const;
  }

  if (
    searchable.includes('failed to fetch') ||
    searchable.includes('network') ||
    searchable.includes('connection') ||
    searchable.includes('timeout')
  ) {
    return 'connection' as const;
  }

  if (context === 'upload' || searchable.includes('storage') || searchable.includes('bucket')) {
    return 'upload' as const;
  }

  if (
    searchable.includes('invalid') ||
    searchable.includes('required') ||
    searchable.includes('validation') ||
    searchable.includes('zod')
  ) {
    return 'validation' as const;
  }

  if (code || searchable.includes('database') || searchable.includes('postgres')) {
    return 'database' as const;
  }

  return context || 'unknown';
}

function getFriendlyMessage(
  category: AppErrorCategory,
  technical: string,
  code: string | null,
  fallback: string
) {
  const suffix = code ? ` Código: ${code}.` : '';

  if (category === 'permission') {
    return `Permissão negada pelo banco. Confirme se sua conta está cadastrada como admin e tente novamente.${suffix}`;
  }

  if (category === 'validation') {
    return technical;
  }

  if (category === 'connection') {
    return `Não foi possível conectar ao serviço agora. Verifique sua conexão e tente novamente.${suffix}`;
  }

  if (category === 'upload') {
    return `Não foi possível enviar a imagem. Confira o tipo do arquivo, o limite de 5 MB e sua permissão de admin.${suffix}`;
  }

  if (category === 'database') {
    return `O banco recusou a alteração. ${technical}${suffix}`;
  }

  return technical && technical !== 'Erro inesperado.' ? technical : fallback;
}

export function formatAppError(
  error: unknown,
  fallback = 'Não foi possível concluir a operação.',
  context?: AppErrorCategory
): AppErrorDetails {
  const structured = getStructuredError(error);
  const code = toText(structured.code);
  const validationMessage = getValidationMessage(structured);
  const rawMessage =
    validationMessage ||
    (error instanceof Error ? error.message : null) ||
    (typeof error === 'string' ? error : null) ||
    toText(structured.message) ||
    fallback;
  const detail = toText(structured.details);
  const hint = toText(structured.hint);
  const technical = [rawMessage, detail, hint].filter(Boolean).join(' ');
  const structuredCategory = toText(structured.category);
  const category =
    validationMessage
      ? 'validation'
      : structuredCategory === 'permission' ||
          structuredCategory === 'validation' ||
          structuredCategory === 'connection' ||
          structuredCategory === 'database' ||
          structuredCategory === 'upload' ||
          structuredCategory === 'unknown'
        ? structuredCategory
        : classifyError(technical, code, context);

  return {
    category,
    code,
    technical,
    message: getFriendlyMessage(category, technical, code, fallback),
  };
}

export function getErrorMessage(
  error: unknown,
  fallback = 'Não foi possível concluir a operação.',
  context?: AppErrorCategory
) {
  return formatAppError(error, fallback, context).message;
}

export function logTechnicalError(scope: string, error: unknown, context?: AppErrorCategory) {
  const details = formatAppError(error, undefined, context);
  console.error(`[Pand mast] ${scope}`, details, error);
}
