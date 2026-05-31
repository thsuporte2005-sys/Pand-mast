export type LanguageCode = 'pt-BR' | 'en-US' | 'es-ES' | 'fr-FR';

export const LANGUAGE_OPTIONS: Array<{ code: LanguageCode; label: string }> = [
  { code: 'pt-BR', label: 'Portugues' },
  { code: 'en-US', label: 'Ingles' },
  { code: 'es-ES', label: 'Espanhol' },
  { code: 'fr-FR', label: 'Frances' },
];

export const BRAND_FONT_OPTIONS = [
  'Inter',
  'Poppins',
  'Montserrat',
  'Roboto',
  'Lato',
  'Open Sans',
  'Playfair Display',
] as const;

export const PUBLIC_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export interface ModuleReleaseConfig {
  release_type?: string | null;
  release_after_days?: number | null;
  is_scheduled_release?: boolean | null;
}

export interface AccessGrant {
  status?: string | null;
  granted_at?: string | null;
  access_granted_at?: string | null;
}

export interface ModuleReleaseState {
  isUnlocked: boolean;
  unlockDate: Date | null;
  daysRemaining: number;
  statusKey: 'availableNow' | 'unlockToday' | 'unlockTomorrow' | 'unlockInDays' | 'moduleBlocked';
  label: string;
}

export interface SupportSettings {
  support_enabled?: boolean | null;
  support_type?: string | null;
  support_whatsapp?: string | null;
  support_email?: string | null;
  support_external_url?: string | null;
  support_button_text?: string | null;
  support_icon_url?: string | null;
  support_position?: string | null;
}

export const FIXED_TEXT: Record<LanguageCode, Record<string, string>> = {
  'pt-BR': {
    home: 'Inicio',
    community: 'Comunidade',
    notices: 'Avisos',
    support: 'Suporte',
    profile: 'Perfil',
    login: 'Entrar',
    logout: 'Sair',
    availableNow: 'Disponivel agora',
    unlockInDays: 'Libera em {days} dias',
    unlockTomorrow: 'Libera amanha',
    unlockToday: 'Libera hoje',
    moduleBlocked: 'Modulo bloqueado',
    myProfile: 'Meu perfil',
    name: 'Nome',
    email: 'Email',
    saveChanges: 'Salvar alteracoes',
    accessActive: 'Acesso ativo',
    accessBlocked: 'Acesso bloqueado',
    noContent: 'Nenhum conteudo disponivel',
  },
  'en-US': {
    home: 'Home',
    community: 'Community',
    notices: 'Notices',
    support: 'Support',
    profile: 'Profile',
    login: 'Sign in',
    logout: 'Sign out',
    availableNow: 'Available now',
    unlockInDays: 'Unlocks in {days} days',
    unlockTomorrow: 'Unlocks tomorrow',
    unlockToday: 'Unlocks today',
    moduleBlocked: 'Module locked',
    myProfile: 'My profile',
    name: 'Name',
    email: 'Email',
    saveChanges: 'Save changes',
    accessActive: 'Active access',
    accessBlocked: 'Blocked access',
    noContent: 'No content available',
  },
  'es-ES': {
    home: 'Inicio',
    community: 'Comunidad',
    notices: 'Avisos',
    support: 'Soporte',
    profile: 'Perfil',
    login: 'Entrar',
    logout: 'Salir',
    availableNow: 'Disponible ahora',
    unlockInDays: 'Disponible en {days} dias',
    unlockTomorrow: 'Disponible manana',
    unlockToday: 'Disponible hoy',
    moduleBlocked: 'Modulo bloqueado',
    myProfile: 'Mi perfil',
    name: 'Nombre',
    email: 'Email',
    saveChanges: 'Guardar cambios',
    accessActive: 'Acceso activo',
    accessBlocked: 'Acceso bloqueado',
    noContent: 'No hay contenido disponible',
  },
  'fr-FR': {
    home: 'Accueil',
    community: 'Communaute',
    notices: 'Avis',
    support: 'Support',
    profile: 'Profil',
    login: 'Connexion',
    logout: 'Deconnexion',
    availableNow: 'Disponible maintenant',
    unlockInDays: 'Disponible dans {days} jours',
    unlockTomorrow: 'Disponible demain',
    unlockToday: "Disponible aujourd'hui",
    moduleBlocked: 'Module bloque',
    myProfile: 'Mon profil',
    name: 'Nom',
    email: 'Email',
    saveChanges: 'Enregistrer',
    accessActive: 'Acces actif',
    accessBlocked: 'Acces bloque',
    noContent: 'Aucun contenu disponible',
  },
};

