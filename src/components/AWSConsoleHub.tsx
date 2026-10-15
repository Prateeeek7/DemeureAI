import React, { useState, useEffect, useRef } from 'react';
import { Database, FileCode, Mail, Volume2, Cloud, HelpCircle, Terminal, RefreshCw, Upload, Send, Play } from 'lucide-react';
import { api, errorMessage, ACCEPTED_UPLOADS, MAX_UPLOAD_BYTES } from '../lib/api';

interface AWSLog {
  timestamp: string;
  service: string;
  action: string;
  status: string;
  details: string;
}

interface AWSStatus {
  isLive: boolean;
  region: string;
  s3Bucket: string;
  sesSender: string;
  services: {
    DynamoDB: string;
    S3: string;
    SES: string;
    Polly: string;
  };
  logs: AWSLog[];
}

export default function AWSConsoleHub() {
  const [status, setStatus] = useState<AWSStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(true);

  // Polly Playground State
  const [pollyText, setPollyText] = useState('Welcome to Demeure AI. Secure Campus Protocols are fully operational.');
  const [pollyVoice, setPollyVoice] = useState('Joanna');
  const [pollyStatus, setPollyStatus] = useState('');
  const [pollyPlaying, setPollyPlaying] = useState(false);
  const pollyAudioRef = useRef<HTMLAudioElement | null>(null);

  // SES Playground State
  const [sesEmail, setSesEmail] = useState('');
  const [sesSubject, setSesSubject] = useState('Demeure AI Security Alert');
  const [sesBody, setSesBody] = useState('Initiated Broad Dispatch: Sensor anomaly detected in Block A.');
  const [sesStatus, setSesStatus] = useState('');

  // S3 Playground State
  const [s3File, setS3File] = useState<File | null>(null);
  const [s3Status, setS3Status] = useState('');
  const [s3Url, setS3Url] = useState('');

  // Poll AWS Status for live log updates
  useEffect(() => {
    let active = true;
    const load = () => api.get<AWSStatus>('/api/aws/status').then(
      data => { if (active) { setStatus(data); setLoading(false); } },
      () => { if (active) setLoading(false); },
    );
    load();
    const intervalId = polling ? setInterval(load, 3000) : undefined;
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [polling]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (pollyAudioRef.current) {
        pollyAudioRef.current.pause();
      }
    };
  }, []);

  // Polly Speech Synthesizer Action
  const triggerPolly = async () => {
    if (!pollyText.trim()) return;
    
    // Stop ongoing audio
    if (pollyAudioRef.current) {
      pollyAudioRef.current.pause();
      pollyAudioRef.current = null;
      setPollyPlaying(false);
    }

    setPollyStatus('Synthesizing speech via AWS Polly...');
    
    try {
      const data = await api.post<{ audioContent: string }>('/api/aws/polly/synthesize', { text: pollyText, voiceId: pollyVoice });

      if (data.audioContent) {
        const audio = new Audio("data:audio/mp3;base64," + data.audioContent);
        pollyAudioRef.current = audio;
        setPollyPlaying(true);
        setPollyStatus('Playing audio stream...');
        audio.play();
        audio.onended = () => {
          setPollyPlaying(false);
          setPollyStatus('Playback completed.');
        };
      } else {
        // Fallback locally
        setPollyStatus('AWS credentials unconfigured. Falling back to browser SpeechSynthesis...');
        if ('speechSynthesis' in window) {
          setPollyPlaying(true);
          const utterance = new SpeechSynthesisUtterance(pollyText);
          utterance.onend = () => {
            setPollyPlaying(false);
            setPollyStatus('Playback completed.');
          };
          window.speechSynthesis.speak(utterance);
        } else {
          setPollyStatus('TTS not supported in this browser.');
        }
      }
    } catch (err) {
      setPollyStatus(`Synthesis failed: ${errorMessage(err)}`);
    }
  };

  // SES Email Action
  const triggerSES = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sesEmail.trim()) {
      setSesStatus('Error: Recipient email is required');
      return;
    }

    setSesStatus('Firing email request...');
    try {
      await api.post('/api/aws/ses/test', { email: sesEmail, subject: sesSubject, body: sesBody });
      setSesStatus('Email processed! Check logs below.');
    } catch (err) {
      setSesStatus(`SES dispatch failed: ${errorMessage(err)}`);
    }
  };

  // S3 File Upload Action
  const triggerS3 = async () => {
    if (!s3File) return;

    setS3Status('Uploading file...');
    setS3Url('');

    try {
      const data = await api.upload<{ url: string }>('/api/aws/s3/upload', s3File);
      setS3Url(data.url);
      setS3Status('Upload complete!');
      setS3File(null);
    } catch (err) {
      setS3Status(`Upload failed: ${errorMessage(err)}`);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 font-mono text-xs text-slate-gray">
        <RefreshCw className="w-8 h-8 animate-spin text-navy-accent mb-4" />
        <span>ESTABLISHING AWS CORE SIGNALS...</span>
      </div>
    );
  }

  const isLive = status?.isLive ?? false;

  return (
    <div className="space-y-8">
      {/* Module Title */}
      <div className="border-b border-charcoal/10 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-slate-gray">Module // 09</span>
          <h2 className="font-serif text-3xl font-bold text-navy-accent">AWS Services Operations Control</h2>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => { setPolling(!polling); }}
            className={`flex items-center gap-2 border px-3 py-1.5 font-mono text-[10px] uppercase transition-all shadow-sm ${
              polling 
                ? 'bg-forest-status/10 border-forest-status/30 text-forest-status' 
                : 'bg-surface-white border-charcoal/10 text-slate-gray'
            }`}
          >
            <RefreshCw className={`w-3 h-3 ${polling ? 'animate-spin' : ''}`} />
            {polling ? 'Auto Refresh: Active' : 'Auto Refresh: Paused'}
          </button>
        </div>
      </div>

      {/* SECTION 1: AWS Connection Status (Full Width) */}
      <div className="border border-charcoal/10 bg-surface-white p-6 space-y-6 rounded-sm shadow-sm">
        <div className="flex items-center gap-2 border-b border-charcoal/10 pb-3">
          <Cloud className="w-5 h-5 text-navy-accent" />
          <h3 className="font-serif font-bold text-lg text-charcoal">AWS Connection Status</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Credential diagnostic box */}
          <div className={`p-5 border rounded-sm font-mono text-xs leading-relaxed space-y-3 ${
            isLive ? 'border-forest-status/40 bg-emerald-50/60' : 'border-amber-500/40 bg-amber-50/60'
          }`}>
            <div className="flex justify-between items-center border-b border-charcoal/10 pb-2">
              <span className="font-bold text-charcoal text-sm">SYSTEM MODE:</span>
              <span className={`font-bold px-2.5 py-1 text-xs rounded-sm ${
                isLive ? 'bg-forest-status text-white' : 'bg-amber-600 text-white'
              }`}>
                {isLive ? 'AWS LIVE CLOUD' : 'MOCK LOCAL MODE'}
              </span>
            </div>
            
            {!isLive ? (
              <div className="space-y-2">
                <p className="text-xs text-charcoal font-medium">
                  AWS credentials not loaded in <code className="bg-amber-100 px-1.5 py-0.5 font-mono font-bold text-amber-950 rounded">backend/.env</code>. Operating in safe local mode.
                </p>
                <p className="text-xs text-charcoal/80 font-medium">To connect live, add these to your environment:</p>
                <pre className="bg-slate-900 text-amber-300 p-3 rounded-sm text-xs font-mono leading-relaxed overflow-x-auto select-all border border-slate-800">
                  AWS_ACCESS_KEY_ID=...{"\n"}
                  AWS_SECRET_ACCESS_KEY=...{"\n"}
                  AWS_DEFAULT_REGION=us-east-1
                </pre>
              </div>
            ) : (
              <p className="text-xs text-forest-status font-bold">
                ✓ Connected to AWS. Service calls are hitting your live AWS infrastructure.
              </p>
            )}

            {/* Info Grid */}
            <div className="border-t border-charcoal/15 pt-3 font-mono text-xs text-charcoal space-y-2">
              <div className="flex justify-between">
                <span className="font-semibold text-slate-gray">AWS Region:</span>
                <span className="text-navy-accent font-bold">{status?.region || 'us-east-1'}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-gray">S3 Target Bucket:</span>
                <span className="text-navy-accent font-bold">{status?.s3Bucket || 'demeure-assets'}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-gray">SES Sender Address:</span>
                <span className="text-navy-accent font-bold">{status?.sesSender || 'noreply@demeureai.com'}</span>
              </div>
            </div>
          </div>

          {/* Individual services list */}
          <div className="space-y-3 font-mono text-xs">
            <span className="font-semibold text-xs text-slate-gray uppercase block tracking-wider mb-1">Configured Services</span>
            {[
              { name: 'Amazon DynamoDB', state: status?.services.DynamoDB, icon: Database, details: 'Visitor logs & leave persistence' },
              { name: 'Amazon S3', state: status?.services.S3, icon: FileCode, details: 'Student leave attachment storage' },
              { name: 'Amazon SES', state: status?.services.SES, icon: Mail, details: 'Automated notification alerts' },
              { name: 'Amazon Polly', state: status?.services.Polly, icon: Volume2, details: 'AI response speech synthesizer' },
            ].map((svc) => (
              <div key={svc.name} className="p-3.5 border border-charcoal/15 bg-warm-ivory/50 rounded-sm flex items-center justify-between gap-3 shadow-sm hover:border-navy-accent/40 transition-colors">
                <div className="flex items-center gap-3">
                  <svc.icon className="w-5 h-5 text-navy-accent shrink-0" />
                  <div>
                    <span className="font-bold text-charcoal text-sm block">{svc.name}</span>
                    <span className="text-xs text-charcoal/70 block font-normal">{svc.details}</span>
                  </div>
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 border rounded-sm ${
                  svc.state?.includes('Connected') || svc.state?.includes('Live')
                    ? 'text-forest-status border-forest-status/40 bg-emerald-100/70' 
                    : 'text-charcoal border-charcoal/30 bg-gray-100'
                }`}>
                  {svc.state}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 2: AWS Integration Interactive Playground (Full Width) */}
      <div className="border border-charcoal/10 bg-surface-white p-6 space-y-6 rounded-sm shadow-sm">
        <div className="flex items-center gap-2 border-b border-charcoal/10 pb-3">
          <HelpCircle className="w-5 h-5 text-navy-accent" />
          <h3 className="font-serif font-bold text-lg text-charcoal">AWS Integration Interactive Playground</h3>
        </div>

        {/* Playground Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Polly Playpen */}
          <div className="border border-charcoal/15 p-5 bg-warm-ivory/30 rounded-sm flex flex-col justify-between space-y-4 font-mono text-xs shadow-sm">
            <div className="space-y-3">
              <div className="flex items-center gap-2 border-b border-charcoal/10 pb-2.5">
                <Volume2 className="w-4 h-4 text-navy-accent shrink-0" />
                <span className="font-bold text-charcoal text-sm">Polly TTS Voice</span>
              </div>
              <div>
                <label className="block text-xs font-semibold text-charcoal uppercase mb-1.5">Synthesizer Text</label>
                <textarea
                  rows={4}
                  value={pollyText}
                  onChange={(e) => setPollyText(e.target.value)}
                  className="w-full border border-charcoal/20 bg-surface-white p-2.5 text-xs text-charcoal outline-none focus:border-navy-accent rounded-sm resize-none"
                />
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-charcoal uppercase mb-1.5">Voice ID</label>
                <select 
                  value={pollyVoice} 
                  onChange={(e) => setPollyVoice(e.target.value)}
                  className="w-full border border-charcoal/20 bg-surface-white p-2.5 text-xs text-charcoal outline-none focus:border-navy-accent rounded-sm"
                >
                  <option value="Joanna">Joanna (US Female)</option>
                  <option value="Matthew">Matthew (US Male)</option>
                  <option value="Ivy">Ivy (US Child)</option>
                  <option value="Justin">Justin (US Male Child)</option>
                </select>
              </div>
            </div>

            <div className="pt-2 border-t border-charcoal/10">
              {pollyStatus && <p className="text-[11px] text-navy-accent font-semibold mb-2">{pollyStatus}</p>}
              <button 
                onClick={triggerPolly}
                disabled={pollyPlaying}
                className="w-full bg-navy-accent hover:bg-charcoal text-white text-xs font-semibold uppercase py-3 tracking-wider flex items-center justify-center gap-2 rounded-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Play className="w-3.5 h-3.5" /> {pollyPlaying ? 'Speaking...' : 'Speak (Synthesize)'}
              </button>
            </div>
          </div>

          {/* SES Email Dispatcher Playpen */}
          <div className="border border-charcoal/15 p-5 bg-warm-ivory/30 rounded-sm flex flex-col justify-between space-y-4 font-mono text-xs shadow-sm">
            <form onSubmit={triggerSES} className="space-y-3 flex flex-col justify-between h-full">
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-charcoal/10 pb-2.5">
                  <Mail className="w-4 h-4 text-navy-accent shrink-0" />
                  <span className="font-bold text-charcoal text-sm">SES Email Dispatch</span>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-charcoal uppercase mb-1.5">Recipient Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. parent@email.com"
                    value={sesEmail}
                    onChange={(e) => setSesEmail(e.target.value)}
                    className="w-full border border-charcoal/20 bg-surface-white p-2.5 text-xs text-charcoal outline-none focus:border-navy-accent rounded-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-charcoal uppercase mb-1.5">Subject</label>
                  <input
                    type="text"
                    placeholder="Subject"
                    value={sesSubject}
                    onChange={(e) => setSesSubject(e.target.value)}
                    className="w-full border border-charcoal/20 bg-surface-white p-2.5 text-xs text-charcoal outline-none focus:border-navy-accent rounded-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-charcoal uppercase mb-1.5">Message Body</label>
                  <textarea
                    rows={2}
                    value={sesBody}
                    onChange={(e) => setSesBody(e.target.value)}
                    className="w-full border border-charcoal/20 bg-surface-white p-2.5 text-xs text-charcoal outline-none focus:border-navy-accent rounded-sm resize-none"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-charcoal/10">
                {sesStatus && <p className="text-[11px] text-navy-accent font-semibold mb-2">{sesStatus}</p>}
                <button 
                  type="submit"
                  className="w-full bg-charcoal hover:bg-navy-accent text-white text-xs font-semibold uppercase py-3 tracking-wider flex items-center justify-center gap-2 rounded-sm shadow-sm transition-colors"
                >
                  <Send className="w-3.5 h-3.5" /> Dispatch Email
                </button>
              </div>
            </form>
          </div>

          {/* S3 File Upload Playpen */}
          <div className="border border-charcoal/15 p-5 bg-warm-ivory/30 rounded-sm flex flex-col justify-between space-y-4 font-mono text-xs shadow-sm">
            <div className="space-y-3">
              <div className="flex items-center gap-2 border-b border-charcoal/10 pb-2.5">
                <FileCode className="w-4 h-4 text-navy-accent shrink-0" />
                <span className="font-bold text-charcoal text-sm">S3 Asset Uploader</span>
              </div>
              
              <div className="border-2 border-dashed border-charcoal/30 p-6 bg-surface-white flex flex-col items-center justify-center space-y-2 text-center rounded-sm hover:border-navy-accent transition-colors">
                <Upload className="w-7 h-7 text-navy-accent" />
                <label className="cursor-pointer text-xs text-navy-accent font-bold underline">
                  Browse File
                  <input
                    type="file"
                    accept={ACCEPTED_UPLOADS}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > MAX_UPLOAD_BYTES) {
                        setS3File(null);
                        setS3Status('Upload failed: file is larger than 5 MB');
                        return;
                      }
                      setS3File(file);
                      setS3Status(`Selected: ${file.name}`);
                    }} 
                    className="hidden" 
                  />
                </label>
                {s3File ? (
                  <span className="text-xs text-charcoal font-semibold truncate max-w-[180px]">{s3File.name}</span>
                ) : (
                  <span className="text-[11px] text-slate-gray">PDF, PNG, JPG up to 5MB</span>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-charcoal/10">
              {s3Status && <p className="text-[11px] text-navy-accent font-semibold mb-1 truncate">{s3Status}</p>}
              {s3Url && (
                <a 
                  href={s3Url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-xs text-forest-status font-bold underline block mb-2"
                >
                  ✓ View Uploaded Asset →
                </a>
              )}
              <button 
                onClick={triggerS3}
                disabled={!s3File}
                className="w-full bg-navy-accent hover:bg-charcoal text-white text-xs font-semibold uppercase py-3 tracking-wider flex items-center justify-center gap-2 rounded-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Upload className="w-3.5 h-3.5" /> Upload to S3
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* Live Logs Terminal Screen */}
      <div className="border border-charcoal/10 bg-surface-white p-6 rounded-sm shadow-sm">
        <div className="flex justify-between items-center border-b border-charcoal/10 pb-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-navy-accent" />
            <h3 className="font-serif font-bold text-lg text-charcoal">AWS SDK Call Log Console</h3>
          </div>
          <span className="font-mono text-xs text-forest-status font-bold animate-pulse border border-forest-status/30 bg-emerald-50 px-2.5 py-1 rounded-sm">
            SDK INTERCEPTOR ACTIVE
          </span>
        </div>
        
        <p className="font-mono text-xs text-charcoal/80 mt-2 mb-4 leading-relaxed font-medium">
          Displays real-time logs of calls made to DynamoDB, S3, SES, and Polly (polling every 3 seconds). If credentials are not configured, calls are simulated locally (records persist to SQLite, files to local disk).
        </p>

        {/* Console Box */}
        <div style={{ backgroundColor: '#0a0e17' }} className="rounded-sm border border-charcoal/30 p-4 font-mono text-xs text-emerald-400 h-64 overflow-y-auto space-y-2 select-text shadow-inner">
          {(!status || !status.logs || status.logs.length === 0) ? (
            <div className="text-slate-400 animate-pulse">Initializing SDK interceptor logs...</div>
          ) : (
            status.logs.map((log, idx) => (
              <div key={idx} className="flex flex-col sm:flex-row gap-2 border-b border-white/5 pb-1.5">
                <span className="text-slate-400 text-xs shrink-0 font-normal">[{log.timestamp}]</span>
                <span className={`font-bold shrink-0 uppercase text-xs ${
                  log.service === 'SYSTEM' ? 'text-blue-400' :
                  log.service === 'DynamoDB' ? 'text-amber-300' :
                  log.service === 'S3' ? 'text-emerald-300' :
                  log.service === 'Polly' ? 'text-pink-400' : 'text-purple-300'
                }`}>
                  {log.service}
                </span>
                <span className="text-gray-300 font-semibold shrink-0 uppercase text-xs">({log.action})</span>
                <span className={`font-bold text-xs shrink-0 ${
                  log.status === 'SUCCESS' ? 'text-emerald-400' :
                  log.status === 'MOCK' ? 'text-cyan-300' : 'text-rose-400 animate-pulse'
                }`}>
                  [{log.status}]
                </span>
                <span className="text-slate-200 break-words flex-1 text-xs">{log.details}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
