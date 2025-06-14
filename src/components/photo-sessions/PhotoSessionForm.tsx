'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import {
  createPhotoSessionAction,
  updatePhotoSessionAction,
} from '@/app/actions/photo-session';
import {
  createPhotoSessionWithSlotsAction,
  updatePhotoSessionWithSlotsAction,
  PhotoSessionWithSlotsData,
} from '@/app/actions/photo-session-slots';
import type {
  PhotoSessionWithOrganizer,
  BookingType,
  BookingSettings,
} from '@/types/database';
import type { PhotoSessionSlot } from '@/types/photo-session';
import { useTranslations } from 'next-intl';
import { ImageUpload } from '@/components/photo-sessions/ImageUpload';
import { BookingTypeSelector } from '@/components/photo-sessions/BookingTypeSelector';
import { BookingSettingsForm } from '@/components/photo-sessions/BookingSettingsForm';
import PhotoSessionSlotForm from '@/components/photo-sessions/PhotoSessionSlotForm';
import { Label } from '@/components/ui/label';

interface PhotoSessionFormProps {
  initialData?: PhotoSessionWithOrganizer;
  isEditing?: boolean;
  isDuplicating?: boolean;
  onSuccess?: () => void;
}

export function PhotoSessionForm({
  initialData,
  isEditing = false,
  isDuplicating = false,
  onSuccess,
}: PhotoSessionFormProps) {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const t = useTranslations('photoSessions');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    title: isDuplicating
      ? `${initialData?.title || ''} (複製)`
      : initialData?.title || '',
    description: initialData?.description || '',
    location: initialData?.location || '',
    address: initialData?.address || '',
    start_time: initialData?.start_time
      ? new Date(initialData.start_time).toISOString().slice(0, 16)
      : '',
    end_time: initialData?.end_time
      ? new Date(initialData.end_time).toISOString().slice(0, 16)
      : '',
    max_participants: initialData?.max_participants || 1,
    price_per_person: initialData?.price_per_person || 0,
    booking_type: (initialData?.booking_type as BookingType) || 'first_come',
    is_published: isDuplicating ? false : initialData?.is_published || false,
    image_urls: isDuplicating ? [] : initialData?.image_urls || [],
  });

  const [bookingSettings, setBookingSettings] = useState<BookingSettings>({});
  const [photoSessionSlots, setPhotoSessionSlots] = useState<
    PhotoSessionSlot[]
  >([]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 0 : value,
    }));
  };

  const handleSwitchChange = (checked: boolean) => {
    setFormData(prev => ({ ...prev, is_published: checked }));
  };

  const handleImageUrlsChange = (urls: string[]) => {
    setFormData(prev => ({ ...prev, image_urls: urls }));
  };

  const handleBookingTypeChange = (bookingType: BookingType) => {
    setFormData(prev => ({ ...prev, booking_type: bookingType }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({
        title: tErrors('title'),
        description: tErrors('unauthorized'),
        variant: 'destructive',
      });
      return;
    }

    // バリデーション
    if (!formData.title.trim()) {
      toast({
        title: tErrors('title'),
        description: t('form.validation.titleRequired'),
        variant: 'destructive',
      });
      return;
    }

    if (!formData.location.trim()) {
      toast({
        title: tErrors('title'),
        description: t('form.validation.locationRequired'),
        variant: 'destructive',
      });
      return;
    }

    if (!formData.start_time || !formData.end_time) {
      toast({
        title: tErrors('title'),
        description: t('form.validation.dateTimeRequired'),
        variant: 'destructive',
      });
      return;
    }

    const startTime = new Date(formData.start_time);
    const endTime = new Date(formData.end_time);
    const now = new Date();

    if (startTime <= now) {
      toast({
        title: tErrors('title'),
        description: t('form.validation.startTimeInvalid'),
        variant: 'destructive',
      });
      return;
    }

    if (endTime <= startTime) {
      toast({
        title: tErrors('title'),
        description: t('form.validation.endTimeInvalid'),
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      // スロットがある場合とない場合で使用するactionを切り替え
      const hasSlots = photoSessionSlots && photoSessionSlots.length > 0;

      if (hasSlots) {
        // スロット制撮影会の場合
        const sessionWithSlotsData: PhotoSessionWithSlotsData = {
          title: formData.title,
          description: formData.description || undefined,
          location: formData.location,
          address: formData.address || undefined,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          max_participants: formData.max_participants,
          price_per_person: formData.price_per_person,
          booking_type: formData.booking_type,
          booking_settings: bookingSettings as Record<string, unknown>,
          is_published: formData.is_published,
          image_urls: formData.image_urls,
          slots: photoSessionSlots.map(slot => ({
            slot_number: slot.slot_number,
            start_time: slot.start_time,
            end_time: slot.end_time,
            break_duration_minutes: slot.break_duration_minutes,
            price_per_person: slot.price_per_person,
            max_participants: slot.max_participants,
            costume_image_url: slot.costume_image_url,
            costume_image_hash: slot.costume_image_hash,
            costume_description: slot.costume_description,
            discount_type: slot.discount_type,
            discount_value: slot.discount_value,
            discount_condition: slot.discount_condition,
            notes: slot.notes,
          })),
        };

        let result;

        if (isEditing && initialData) {
          result = await updatePhotoSessionWithSlotsAction(
            initialData.id,
            sessionWithSlotsData
          );
        } else {
          result =
            await createPhotoSessionWithSlotsAction(sessionWithSlotsData);
        }

        if (result.error) {
          console.error('スロット制撮影会保存エラー:', result.error);
          toast({
            title: tErrors('title'),
            description: t('form.error.saveFailed'),
            variant: 'destructive',
          });
          return;
        }
      } else {
        // 通常の撮影会の場合
        const sessionData = {
          title: formData.title,
          description: formData.description || undefined,
          location: formData.location,
          address: formData.address || undefined,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          max_participants: formData.max_participants,
          price_per_person: formData.price_per_person,
          booking_type: formData.booking_type,
          is_published: formData.is_published,
          image_urls: formData.image_urls,
          booking_settings: bookingSettings as Record<string, unknown>,
        };

        let result;

        if (isEditing && initialData) {
          result = await updatePhotoSessionAction(initialData.id, sessionData);
        } else {
          result = await createPhotoSessionAction(sessionData);
        }

        if (result.error) {
          console.error('撮影会保存エラー:', result.error);
          toast({
            title: tErrors('title'),
            description: t('form.error.saveFailed'),
            variant: 'destructive',
          });
          return;
        }
      }

      toast({
        title: tCommon('success'),
        description: isEditing
          ? t('form.success.updated')
          : t('form.success.created'),
      });

      if (onSuccess) {
        onSuccess();
      } else {
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('予期しないエラー:', error);
      toast({
        title: tErrors('title'),
        description: tErrors('unexpectedError'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="text-center">
          {isDuplicating
            ? t('form.duplicateTitle')
            : isEditing
              ? t('form.editTitle')
              : t('form.createTitle')}
        </CardTitle>
        <p className="text-center text-muted-foreground">
          {isDuplicating
            ? t('form.duplicateDescription')
            : isEditing
              ? t('form.editDescription')
              : t('form.createDescription')}
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 画像アップロード */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">イメージ画像</h3>
            <ImageUpload
              photoSessionId={initialData?.id || 'temp'}
              initialImages={formData.image_urls}
              onImagesChange={handleImageUrlsChange}
              maxImages={5}
              disabled={isLoading}
            />
          </div>

          {/* 基本情報 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">{t('form.basicInfo')}</h3>

            <div>
              <label htmlFor="title" className="block text-sm font-medium mb-2">
                {t('form.titleLabel')} {t('form.required')}
              </label>
              <Input
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder={t('form.titlePlaceholder')}
                required
              />
            </div>

            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium mb-2"
              >
                {t('form.descriptionLabel')}
              </label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder={t('form.descriptionPlaceholder')}
                rows={4}
              />
            </div>
          </div>

          {/* 場所情報 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">{t('form.locationInfo')}</h3>

            <div>
              <label
                htmlFor="location"
                className="block text-sm font-medium mb-2"
              >
                {t('form.locationLabel')} {t('form.required')}
              </label>
              <Input
                id="location"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                placeholder={t('form.locationPlaceholder')}
                required
              />
            </div>

            <div>
              <label
                htmlFor="address"
                className="block text-sm font-medium mb-2"
              >
                {t('form.addressLabel')}
              </label>
              <Input
                id="address"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                placeholder={t('form.addressPlaceholder')}
              />
            </div>
          </div>

          {/* 日時情報 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">{t('form.dateTimeInfo')}</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="start_time"
                  className="block text-sm font-medium mb-2"
                >
                  {t('form.startTimeLabel')} {t('form.required')}
                </label>
                <Input
                  id="start_time"
                  name="start_time"
                  type="datetime-local"
                  value={formData.start_time}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="end_time"
                  className="block text-sm font-medium mb-2"
                >
                  {t('form.endTimeLabel')} {t('form.required')}
                </label>
                <Input
                  id="end_time"
                  name="end_time"
                  type="datetime-local"
                  value={formData.end_time}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>
          </div>

          {/* 参加者・料金情報 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">{t('form.participantInfo')}</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="max_participants"
                  className="block text-sm font-medium mb-2"
                >
                  {t('form.maxParticipantsLabel')} {t('form.required')}
                </label>
                <Input
                  id="max_participants"
                  name="max_participants"
                  type="number"
                  min="1"
                  max="100"
                  value={formData.max_participants}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="price_per_person"
                  className="block text-sm font-medium mb-2"
                >
                  {t('form.priceLabel')} {t('form.required')}
                </label>
                <Input
                  id="price_per_person"
                  name="price_per_person"
                  type="number"
                  min="0"
                  max="1000000"
                  value={formData.price_per_person}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>
          </div>

          {/* 予約方式選択 */}
          <BookingTypeSelector
            value={formData.booking_type}
            onChange={handleBookingTypeChange}
            disabled={isLoading}
          />

          {/* 予約設定 */}
          <BookingSettingsForm
            bookingType={formData.booking_type}
            settings={bookingSettings}
            onChange={setBookingSettings}
            disabled={isLoading}
          />

          {/* スロット設定 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">スロット設定</h3>
            <p className="text-sm text-muted-foreground">
              時間枠を細分化して、枠ごとに料金・衣装・参加者数を設定できます
            </p>

            <PhotoSessionSlotForm
              photoSessionId={initialData?.id || 'temp'}
              onSlotsChange={setPhotoSessionSlots}
              baseDate={
                formData.start_time
                  ? formData.start_time.split('T')[0]
                  : undefined
              }
              locale="ja"
            />
          </div>

          {/* 複数枠割引設定 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">複数枠割引設定</h3>
            <p className="text-sm text-muted-foreground">
              複数のスロットを予約した場合に適用される割引を設定できます
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="multi_slot_discount_threshold">
                  適用条件（枠数）
                </Label>
                <Input
                  id="multi_slot_discount_threshold"
                  type="number"
                  min="2"
                  max="10"
                  placeholder="例: 2"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  この枠数以上で割引適用
                </p>
              </div>

              <div>
                <Label htmlFor="multi_slot_discount_type">割引タイプ</Label>
                <select
                  id="multi_slot_discount_type"
                  className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="none">割引なし</option>
                  <option value="percentage">パーセンテージ割引</option>
                  <option value="fixed_amount">固定金額割引</option>
                </select>
              </div>

              <div>
                <Label htmlFor="multi_slot_discount_value">割引値</Label>
                <Input
                  id="multi_slot_discount_value"
                  type="number"
                  min="0"
                  placeholder="例: 10 または 1000"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  %または円で入力
                </p>
              </div>
            </div>

            <div>
              <Label htmlFor="multi_slot_discount_description">割引説明</Label>
              <Textarea
                id="multi_slot_discount_description"
                placeholder="例: 2枠以上のご予約で10%割引！"
                rows={2}
                className="mt-1"
              />
            </div>
          </div>

          {/* 公開設定 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">{t('form.publishSettings')}</h3>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <label className="text-base font-medium">
                  {t('form.publishLabel')}
                </label>
                <p className="text-sm text-muted-foreground">
                  {t('form.publishDescription')}
                </p>
              </div>
              <Switch
                checked={formData.is_published}
                onCheckedChange={handleSwitchChange}
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                {isEditing ? t('form.updating') : t('form.creating')}
              </>
            ) : isEditing ? (
              t('form.updateButton')
            ) : (
              t('form.createButton')
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
