'use client';

import { ExternalLink, LifeBuoy } from 'lucide-react';
import { buildSupportHref, type SupportSettings } from '@/lib/app-experience';

interface AppSupportButtonProps {
  settings: SupportSettings | null;
}

export function AppSupportButton({ settings }: AppSupportButtonProps) {
  if (settings?.support_position === 'hidden') return null;

  const href = buildSupportHref(settings);

  if (!href) return null;

  const isExternal = href.startsWith('http');
  const label = settings?.support_button_text || 'Falar com suporte';

  return (
    <a
      href={href}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      className="fixed bottom-24 right-4 z-50 inline-flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full border border-[#1B3554] bg-[#1E6BFF] px-4 py-3 text-xs font-bold text-white shadow-2xl shadow-black/25 transition hover:bg-[#4DA3FF] sm:right-6"
      aria-label={label}
    >
      {settings?.support_icon_url ? (
        <img
          src={settings.support_icon_url}
          alt=""
          className="h-6 w-6 rounded-full object-cover"
        />
      ) : (
        <LifeBuoy className="h-4.5 w-4.5" />
      )}
      <span className="truncate">{label}</span>
      {isExternal && <ExternalLink className="h-3.5 w-3.5" />}
    </a>
  );
}
