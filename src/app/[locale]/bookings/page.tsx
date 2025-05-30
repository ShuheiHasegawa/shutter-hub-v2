import { useTranslations } from 'next-intl';
import { MainLayout } from '@/components/layout/main-layout';

export default function BookingsPage() {
  const t = useTranslations('pages.bookings');

  return (
    <MainLayout>
      <div className="container py-8">
        <h1 className="text-3xl font-bold mb-8">{t('title')}</h1>
        <p className="text-muted-foreground">{t('placeholder')}</p>
      </div>
    </MainLayout>
  );
}
