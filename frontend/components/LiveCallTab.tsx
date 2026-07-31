'use client';

import { useEffect, useRef, useState } from 'react';

type Contact = { name: string; code: string };
type CallStatus = 'idle' | 'calling' | 'incoming' | 'in-call';

const MY_CODE_KEY = 'sfa_my_code';
const CONTACTS_KEY = 'sfa_contacts';

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I ambiguity
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

export default function LiveCallTab() {
  const [myCode, setMyCode] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [dialCode, setDialCode] = useState('');
  const [status, setStatus] = useState<CallStatus>('idle');
  const [statusMsg, setStatusMsg] = useState('Not connected yet.');
  const [boostOn, setBoostOn] = useState(true);
  const [incomingFrom, setIncomingFrom] = useState<string | null>(null);

  const peerRef = useRef<any>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const currentCallRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const keepAliveElRef = useRef<HTMLAudioElement | null>(null);

  // Load / create permanent code + saved contacts, then register with PeerJS
  useEffect(() => {
    let code = localStorage.getItem(MY_CODE_KEY);
    if (!code) {
      code = generateCode();
      localStorage.setItem(MY_CODE_KEY, code);
    }
    setMyCode(code);

    const savedContacts = localStorage.getItem(CONTACTS_KEY);
    if (savedContacts) {
      try {
        setContacts(JSON.parse(savedContacts));
      } catch {
        // ignore corrupt storage
      }
    }

    let peer: any;
    import('peerjs').then(({ default: Peer }) => {
      // ExpressTURN free tier (1000GB/month, no credit card) — signed up at
      // expressturn.com. Overridable via env vars if credentials rotate.
      const turnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME || '000000002100783781';
      const turnCredential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL || 'Cfeq2p2JQmUUfaM1sg4pQnjIP84=';
      peer = new Peer(code!, {
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:free.expressturn.com:3478' },
            { urls: 'turn:free.expressturn.com:3478', username: turnUsername, credential: turnCredential },
            { urls: 'turn:free.expressturn.com:3478?transport=tcp', username: turnUsername, credential: turnCredential },
          ],
        },
      });
      peerRef.current = peer;

      peer.on('open', () => setStatusMsg('Ready — share your code so others can call you.'));
      peer.on('error', (err: any) => setStatusMsg(`Connection error: ${err.type || err.message}`));

      peer.on('call', (call: any) => {
        setIncomingFrom(call.peer);
        setStatus('incoming');
        currentCallRef.current = call;
      });
    });

    return () => {
      peer?.destroy();
    };
  }, []);

  function saveContacts(next: Contact[]) {
    setContacts(next);
    localStorage.setItem(CONTACTS_KEY, JSON.stringify(next));
  }

  function addContact() {
    if (!newName.trim() || !newCode.trim()) return;
    saveContacts([...contacts, { name: newName.trim(), code: newCode.trim().toUpperCase() }]);
    setNewName('');
    setNewCode('');
  }

  function removeContact(code: string) {
    saveContacts(contacts.filter((c) => c.code !== code));
  }

  async function getLocalStream(): Promise<MediaStream> {
    if (!localStreamRef.current) {
      localStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    }
    return localStreamRef.current;
  }

  function playRemoteStreamEnhanced(remoteStream: MediaStream, ctx: AudioContext) {
    // Chrome quirk: createMediaStreamSource() on a WebRTC remote stream can
    // silently receive zero samples unless the stream is also attached to a
    // real <audio> element first. Kept muted — actual audible output still
    // comes from the Web Audio graph below.
    const keepAlive = document.createElement('audio');
    keepAlive.srcObject = remoteStream;
    keepAlive.muted = true;
    (keepAlive as any).playsInline = true;
    keepAlive.play().catch(() => {});
    keepAliveElRef.current = keepAlive;

    ctx.resume().catch(() => {});
    const source = ctx.createMediaStreamSource(remoteStream);

    const filter = ctx.createBiquadFilter();
    filter.type = 'peaking';
    filter.frequency.value = 2700;
    filter.Q.value = 0.9;
    filter.gain.value = boostOn ? 9 : 0;
    filterRef.current = filter;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -28;
    compressor.knee.value = 18;
    compressor.ratio.value = 6;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;

    source.connect(filter);
    filter.connect(compressor);
    compressor.connect(ctx.destination);
  }

  function watchIce(call: any) {
    const pc = call.peerConnection;
    if (!pc) return;
    pc.addEventListener('iceconnectionstatechange', () => {
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        setStatusMsg(`Connection ${pc.iceConnectionState} — network/NAT issue between the two devices.`);
      }
    });
  }

  async function callContact(code: string) {
    if (!peerRef.current) return;
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    setStatus('calling');
    setStatusMsg(`Calling ${code}…`);
    const stream = await getLocalStream();
    const call = peerRef.current.call(code, stream);
    currentCallRef.current = call;
    call.on('stream', (remoteStream: MediaStream) => {
      playRemoteStreamEnhanced(remoteStream, ctx);
      setStatus('in-call');
      setStatusMsg(`In call with ${code} — clarity boost is ${boostOn ? 'on' : 'off'}.`);
    });
    call.on('close', endCall);
    call.on('error', () => setStatusMsg('Call failed — check the code and try again.'));
    setTimeout(() => watchIce(call), 500);
  }

  async function acceptIncoming() {
    const call = currentCallRef.current;
    if (!call) return;
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const stream = await getLocalStream();
    call.answer(stream);
    call.on('stream', (remoteStream: MediaStream) => {
      playRemoteStreamEnhanced(remoteStream, ctx);
      setStatus('in-call');
      setStatusMsg(`In call with ${incomingFrom} — clarity boost is ${boostOn ? 'on' : 'off'}.`);
    });
    call.on('close', endCall);
    setTimeout(() => watchIce(call), 500);
  }

  function declineIncoming() {
    currentCallRef.current?.close();
    endCall();
  }

  function endCall() {
    currentCallRef.current?.close();
    currentCallRef.current = null;
    if (keepAliveElRef.current) {
      keepAliveElRef.current.pause();
      keepAliveElRef.current.srcObject = null;
      keepAliveElRef.current = null;
    }
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setStatus('idle');
    setIncomingFrom(null);
    setStatusMsg('Call ended. Ready for the next one.');
  }

  useEffect(() => {
    if (filterRef.current) filterRef.current.gain.value = boostOn ? 9 : 0;
  }, [boostOn]);

  return (
    <div className="panel">
      <span className="pill">Live</span>
      <h2>Live call</h2>
      <p className="lede">
        Every device gets a permanent code. Save a friend's code once, then call
        them like a contact. Incoming audio gets the same clarity boost — live,
        during the call — as the rest of the app.
      </p>

      <div className="big-toggle">
        <div>
          <strong>Your code</strong>
          <div style={{ fontSize: '1.8rem', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, letterSpacing: '0.1em' }}>
            {myCode || '······'}
          </div>
        </div>
      </div>
      <div className="status-line">{statusMsg}</div>

      {status === 'incoming' && (
        <div className="note-box" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span>Incoming call from <strong>{incomingFrom}</strong></span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="primary-btn" onClick={acceptIncoming}>Accept</button>
            <button className="ghost-btn" onClick={declineIncoming}>Decline</button>
          </div>
        </div>
      )}

      {status === 'in-call' && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 14 }}>
          <button className="ghost-btn" onClick={endCall}>Hang up</button>
          <button className="ghost-btn" onClick={() => setBoostOn((v) => !v)}>
            Clarity boost: {boostOn ? 'On' : 'Off'}
          </button>
        </div>
      )}

      {status === 'idle' && (
        <>
          <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '28px 0' }} />
          <h3>Call by code</h3>
          <div className="field-row">
            <label htmlFor="dial-code">Enter a code</label>
            <input
              id="dial-code"
              type="text"
              value={dialCode}
              onChange={(e) => setDialCode(e.target.value.toUpperCase())}
              placeholder="e.g. K3F9QZ"
              style={{ flex: 1, padding: 10, fontSize: '1rem', border: '2px solid var(--ink)', borderRadius: 6 }}
            />
            <button className="primary-btn" disabled={!dialCode} onClick={() => callContact(dialCode)}>
              Call
            </button>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '28px 0' }} />
          <h3>Contacts</h3>
          <div className="field-row">
            <input
              type="text"
              placeholder="Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              style={{ flex: 1, padding: 10, border: '2px solid var(--ink)', borderRadius: 6 }}
            />
            <input
              type="text"
              placeholder="Their code"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value.toUpperCase())}
              style={{ flex: 1, padding: 10, border: '2px solid var(--ink)', borderRadius: 6 }}
            />
            <button className="ghost-btn" onClick={addContact}>Save</button>
          </div>

          {contacts.length === 0 && <p className="status-line">No saved contacts yet.</p>}
          {contacts.map((c) => (
            <div key={c.code} className="big-toggle" style={{ marginTop: 10 }}>
              <div style={{ flex: 1 }}>
                <strong>{c.name}</strong>
                <div className="status-line">{c.code}</div>
              </div>
              <button className="primary-btn" onClick={() => callContact(c.code)}>Call</button>
              <button className="ghost-btn" onClick={() => removeContact(c.code)}>Remove</button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
