'use client';

import { useState, useEffect } from 'react';
import { logger } from '@/lib/utils/logger';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileText,
  CheckCircle,
  Clock,
  Users,
  Eye,
  Signature,
  Shield,
  FileCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface PhotoSessionDocumentsProps {
  sessionId: string;
  currentUserId: string;
  isOrganizer: boolean;
  participants: Array<{
    id: string;
    user_id: string;
    status: string;
    user: {
      id: string;
      display_name: string;
      email: string;
    };
  }>;
}

interface Document {
  id: string;
  title: string;
  type: 'consent' | 'contract' | 'portrait_rights' | 'guidelines' | 'other';
  content: string;
  is_required: boolean;
  created_at: string;
  updated_at: string;
}

interface DocumentSignature {
  id: string;
  document_id: string;
  user_id: string;
  signed_at: string;
  signature_data?: string;
  ip_address?: string;
  user_agent?: string;
}

export function PhotoSessionDocuments({
  sessionId,
  currentUserId,
  isOrganizer,
  participants,
}: PhotoSessionDocumentsProps) {
  const t = useTranslations('photoSessions.documents');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [signatures, setSignatures] = useState<DocumentSignature[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingDocument, setSigningDocument] = useState<string | null>(null);

  useEffect(() => {
    loadDocuments();

    // フォールバック: 10秒後にローディングを強制終了
    const timeout = setTimeout(() => {
      if (loading) {
        logger.warn('Document loading timeout - forcing completion');
        setLoading(false);
      }
    }, 10000);

    return () => clearTimeout(timeout);
  }, [sessionId]);

  useEffect(() => {
    if (documents.length > 0) {
      loadSignatures();
    } else if (documents.length === 0 && !loading) {
      // documentsが空でローディングが終了している場合
      setLoading(false);
    }
  }, [documents, loading]);

  const loadDocuments = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('photo_session_documents')
        .select('*')
        .eq('photo_session_id', sessionId)
        .order('created_at', { ascending: false });

      if (error) {
        // テーブルが存在しない場合は空配列を設定
        if (error.code === '42P01') {
          logger.warn('Document system not yet available - migration required');
          setDocuments([]);
          setLoading(false);
          return;
        }
        throw error;
      }
      setDocuments(data || []);

      // documentsが空の場合はここでローディングを終了
      if (!data || data.length === 0) {
        setLoading(false);
      }
    } catch (error) {
      logger.error('Load documents error:', error);
      setDocuments([]);
      setLoading(false);
      toast.error(t('errorLoadingDocuments'));
    }
  };

  const loadSignatures = async () => {
    try {
      const supabase = createClient();
      const documentIds = documents.map(d => d.id);

      if (documentIds.length === 0) {
        setSignatures([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('document_signatures')
        .select('*')
        .in('document_id', documentIds)
        .order('signed_at', { ascending: false });

      if (error) {
        // テーブルが存在しない場合は空配列を設定
        if (error.code === '42P01') {
          logger.warn(
            'Signature system not yet available - migration required'
          );
          setSignatures([]);
          setLoading(false);
          return;
        }
        logger.error('Signature query error:', error);
        throw error;
      }
      setSignatures(data || []);
    } catch (error) {
      logger.error('Load signatures error:', error);
      setSignatures([]);
    } finally {
      setLoading(false);
    }
  };

  const signDocument = async (documentId: string) => {
    setSigningDocument(documentId);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('document_signatures')
        .insert({
          document_id: documentId,
          user_id: currentUserId,
          signed_at: new Date().toISOString(),
          ip_address: 'client_ip',
          user_agent: navigator.userAgent,
        })
        .select()
        .single();

      if (error) throw error;

      setSignatures(prev => [data, ...prev]);
      toast.success(t('documentSigned'));
    } catch (error) {
      logger.error('Sign document error:', error);
      toast.error(t('errorSigningDocument'));
    } finally {
      setSigningDocument(null);
    }
  };

  const getDocumentTypeLabel = (type: string) => {
    const labels = {
      consent: t('types.consent'),
      contract: t('types.contract'),
      portrait_rights: t('types.portraitRights'),
      guidelines: t('types.guidelines'),
      other: t('types.other'),
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getDocumentTypeIcon = (type: string) => {
    const icons = {
      consent: Shield,
      contract: FileText,
      portrait_rights: Eye,
      guidelines: FileCheck,
      other: FileText,
    };
    const Icon = icons[type as keyof typeof icons] || FileText;
    return <Icon className="h-4 w-4" />;
  };

  const isDocumentSigned = (documentId: string) => {
    return signatures.some(
      s => s.document_id === documentId && s.user_id === currentUserId
    );
  };

  const getSignatureStats = (documentId: string) => {
    const documentSignatures = signatures.filter(
      s => s.document_id === documentId
    );
    const totalParticipants = participants.filter(
      p => p.status === 'confirmed'
    ).length;
    return {
      signed: documentSignatures.length,
      total: totalParticipants,
      percentage:
        totalParticipants > 0
          ? Math.round((documentSignatures.length / totalParticipants) * 100)
          : 0,
    };
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  if (documents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">{t('noDocuments')}</p>
            {isOrganizer && (
              <p className="text-sm text-muted-foreground mt-2">
                {t('createFirstDocument')}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          {t('title')}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {documents.map(document => {
            const signed = isDocumentSigned(document.id);
            const stats = getSignatureStats(document.id);

            return (
              <Card key={document.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {getDocumentTypeIcon(document.type)}
                        <h3 className="font-medium">{document.title}</h3>
                        {document.is_required && (
                          <Badge variant="destructive" className="text-xs">
                            {t('required')}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {getDocumentTypeLabel(document.type)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {signed ? (
                        <Badge
                          variant="default"
                          className="flex items-center gap-1"
                        >
                          <CheckCircle className="h-3 w-3" />
                          {t('signed')}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="flex items-center gap-1"
                        >
                          <Clock className="h-3 w-3" />
                          {t('pending')}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm text-muted-foreground line-clamp-3">
                    {document.content}
                  </div>

                  {isOrganizer && (
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        <span>
                          {stats.signed}/{stats.total} 署名済み (
                          {stats.percentage}%)
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-2" />
                          {t('viewDocument')}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[80vh]">
                        <DialogHeader>
                          <DialogTitle>{document.title}</DialogTitle>
                          <DialogDescription>
                            {getDocumentTypeLabel(document.type)}
                          </DialogDescription>
                        </DialogHeader>
                        <ScrollArea className="h-[60vh] w-full rounded-md border p-4">
                          <div className="whitespace-pre-wrap text-sm">
                            {document.content}
                          </div>
                        </ScrollArea>
                        {!signed && (
                          <div className="flex items-center space-x-2 pt-4 border-t">
                            <Checkbox
                              id={`agree-${document.id}`}
                              onCheckedChange={checked => {
                                if (checked) {
                                  signDocument(document.id);
                                }
                              }}
                              disabled={signingDocument === document.id}
                            />
                            <Label
                              htmlFor={`agree-${document.id}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              {t('agreeAndSign')}
                            </Label>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>

                    {!signed && (
                      <Button
                        size="sm"
                        onClick={() => signDocument(document.id)}
                        disabled={signingDocument === document.id}
                      >
                        {signingDocument === document.id ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            {t('signing')}
                          </>
                        ) : (
                          <>
                            <Signature className="h-4 w-4 mr-2" />
                            {t('signDocument')}
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
