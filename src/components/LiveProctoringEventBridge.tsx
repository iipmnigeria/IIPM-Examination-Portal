import { useEffect, useRef } from 'react';
import { recordLiveProctoringEvent } from '../services/identityProctoringService';
import type { ProctorEventType, SecureProctoringPolicy } from '../types';

export interface LocalProctorEventDetail {
  id: string;
  timestamp: string;
  type: ProctorEventType;
  severity: 'low' | 'medium' | 'high';
  message: string;
  aiGenerated?: boolean;
}

interface LiveProctoringEventBridgeProps {
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

export default function LiveProctoringEventBridge({ proctoringSessionId, policy }: LiveProctoringEventBridgeProps) {
  const sequence = useRef(0);

  useEffect(() => {
    if (!proctoringSessionId || !policy?.liveEventCaptureEnabled) return;

    let active = true;
    const send = (eventType: string, severity: 'low' | 'medium' | 'high', message: string, metadata: Record<string, unknown> = {}, occurredAt?: string, clientId?: string) => {
      if (!active) return;
      sequence.current += 1;
      const safeMetadata = {
        source: metadata.source || 'browser_runtime',
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
      }).catch((error) => {
        console.warn('Live proctor event could not be persisted:', error);
      });
    };

    const localEvent = (event: Event) => {
      const detail = (event as CustomEvent<LocalProctorEventDetail>).detail;
      if (!detail) return;
      send(mapEventType(detail), detail.severity, detail.message, { source: detail.aiGenerated ? 'ai_analysis' : 'exam_runtime' }, detail.timestamp, detail.id);
    };
    const fullscreen = () => send(document.fullscreenElement ? 'fullscreen_enter' : 'fullscreen_exit', document.fullscreenElement ? 'low' : 'medium', document.fullscreenElement ? 'Fullscreen examination mode entered.' : 'Fullscreen examination mode exited.');
    const online = () => send('network_online', 'low', 'Network connectivity restored.');
    const offline = () => send('network_offline', 'medium', 'Network connectivity lost during the examination.');
    const heartbeat = window.setInterval(() => send('session_heartbeat', 'low', 'Secure examination session heartbeat.'), 30_000);

    window.addEventListener('agilecert-proctor-event', localEvent as EventListener);
    document.addEventListener('fullscreenchange', fullscreen);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    send('session_heartbeat', 'low', 'Secure examination live event bridge connected.');

    return () => {
      active = false;
      window.clearInterval(heartbeat);
      window.removeEventListener('agilecert-proctor-event', localEvent as EventListener);
      document.removeEventListener('fullscreenchange', fullscreen);
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, [policy?.liveEventCaptureEnabled, proctoringSessionId]);

  return null;
}
