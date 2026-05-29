export function getErrorMessage(error: unknown, fallback = 'Erro inesperado.') {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return fallback;
}
