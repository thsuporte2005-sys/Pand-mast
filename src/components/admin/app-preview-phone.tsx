'use client';

import { Bell, Headphones, Home, Layers, LifeBuoy, User, Users } from 'lucide-react';

interface PreviewCarouselImage {
  id: string;
  image_url: string;
  alt_text?: string | null;
  is_active?: boolean;
}

interface PreviewModule {
  id: string;
  name: string;
  cover_image_url?: string | null;
  release_type?: string | null;
  release_after_days?: number | null;
  is_scheduled_release?: boolean | null;
}

interface AppPreviewPhoneProps {
  name: string;
  description?: string;
  logoUrl?: string;
  coverUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  carouselEnabled: boolean;
  carouselImages: PreviewCarouselImage[];
  modules: PreviewModule[];
  supportEnabled: boolean;
  supportIconUrl?: string;
}

function getInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'PM'
  );
}

export function AppPreviewPhone({
  name,
  description,
  logoUrl,
  coverUrl,
  primaryColor,
  secondaryColor,
  accentColor,
  backgroundColor,
  textColor,
  carouselEnabled,
  carouselImages,
  modules,
  supportEnabled,
  supportIconUrl,
}: AppPreviewPhoneProps) {
  const activeImages = carouselImages.filter((image) => image.is_active !== false);

  return (
    <aside className="lg:sticky lg:top-6">
      <div className="mb-3 flex items-center justify-between px-1">
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-text-white">Preview em tempo real</p>
          <p className="text-[11px] text-text-gray">Guia visual do web app final</p>
        </div>
        <SmartphoneBadge />
      </div>

      <div className="mx-auto w-full max-w-[338px] rounded-[3rem] border-[10px] border-[#030913] bg-[#030913] p-1 shadow-[0_28px_70px_rgba(0,0,0,0.48)]">
        <div
          className="relative h-[660px] overflow-hidden rounded-[2.35rem]"
          style={{ backgroundColor, color: textColor }}
        >
          <div className="pointer-events-none absolute left-1/2 top-2 z-30 h-5 w-24 -translate-x-1/2 rounded-full bg-[#030913]" />

          <div className="h-full overflow-y-auto pb-20 pt-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <header className="border-b border-white/10 px-4 pb-3">
              <div className="flex min-w-0 items-center gap-2.5">
                {logoUrl ? (
                  <img src={logoUrl} alt="" className="h-9 w-9 shrink-0 rounded-xl object-cover" />
                ) : (
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[10px] font-black text-white"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {getInitials(name)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-xs font-black">{name || 'Nome do app'}</p>
                  <p className="truncate text-[9px] text-white/55">{description || 'Web app exclusivo'}</p>
                </div>
              </div>
            </header>

            {carouselEnabled && activeImages.length > 0 && (
              <section className="px-4 pt-4">
                <div className="flex snap-x gap-2 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {activeImages.map((image) => (
                    <img
                      key={image.id}
                      src={image.image_url}
                      alt={image.alt_text || ''}
                      className="aspect-[16/9] w-[83%] shrink-0 snap-start rounded-xl border border-white/10 object-cover"
                    />
                  ))}
                </div>
              </section>
            )}

            <main className="space-y-4 px-4 pt-4">
              <section
                className="relative min-h-32 overflow-hidden rounded-2xl border border-white/10 p-4"
                style={{
                  backgroundColor: secondaryColor,
                  backgroundImage: coverUrl
                    ? `linear-gradient(to right, rgba(7,26,47,0.92), rgba(7,26,47,0.28)), url(${coverUrl})`
                    : undefined,
                  backgroundPosition: 'center',
                  backgroundSize: 'cover',
                }}
              >
                <p className="text-[9px] font-bold uppercase text-white/60">Área de membros</p>
                <h3 className="mt-2 max-w-[80%] text-base font-black leading-tight text-white">
                  Continue seus estudos
                </h3>
                <p className="mt-2 max-w-[88%] text-[9px] leading-relaxed text-white/65">
                  {description || 'Seu conteúdo organizado em um só lugar.'}
                </p>
              </section>

              <section>
                <div className="mb-2 flex items-center gap-2">
                  <Layers className="h-3.5 w-3.5" style={{ color: accentColor }} />
                  <p className="text-[10px] font-black uppercase text-white/60">Módulos</p>
                </div>
                {modules.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/15 p-5 text-center text-[10px] text-white/45">
                    Nenhum módulo cadastrado
                  </div>
                ) : (
                  <div className="space-y-2">
                    {modules.slice(0, 4).map((moduleItem, index) => (
                      <div
                        key={moduleItem.id}
                        className="flex items-center gap-2.5 rounded-xl border border-white/10 p-2.5"
                        style={{ backgroundColor: secondaryColor }}
                      >
                        {moduleItem.cover_image_url ? (
                          <img
                            src={moduleItem.cover_image_url}
                            alt=""
                            className="h-12 w-16 shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <div
                            className="flex h-12 w-16 shrink-0 items-center justify-center rounded-lg text-[10px] font-black text-white"
                            style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }}
                          >
                            {String(index + 1).padStart(2, '0')}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-[10px] font-black text-white">{moduleItem.name}</p>
                          <p className="mt-1 text-[9px] text-white/45">
                            {moduleItem.release_type === 'after_purchase_days' || moduleItem.is_scheduled_release
                              ? `Libera após ${Math.max(0, Number(moduleItem.release_after_days || 0))} dias`
                              : 'Disponível agora'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </main>
          </div>

          {supportEnabled && (
            <div
              className="absolute bottom-16 right-4 z-20 flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-white/15 text-white shadow-lg"
              style={{ backgroundColor: primaryColor }}
            >
              {supportIconUrl ? (
                <img src={supportIconUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <LifeBuoy className="h-5 w-5" />
              )}
            </div>
          )}

          <nav className="absolute inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t border-white/10 bg-[#071A2F]/95 px-1 py-2 backdrop-blur">
            <PreviewNavItem icon={Home} label="Início" active color={accentColor} />
            <PreviewNavItem icon={Users} label="Comunidade" color={accentColor} />
            <PreviewNavItem icon={Bell} label="Avisos" color={accentColor} />
            <PreviewNavItem icon={Headphones} label="Suporte" color={accentColor} />
            <PreviewNavItem icon={User} label="Perfil" color={accentColor} />
          </nav>
        </div>
      </div>
    </aside>
  );
}

function SmartphoneBadge() {
  return (
    <div className="rounded-full border border-border-color bg-card-bg px-2.5 py-1 text-[10px] font-bold text-light-blue">
      iPhone
    </div>
  );
}

function PreviewNavItem({
  icon: Icon,
  label,
  active = false,
  color,
}: {
  icon: typeof Home;
  label: string;
  active?: boolean;
  color: string;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1">
      <Icon className="h-3.5 w-3.5" style={{ color: active ? color : 'rgba(255,255,255,0.42)' }} />
      <span className="max-w-full truncate text-[7px]" style={{ color: active ? color : 'rgba(255,255,255,0.42)' }}>
        {label}
      </span>
    </div>
  );
}
