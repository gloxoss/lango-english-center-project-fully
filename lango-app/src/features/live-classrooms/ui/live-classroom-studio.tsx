'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic, MicOff, Video, VideoOff, MonitorUp, Users, MessageSquare,
  PhoneOff, Maximize, Sparkles, CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  sessionTitle: string;
  teacherName: string;
  className?: string;
  onClose: () => void;
  externalJoinUrl?: string;
  roster?: Array<{ userId: string; name: string; role: string }>;
};

export function LiveClassroomStudio({
  sessionTitle,
  teacherName,
  className,
  onClose,
  externalJoinUrl,
  roster = [],
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'video' | 'roster' | 'chat'>('video');
  const [messages, setMessages] = useState<Array<{ sender: string; text: string; time: string }>>([
    { sender: 'Système SchoolOS', text: 'Bienvenue dans la classe virtuelle en direct.', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
  ]);
  const [newMessage, setNewMessage] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Timer for class duration
  useEffect(() => {
    const timer = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDuration = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Start local camera and microphone stream
  useEffect(() => {
    let localStream: MediaStream | null = null;
    async function initMedia() {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        });
        setStream(localStream);
        if (videoRef.current) {
          videoRef.current.srcObject = localStream;
        }
      } catch (err) {
        console.warn('Media access error or denied:', err);
        setMediaError('Caméra ou microphone non accessible (autorisation requise).');
      }
    }
    initMedia();

    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Mic toggle
  const toggleMic = () => {
    if (stream) {
      stream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMicMuted(prev => !prev);
    }
  };

  // Cam toggle
  const toggleCam = () => {
    if (stream) {
      stream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsCamOff(prev => !prev);
    }
  };

  // Screen share toggle
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      // Revert to camera
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setStream(camStream);
        if (videoRef.current) videoRef.current.srcObject = camStream;
        setIsScreenSharing(false);
      } catch (err) {
        console.error(err);
      }
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        setStream(screenStream);
        if (videoRef.current) videoRef.current.srcObject = screenStream;
        setIsScreenSharing(true);

        screenStream.getVideoTracks()[0]?.addEventListener('ended', () => {
          setIsScreenSharing(false);
          toggleCam();
        });
      } catch (err) {
        console.warn('Screen share cancelled', err);
      }
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    setMessages(prev => [
      ...prev,
      {
        sender: teacherName || 'Enseignant',
        text: newMessage.trim(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setNewMessage('');
  };

  return (
    <div className="rounded-2xl border border-slate-900 bg-slate-950 text-white shadow-2xl overflow-hidden text-start">
      {/* Top Bar */}
      <div className="px-5 py-3.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 text-[11px] font-extrabold tracking-wider uppercase">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span>En Direct</span>
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-white tracking-tight">{sessionTitle}</h2>
            <p className="text-[11px] text-slate-400">
              {className ? `${className} • ` : ''}Enseignant: {teacherName} • Durée: <span className="text-emerald-400 font-mono font-bold">{formatDuration(elapsedSeconds)}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {externalJoinUrl && (
            <a
              href={externalJoinUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-bold text-sky-400 hover:text-sky-300 px-3 py-1.5 rounded-xl border border-sky-500/30 bg-sky-950/40"
              title="Ouvrir dans un onglet séparé (Jitsi)"
            >
              Lien externe ↗
            </a>
          )}
          <Button
            size="sm"
            variant="destructive"
            onClick={onClose}
            className="h-8 rounded-xl px-3 text-xs font-bold bg-rose-600 hover:bg-rose-700"
          >
            <PhoneOff className="w-3.5 h-3.5 me-1" /> Quitter la salle
          </Button>
        </div>
      </div>

      {/* Main Studio Area */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-0 min-h-[520px]">
        {/* Main Video Screen */}
        <div className={`relative bg-black flex items-center justify-center overflow-hidden ${activeTab === 'video' ? 'lg:col-span-4' : 'lg:col-span-3'}`}>
          {isCamOff ? (
            <div className="text-center space-y-3 p-8">
              <div className="w-24 h-24 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-3xl font-black text-slate-300 mx-auto">
                {teacherName?.charAt(0) || 'E'}
              </div>
              <p className="text-xs font-bold text-slate-400">Caméra désactivée</p>
            </div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover max-h-[560px]"
            />
          )}

          {mediaError && (
            <div className="absolute top-4 left-4 right-4 bg-amber-500/90 text-black text-xs font-bold px-3 py-2 rounded-xl backdrop-blur-sm">
              {mediaError}
            </div>
          )}

          {/* Video Overlay Info */}
          <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-xs font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>{teacherName} (Hôte)</span>
            {isMicMuted && <MicOff className="w-3.5 h-3.5 text-rose-400" />}
          </div>
        </div>

        {/* Right Sidebar: Chat or Roster */}
        {activeTab !== 'video' && (
          <div className="bg-slate-900 border-l border-slate-800 flex flex-col h-full max-h-[560px]">
            <div className="p-3 border-b border-slate-800 flex items-center justify-between text-xs font-bold">
              <span>{activeTab === 'chat' ? 'Discussion en direct' : 'Participants connectés'}</span>
              <button onClick={() => setActiveTab('video')} className="text-slate-400 hover:text-white text-[11px]">
                Fermer ✕
              </button>
            </div>

            {activeTab === 'chat' && (
              <>
                <div className="flex-1 p-3 overflow-y-auto space-y-2.5 text-xs">
                  {messages.map((m, i) => (
                    <div key={i} className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/50 space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                        <span>{m.sender}</span>
                        <span>{m.time}</span>
                      </div>
                      <p className="text-slate-200">{m.text}</p>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-800 flex gap-2">
                  <input
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    placeholder="Écrire un message..."
                    className="flex-1 h-9 rounded-xl bg-slate-800 border border-slate-700 px-3 text-xs text-white focus:outline-none focus:border-sky-500"
                  />
                  <Button size="sm" type="submit" className="h-9 px-3 bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold rounded-xl">
                    Envoyer
                  </Button>
                </form>
              </>
            )}

            {activeTab === 'roster' && (
              <div className="flex-1 p-3 overflow-y-auto space-y-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-xs">
                      {teacherName?.charAt(0) || 'H'}
                    </div>
                    <div>
                      <p className="font-bold text-slate-200">{teacherName} (Vous)</p>
                      <p className="text-[10px] text-emerald-400">Enseignant • Hôte</p>
                    </div>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>

                {roster.map((r, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center text-xs">
                        {r.name?.charAt(0) || 'E'}
                      </div>
                      <div>
                        <p className="font-bold text-slate-200">{r.name}</p>
                        <p className="text-[10px] text-slate-400">{r.role}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-500/30">
                      Présent
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Interactive Bottom Control Toolbar */}
      <div className="px-6 py-4 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
        {/* Left: Device status */}
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>Studio Intégré SchoolOS (Zéro compte requis)</span>
        </div>

        {/* Center: Controls */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={toggleMic}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition shadow-xs cursor-pointer ${
              isMicMuted ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-slate-800 text-white hover:bg-slate-700'
            }`}
            title={isMicMuted ? 'Activer le micro' : 'Couper le micro'}
          >
            {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <button
            onClick={toggleCam}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition shadow-xs cursor-pointer ${
              isCamOff ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-slate-800 text-white hover:bg-slate-700'
            }`}
            title={isCamOff ? 'Activer la caméra' : 'Couper la caméra'}
          >
            {isCamOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>

          <button
            onClick={toggleScreenShare}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition shadow-xs cursor-pointer ${
              isScreenSharing ? 'bg-sky-600 text-white hover:bg-sky-700' : 'bg-slate-800 text-white hover:bg-slate-700'
            }`}
            title={isScreenSharing ? 'Arrêter le partage d\'écran' : 'Partager l\'écran'}
          >
            <MonitorUp className="w-5 h-5" />
          </button>
        </div>

        {/* Right: Panels */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab(prev => prev === 'chat' ? 'video' : 'chat')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'chat' ? 'bg-[#2487B8] text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Chat ({messages.length})</span>
          </button>

          <button
            onClick={() => setActiveTab(prev => prev === 'roster' ? 'video' : 'roster')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'roster' ? 'bg-[#2487B8] text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Participants</span>
          </button>
        </div>
      </div>
    </div>
  );
}
