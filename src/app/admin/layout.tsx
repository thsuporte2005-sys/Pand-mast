'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  Layers, 
  Sliders, 
  Webhook, 
  Image as ImageIcon, 
  Settings as SettingsIcon, 
  LogOut, 
  Menu, 
  X,
  User
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const menuItems = [
  { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { name: 'Aplicativos', href: '/admin/apps', icon: Layers },
  { name: 'Integrações', href: '/admin/integrations', icon: Sliders },
  { name: 'Webhooks', href: '/admin/webhooks', icon: Webhook },
  { name: 'Mídias', href: '/admin/media', icon: ImageIcon },
  { name: 'Configurações', href: '/admin/settings', icon: SettingsIcon },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function getAdminUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setAdminEmail(user.email || 'Admin');
      }
    }
    getAdminUser();
  }, [supabase]);

  // Exclude login page from this sidebar layout
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/admin/login');
  };

  return (
    <div className="min-h-screen bg-primary-bg text-text-white flex flex-col md:flex-row">
      
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-secondary-bg border-r border-border-color shrink-0">
        <div className="h-16 flex items-center px-6 gap-3 border-b border-border-color bg-primary-bg/50">
          <img src="/pngs/loggo.png" alt="Pand mast" className="h-8 w-auto object-contain" />
          <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-light-blue to-accent-blue bg-clip-text text-transparent">
            Pand mast
          </span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 group ${
                  isActive 
                    ? 'bg-accent-blue text-text-white shadow-lg shadow-accent-blue/20' 
                    : 'text-text-gray hover:text-text-white hover:bg-card-bg'
                }`}
              >
                <Icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-text-white' : 'text-text-gray group-hover:text-light-blue'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User profile footer */}
        <div className="p-4 border-t border-border-color bg-card-bg/20">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-card-bg/50 border border-border-color/30 mb-3">
            <div className="h-8 w-8 rounded-full bg-accent-blue/20 flex items-center justify-center border border-accent-blue/30 shrink-0">
              <User className="h-4 w-4 text-light-blue" />
            </div>
            <div className="overflow-hidden">
              <p className="text-xs text-text-gray truncate">Logado como</p>
              <p className="text-xs font-semibold text-text-white truncate">{adminEmail}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all duration-200"
          >
            <LogOut className="h-4 w-4" />
            Sair do Painel
          </button>
        </div>
      </aside>

      {/* Header and Collapsible Menu for Mobile */}
      <div className="md:hidden flex items-center justify-between h-16 px-4 bg-secondary-bg border-b border-border-color w-full z-25">
        <div className="flex items-center gap-2">
          <img src="/pngs/loggo.png" alt="Pand mast" className="h-7 w-auto object-contain" />
          <span className="font-bold text-md tracking-tight text-text-white">Pand mast</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-md text-text-gray hover:text-text-white bg-card-bg/50 border border-border-color/50"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Menu Backdrop */}
      {mobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-primary-bg/80 backdrop-blur-sm z-30" 
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <aside 
        className={`md:hidden fixed top-0 bottom-0 left-0 w-64 bg-secondary-bg border-r border-border-color z-40 transform transition-transform duration-300 ease-in-out flex flex-col ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-border-color">
          <div className="flex items-center gap-2">
            <img src="/pngs/loggo.png" alt="Pand mast" className="h-7 w-auto object-contain" />
            <span className="font-bold text-md tracking-tight text-text-white">Pand mast</span>
          </div>
          <button onClick={() => setMobileMenuOpen(false)} className="text-text-gray hover:text-text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive 
                    ? 'bg-accent-blue text-text-white shadow-lg shadow-accent-blue/10' 
                    : 'text-text-gray hover:text-text-white hover:bg-card-bg'
                }`}
              >
                <Icon className="h-5 w-5 text-current" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border-color bg-card-bg/20">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-card-bg/50 border border-border-color/30 mb-3 overflow-hidden">
            <div className="h-7 w-7 rounded-full bg-accent-blue/20 flex items-center justify-center text-light-blue shrink-0">
              <User className="h-3.5 w-3.5" />
            </div>
            <p className="text-xs font-semibold text-text-white truncate">{adminEmail}</p>
          </div>
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              handleSignOut();
            }}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/20"
          >
            <LogOut className="h-4 w-4" />
            Sair do Painel
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="hidden md:flex items-center justify-between h-16 px-8 border-b border-border-color/60 bg-secondary-bg/30 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-medium text-text-gray">
              Painel de Administração
            </h1>
            <span className="text-border-color">/</span>
            <span className="text-sm font-semibold text-light-blue capitalize">
              {pathname.split('/')[2] || 'Dashboard'}
            </span>
          </div>
        </header>

        <div className="flex-1 p-6 md:p-8 overflow-y-auto animate-fade-in">
          {children}
        </div>
      </main>

    </div>
  );
}
