'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  Mic, MicOff, Video, VideoOff, MonitorUp, PhoneOff, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  sessionTitle: string;
  onClose: () => void;
};

export function LiveClassroomStudio({
  sessionTitle: _sessionTitle,
  onClose,
}: Props) {
  const t = useTranslations('LiveClassrooms');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  // Stop all tracks helper
  const stopStream = (stream: MediaStream | null) => {
    if (stream) {
      stream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
    }
  };

  // Acquire camera stream
  const startCamera = useCallback(async () => {
    try {
      setMediaError(null);
      // Clean up previous screen stream if any
      if (screenStreamRef.current) {
        stopStream(screenStreamRef.current);
        screenStreamRef.current = null;
      }
      // Clean up previous camera stream if any
      if (cameraStreamRef.current) {
        stopStream(cameraStreamRef.current);
        cameraStreamRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      cameraStreamRef.current = stream;
      setActiveStream(stream);
      setIsScreenSharing(false);
      setIsCamOff(false);
      setIsMicMuted(false);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn('Media access error or denied:', err);
      setMediaError(t('camError'));
    }
  }, [t]);

  // Clean shutdown
  const handleClose = useCallback(() => {
    if (cameraStreamRef.current) {
      stopStream(cameraStreamRef.current);
      cameraStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      stopStream(screenStreamRef.current);
      screenStreamRef.current = null;
    }
    setActiveStream(null);
    onClose();
  }, [onClose]);

  // Initialize camera on mount
  useEffect(() => {
    startCamera();

    return () => {
      // Stop all tracks of all streams on close / unmount
      if (cameraStreamRef.current) {
        stopStream(cameraStreamRef.current);
        cameraStreamRef.current = null;
      }
      if (screenStreamRef.current) {
        stopStream(screenStreamRef.current);
        screenStreamRef.current = null;
      }
    };
  }, [startCamera]);

  // Mic toggle
  const toggleMic = () => {
    if (activeStream) {
      activeStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMicMuted(prev => !prev);
    }
  };

  // Cam toggle
  const toggleCam = () => {
    if (activeStream && !isScreenSharing) {
      activeStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsCamOff(prev => !prev);
    }
  };

  // Screen share toggle
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      // Revert to camera
      await startCamera();
    } else {
      try {
        setMediaError(null);
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });

        // Stop screen tracks when user clicks browser's native "Stop sharing"
        screenStream.getVideoTracks()[0]?.addEventListener('ended', () => {
          stopStream(screenStream);
          screenStreamRef.current = null;
          startCamera();
        });

        // Store screen stream in ref
        screenStreamRef.current = screenStream;
        setActiveStream(screenStream);
        setIsScreenSharing(true);

        if (videoRef.current) {
          videoRef.current.srcObject = screenStream;
        }
      } catch (err) {
        console.warn('Screen share cancelled or failed:', err);
      }
    }
  };

  return (
    <div className="rounded-2xl border border-slate-900 bg-slate-950 text-white shadow-2xl overflow-hidden text-start">
      {/* Top Bar */}
      <div className="px-5 py-3.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-extrabold tracking-wider uppercase">
            <span>{t('localPreviewBadge')}</span>
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-white tracking-tight">{t('testCameraMicHeading')}</h2>
            <p className="text-[11px] text-slate-400">
              {t('testCameraMicDesc')}
            </p>
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={handleClose}
          className="h-8 rounded-xl px-3 text-xs font-bold border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white cursor-pointer"
        >
          <PhoneOff className="w-3.5 h-3.5 me-1" /> {t('closeTestBtn')}
        </Button>
      </div>

      {/* Main Preview Area */}
      <div className="relative bg-black flex items-center justify-center overflow-hidden min-h-[360px] max-h-[440px]">
        {isCamOff && !isScreenSharing ? (
          <div className="text-center space-y-2 p-8">
            <VideoOff className="w-12 h-12 text-slate-500 mx-auto" />
            <p className="text-xs font-bold text-slate-400">{t('camDisabled')}</p>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover min-h-[360px] max-h-[440px]"
          />
        )}

        {mediaError && (
          <div className="absolute top-4 left-4 right-4 bg-amber-500/90 text-black text-xs font-bold px-3 py-2 rounded-xl backdrop-blur-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{mediaError}</span>
          </div>
        )}
      </div>

      {/* Control Toolbar */}
      <div className="px-6 py-3.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>{isScreenSharing ? t('screenShareActive') : isCamOff ? t('camOffStatus') : t('camActiveStatus')}</span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={toggleMic}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition shadow-xs cursor-pointer ${
              isMicMuted ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-slate-800 text-white hover:bg-slate-700'
            }`}
            title={isMicMuted ? t('turnOnMic') : t('turnOffMic')}
          >
            {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <button
            onClick={toggleCam}
            disabled={isScreenSharing}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition shadow-xs cursor-pointer disabled:opacity-40 ${
              isCamOff ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-slate-800 text-white hover:bg-slate-700'
            }`}
            title={isCamOff ? t('turnOnCam') : t('turnOffCam')}
          >
            {isCamOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
          </button>

          <button
            onClick={toggleScreenShare}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition shadow-xs cursor-pointer ${
              isScreenSharing ? 'bg-sky-600 text-white hover:bg-sky-700' : 'bg-slate-800 text-white hover:bg-slate-700'
            }`}
            title={isScreenSharing ? t('stopScreenShare') : t('testScreenShare')}
          >
            <MonitorUp className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
