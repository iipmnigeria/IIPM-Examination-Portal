import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { recordLiveProctoringEvent } from '../services/identityProctoringService';
import type { ProctorEventType, SecureProctoringPolicy } from '../types';

export interface LocalProctorEventDetail {
  id: string;
  timestamp: string;
  type: ProctorEventType;
  severity: 'low' | 'medium' | 'high';
  message: string;
  aiGenerated?: boolean;
  confidence?: number;
  snapshotUrl?: string;
}

interface LiveProctoringEventBridgeProps {
  examSessionId?: string;
  proctoringSessionId?: string;
  policy?: SecureProctoringPolicy;
}

const mapEventType = (detail: LocalProctorEventDetail): string => {
  if (detail.type === 'tab_away') return detail.message.toLowerCase().includes('tab') ? 'visibility_hidden' : 'browser_focus_lost';
  if (detail.type === 'camera_disabled') return 'camera_disabled';
  if (detail.type === 'unauthorized_copy') {
    const message = detail.message.toLowerCase();
    if (message.includes('paste')) return 'clipboard_paste';
    if (message.includes('cut')) return 'clipboard_cut';
    if (message.includes('print')) return 'print_attempt';
    if (message.includes('developer') || message.includes('source') || message.includes('inspector')) return 'developer_tools_attempt';
    if (message.includes('screenshot') || message.includes('screen-capture')) return 'screenshot_attempt';
    return 'clipboard_copy';
  }
  return detail.type;
};

const dataUrlToBlob = (dataUrl: string): Blob => {
  const [header, encoded] = dataUrl.split(',', 2);
  if (!header || !encoded || !header.startsWith('data:image/')) {
    throw new Error('The visual evidence frame format is invalid.');
  }
  const mimeType = header.match(/^data:([^;]+);base64$/)?.[1] || 'image/jpeg';
  const bytes = atob(encoded);
  const buffer = new Uint8Array(bytes.length);
  for (let index = 0; index < bytes.length; index += 1) buffer[index] = bytes.charCodeAt(index);
  return new Blob([buffer], { type: mimeType });
};

export default function LiveProctoringEventBridge({ examSessionId, proctoringSessionId, policy }: LiveProctoringEventBridgeProps) {
  const sequence = useRef(0);
  const lastDirectEvent = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!proctoringSessionId || !policy?.liveEventCaptureEnabled) return;

    let active = true;
    const send = (
      eventType: string,
      severity: 'low' | 'medium' | 'high',
      message: string,
      metadata: Record<string, unknown> = {},
      occurredAt?: string,
      clientId?: string,
    ) => {
      if (!active) return;
      sequence.current += 1;
      const safeMetadata = {
        source: metadata.source || 'live_browser',
        viewport: { width: window.innerWidth, height: window.innerHeight },
        ...metadata,
      };
      void recordLiveProctoringEvent({
        proctoringSessionId,
        clientEventId: clientId || `browser-${Date.now()}-${sequence.current}`,
        eventType,
        severity,
        message,
        metadata: safeMetadata,
        occurredAt: occurredAt || new Date().toISOString(),
      }).then((result) => {
        if (result.terminated) {
          window.dispatchEvent(new CustomEvent('agilecert-proctor-terminated', {
            detail: { qualifyingFlagCount: result.qualifyingFlagCount, reason: result.terminationReason },
          }));
        }
      }).catch((error) => {
        console.warn('Live proctor event could not be persisted:', error);
      });
    };

    const persistSnapshot = async (detail: LocalProctorEventDetail): Promise<string | null> => {
      if (!detail.snapshotUrl || !examSessionId || !policy.retainWebcamImages) return null;
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw new Error('The candidate session is unavailable for evidence retention.');
      const blob = dataUrlToBlob(detail.snapshotUrl);
      const extension = blob.type === 'image/png' ? 'png' : 'jpg';
      const path = `${data.user.id}/${examSessionId}/${detail.id}-${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from('agilecert-proctor-evidence')
        .upload(path, blob, {
          cacheControl: '0',
          contentType: blob.type,
          upsert: false,
        });
      if (uploadError) throw uploadError;
      return path;
    };

    const localEvent = (event: Event) => {
      const detail = (event as CustomEvent<LocalProctorEventDetail>).detail;
      if (!detail) return;
      void (async () => {
        let snapshotPath: string | null = null;
        let snapshotRetentionError = false;
        if (detail.aiGenerated && detail.snapshotUrl && policy.retainWebcamImages) {
          try {
            snapshotPath = await persistSnapshot(detail);
          } catch (error) {
            snapshotRetentionError = true;
            console.warn('AI proctor snapshot could not be retained:', error);
          }
        }
        send(
          mapEventType(detail),
          detail.severity,
          detail.message,
          {
            source: detail.aiGenerated ? 'live_ai' : 'live_browser',
            confidence: typeof detail.confidence === 'number' ? detail.confidence : null,
            ...(snapshotPath ? { snapshotPath } : {}),
            ...(snapshotRetentionError ? { snapshotRetentionError: true } : {}),
          },
          detail.timestamp,
          detail.id,
        );
      })();
    };
    const fullscreen = () => send(
      document.fullscreenElement ? 'fullscreen_enter' : 'fullscreen_exit',
      document.fullscreenElement ? 'low' : 'medium',
      document.fullscreenElement ? 'Fullscreen examination mode entered.' : 'Fullscreen examination mode exited.',
      { source: 'live_browser' },
    );
    const online = () => send('network_online', 'low', 'Network connectivity restored.', { source: 'live_browser' });
    const offline = () => send('network_offline', 'medium', 'Network connectivity lost during the examination.', { source: 'live_browser' });
    const heartbeat = window.setInterval(() => send('session_heartbeat', 'low', 'Secure examination session heartbeat.', { source: 'live_browser' }), 30_000);

    window.addEventListener('agilecert-proctor-event', localEvent as EventListener);
    document.addEventListener('fullscreenchange', fullscreen);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    send('session_heartbeat', 'low', 'Secure examination live event bridge connected.', { source: 'live_browser' });

    return () => {
      active = false;
      window.clearInterval(heartbeat);
      window.removeEventListener('agilecert-proctor-event', localEvent as EventListener);
      document.removeEventListener('fullscreenchange', fullscreen);
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, [examSessionId, policy?.liveEventCaptureEnabled, policy?.retainWebcamImages, proctoringSessionId]);

  return null;
}
