export type PunchAudioAction = "in" | "out";

const THANK_YOU_AUDIO = "/audio/thank-you.wav";

/** Slightly faster playback for a snappy thank-you. */
const VOICE_PLAYBACK_RATE = 1.12;

let sharedAudioContext: AudioContext | null = null;
let voicesPrimed = false;
let thankYouClip: HTMLAudioElement | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  const Ctor =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!Ctor) return null;

  if (!sharedAudioContext) {
    sharedAudioContext = new Ctor();
  }

  return sharedAudioContext;
}

function primeSpeechVoices(): void {
  if (typeof window === "undefined" || !window.speechSynthesis || voicesPrimed) return;
  voicesPrimed = true;
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}

function preloadThankYouClip(): HTMLAudioElement {
  if (thankYouClip) return thankYouClip;

  const audio = new Audio(THANK_YOU_AUDIO);
  audio.preload = "auto";
  audio.playbackRate = VOICE_PLAYBACK_RATE;
  audio.load();
  thankYouClip = audio;
  return audio;
}

/** Call from a user gesture (Punch In / Punch Out tap) so mobile browsers allow audio. */
export function unlockPunchAudio(): void {
  primeSpeechVoices();
  const ctx = getAudioContext();
  if (ctx?.state === "suspended") {
    void ctx.resume();
  }
  preloadThankYouClip();
}

function playSoftChime(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const startAt = ctx.currentTime + 0.01;
  const notes = [
    { freq: 659.25, at: 0, dur: 0.1 },
    { freq: 783.99, at: 0.08, dur: 0.14 },
  ];

  notes.forEach(({ freq, at, dur }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, startAt + at);
    gain.gain.setValueAtTime(0.0001, startAt + at);
    gain.gain.exponentialRampToValueAtTime(0.1, startAt + at + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + at + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startAt + at);
    osc.stop(startAt + at + dur + 0.02);
  });
}

function pickSweetVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;

  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  const ranked = [
    (v: SpeechSynthesisVoice) => /zira|samantha|karen|moira|veena|priya|female|natural/i.test(v.name),
    (v: SpeechSynthesisVoice) => v.lang.startsWith("en"),
  ];

  for (const match of ranked) {
    const voice = voices.find(match);
    if (voice) return voice;
  }

  return null;
}

function speakThankYouFallback(): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance("Thank you!");
  utterance.lang = "en-US";
  utterance.rate = 1.15;
  utterance.pitch = 1.05;
  utterance.volume = 1;

  const voice = pickSweetVoice();
  if (voice) utterance.voice = voice;

  window.speechSynthesis.speak(utterance);
}

async function playRecordedThankYou(): Promise<void> {
  const audio = preloadThankYouClip();
  try {
    audio.pause();
    audio.currentTime = 0;
    audio.volume = 1;
    audio.playbackRate = VOICE_PLAYBACK_RATE;
    await audio.play();
  } catch {
    speakThankYouFallback();
  }
}

/** Short chime + quick “Thank you!” after a successful punch. */
export function playPunchSuccessFeedback(_action: PunchAudioAction): void {
  try {
    playSoftChime();
    window.setTimeout(() => {
      void playRecordedThankYou();
    }, 160);
  } catch {
    void playRecordedThankYou();
  }
}