export function getFixedText(
  language: string | null | undefined,
  key: string,
  dynamicValues?: Record<string, string | number>
) {
  const lang = isLanguageCode(language) ? language : 'pt-BR';
  let value = FIXED_TEXT[lang][key] || FIXED_TEXT['pt-BR'][key] || key;

  if (dynamicValues) {
    Object.entries(dynamicValues).forEach(([token, replacement]) => {
      value = value.replace(`{${token}}`, String(replacement));
    });
  }

  return value;
}

export function isLanguageCode(value: string | null | undefined): value is LanguageCode {
  return value === 'pt-BR' || value === 'en-US' || value === 'es-ES' || value === 'fr-FR';
}

export function getAccessDate(access: AccessGrant | null | undefined) {
  const rawDate = access?.access_granted_at || access?.granted_at;
  if (!rawDate) return null;

  const parsed = new Date(rawDate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getModuleReleaseState(
  moduleItem: ModuleReleaseConfig,
  access: AccessGrant | null | undefined,
  language: string | null | undefined = 'pt-BR',
  now = new Date()
): ModuleReleaseState {
  if (!access || access.status !== 'active') {
    return {
      isUnlocked: false,
      unlockDate: null,
      daysRemaining: 0,
      statusKey: 'moduleBlocked',
      label: getFixedText(language, 'moduleBlocked'),
    };
  }

  const isScheduled =
    moduleItem.release_type === 'after_purchase_days' ||
    Boolean(moduleItem.is_scheduled_release);
  const releaseAfterDays = Math.max(0, Number(moduleItem.release_after_days || 0));

  if (!isScheduled || releaseAfterDays === 0) {
    return {
      isUnlocked: true,
      unlockDate: null,
      daysRemaining: 0,
      statusKey: 'availableNow',
      label: getFixedText(language, 'availableNow'),
    };
  }

  const accessDate = getAccessDate(access);
  if (!accessDate) {
    return {
      isUnlocked: false,
      unlockDate: null,
      daysRemaining: releaseAfterDays,
      statusKey: 'moduleBlocked',
      label: getFixedText(language, 'moduleBlocked'),
    };
  }

  const unlockDate = new Date(accessDate);
  unlockDate.setDate(unlockDate.getDate() + releaseAfterDays);

  if (now >= unlockDate) {
    return {
      isUnlocked: true,
      unlockDate,
      daysRemaining: 0,
      statusKey: 'availableNow',
      label: getFixedText(language, 'availableNow'),
    };
  }

  const millisecondsRemaining = unlockDate.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(millisecondsRemaining / 86400000));
  const statusKey =
    daysRemaining === 0 ? 'unlockToday' : daysRemaining === 1 ? 'unlockTomorrow' : 'unlockInDays';

  return {
    isUnlocked: false,
    unlockDate,
    daysRemaining,
    statusKey,
    label: getFixedText(language, statusKey, { days: daysRemaining }),
  };
}

export function buildSupportHref(settings: SupportSettings | null | undefined) {
  if (!settings?.support_enabled) return null;

  if (settings.support_type === 'email' && settings.support_email) {
    return `mailto:${settings.support_email}`;
  }

  if (settings.support_type === 'external_link' && settings.support_external_url) {
    return settings.support_external_url;
  }

  if (settings.support_whatsapp) {
    const digits = settings.support_whatsapp.replace(/\D/g, '');
    if (digits) return `https://wa.me/${digits}`;
  }

  return null;
}

export function sanitizeStorageFileName(fileName: string) {
  const extension = fileName.includes('.') ? fileName.split('.').pop() : 'file';
  const baseName = fileName
    .replace(/\.[^/.]+$/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  return `${baseName || 'arquivo'}-${Date.now()}.${extension || 'file'}`;
}

export function validatePublicImage(file: File, maxBytes = PUBLIC_IMAGE_MAX_BYTES) {
  if (!file.type.startsWith('image/')) {
    return 'Envie uma imagem em PNG, JPG, WEBP, GIF ou SVG.';
  }

  if (file.size > maxBytes) {
    return 'A imagem precisa ter no maximo 10 MB.';
  }

  return null;
}
