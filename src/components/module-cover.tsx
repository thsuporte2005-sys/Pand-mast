import { Lock, Sparkles } from 'lucide-react';

interface ModuleCoverProps {
  title: string;
  imageUrl?: string | null;
  altText?: string | null;
  locked?: boolean;
  className?: string;
}

export function ModuleCover({ title, imageUrl, altText, locked = false, className = '' }: ModuleCoverProps) {
  return (
    <div className={`relative overflow-hidden rounded-xl border border-white/10 bg-[#0B2A4A] ${className}`}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={altText || title}
          className={`h-full w-full object-cover transition ${locked ? 'opacity-45 grayscale' : ''}`}
        />
      ) : (
        <div className="flex h-full min-h-32 w-full items-end bg-[radial-gradient(circle_at_20%_10%,rgba(77,163,255,0.45),transparent_30%),linear-gradient(135deg,#0B2A4A,#071A2F_48%,#1E6BFF)] p-4">
          <div>
            <Sparkles className="mb-2 h-4 w-4 text-[#4DA3FF]" />
            <p className="line-clamp-2 text-sm font-black leading-tight text-[#F5F8FF]">{title}</p>
          </div>
        </div>
      )}

      {locked && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#071A2F]/45">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-[#071A2F]/80 px-3 py-1.5 text-[10px] font-bold text-[#F5F8FF] backdrop-blur">
            <Lock className="h-3.5 w-3.5 text-[#4DA3FF]" />
            Bloqueado
          </span>
        </div>
      )}
    </div>
  );
}
