'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { Bell, Home, LifeBuoy, User, Users } from 'lucide-react';
import { getFixedText } from '@/lib/app-experience';

interface AppBottomNavProps {
  language?: string | null;
}

const navItems = [
  { key: 'home', path: 'home', icon: Home },
  { key: 'community', path: 'community', icon: Users },
  { key: 'notices', path: 'notices', icon: Bell },
  { key: 'support', path: 'support', icon: LifeBuoy },
  { key: 'profile', path: 'profile', icon: User },
];

export function AppBottomNav({ language = 'pt-BR' }: AppBottomNavProps) {
  const { slug } = useParams() as { slug: string };
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#071A2F]/94 backdrop-blur-xl">
      <div className="mx-auto grid max-w-4xl grid-cols-5 px-2 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const href = `/app/${slug}/${item.path}`;
          const active = pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={item.key}
              href={href}
              className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold transition ${
                active
                  ? 'bg-[#1E6BFF]/16 text-[#F5F8FF]'
                  : 'text-[#9BAEC8] hover:bg-white/5 hover:text-[#F5F8FF]'
              }`}
            >
              <Icon className={`h-4.5 w-4.5 ${active ? 'text-[#4DA3FF]' : ''}`} />
              <span className="max-w-full truncate">{getFixedText(language, item.key)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
