'use client';

import { usePathname } from 'next/navigation';
import {
  Home,
  Search,
  Calendar,
  User,
  MessageCircle,
  Hash,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Link } from '@/i18n/routing';

export function BottomNavigation() {
  const t = useTranslations('navigation');
  const pathname = usePathname();

  const navigationItems = [
    {
      icon: Home,
      label: t('home'),
      href: '/' as const,
    },
    {
      icon: Search,
      label: t('search'),
      href: '/search' as const,
    },
    {
      icon: Hash,
      label: 'Timeline',
      href: '/photo-sessions' as const,
    },
    {
      icon: MessageCircle,
      label: 'Messages',
      href: '/profile' as const,
    },
    {
      icon: Calendar,
      label: t('bookings'),
      href: '/bookings' as const,
    },
    {
      icon: User,
      label: t('profile'),
      href: '/profile' as const,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t md:hidden">
      <div className="grid grid-cols-5 h-16">
        {navigationItems.map(item => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center space-y-1 text-xs transition-colors',
                isActive
                  ? 'text-shutter-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon
                className={cn('h-5 w-5', isActive && 'text-shutter-primary')}
              />
              <span className={cn('text-xs', isActive && 'font-medium')}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
