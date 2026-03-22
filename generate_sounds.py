"""
Generuje pliki dźwiękowe WAV za pomocą numpy/scipy i konwertuje do MP3.
Jeśli brak pydub, zapisuje jako WAV z rozszerzeniem .mp3 (przeglądarki i tak obsługują WAV).
"""
import numpy as np
import wave
import struct
import os

OUTPUT_DIR = "D:/studia/projekt grupowy/frontend/public/sounds"
os.makedirs(OUTPUT_DIR, exist_ok=True)

SAMPLE_RATE = 44100

def save_wav(filename, samples, sr=SAMPLE_RATE):
    """Zapisuje tablicę float64 [-1,1] jako plik WAV 16-bit."""
    samples = np.clip(samples, -1.0, 1.0)
    data = (samples * 32767).astype(np.int16)
    path = os.path.join(OUTPUT_DIR, filename)
    with wave.open(path, 'w') as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(sr)
        f.writeframes(data.tobytes())
    print(f"  Zapisano: {path}")
    return path

def envelope(t, attack=0.005, decay=0.05, sustain_level=0.7, release_ratio=0.3):
    """Prosta obwiednia ADSR."""
    total = len(t)
    env = np.ones(total)
    atk = int(attack * SAMPLE_RATE)
    dec = int(decay * SAMPLE_RATE)
    rel = int(release_ratio * total)

    for i in range(min(atk, total)):
        env[i] = i / atk
    for i in range(atk, min(atk + dec, total)):
        env[i] = 1.0 - (1.0 - sustain_level) * (i - atk) / dec
    for i in range(total - rel, total):
        env[i] = sustain_level * (total - i) / rel
    return env

def sine(freq, t):
    return np.sin(2 * np.pi * freq * t)

def square(freq, t, duty=0.5):
    return np.where(np.mod(t * freq, 1.0) < duty, 1.0, -1.0).astype(float)

def noise(t):
    return np.random.uniform(-1, 1, len(t))

# ────────────────────────────────────────────────────────────
# 1. correct.mp3 — przyjemny ding/chime (~0.5s)
# ────────────────────────────────────────────────────────────
def gen_correct():
    dur = 0.5
    t = np.linspace(0, dur, int(SAMPLE_RATE * dur), endpoint=False)
    # Dwa dźwięki: C5 + E5 + G5 (akord)
    freqs = [523.25, 659.25, 783.99]
    sig = sum(sine(f, t) for f in freqs) / len(freqs)
    env = np.exp(-t * 6)
    sig = sig * env
    save_wav("correct.mp3", sig)

# ────────────────────────────────────────────────────────────
# 2. wrong.mp3 — brzęczyk/błąd (~0.5s)
# ────────────────────────────────────────────────────────────
def gen_wrong():
    dur = 0.5
    t = np.linspace(0, dur, int(SAMPLE_RATE * dur), endpoint=False)
    # Niski square wave z detunem
    sig = 0.5 * square(150, t) + 0.3 * square(147, t)
    env = np.exp(-t * 4)
    # Krótki descending glide
    freq_sweep = 200 - 100 * t / dur
    sig2 = 0.2 * sine(freq_sweep * 1, t)
    sig = (sig + sig2) * env
    save_wav("wrong.mp3", sig * 0.8)

# ────────────────────────────────────────────────────────────
# 3. tick.mp3 — tykanie zegara (~0.1s)
# ────────────────────────────────────────────────────────────
def gen_tick():
    dur = 0.1
    t = np.linspace(0, dur, int(SAMPLE_RATE * dur), endpoint=False)
    # Krótki impuls + trochę szumu
    sig = 0.7 * sine(800, t) + 0.3 * noise(t)
    env = np.exp(-t * 60)
    sig = sig * env
    save_wav("tick.mp3", sig)

# ────────────────────────────────────────────────────────────
# 4. streak.mp3 — triumfalne fanfare (~1s)
# ────────────────────────────────────────────────────────────
def gen_streak():
    dur = 1.0
    t = np.linspace(0, dur, int(SAMPLE_RATE * dur), endpoint=False)
    # Rosnąca sekwencja nut: C5 → E5 → G5 → C6
    notes = [523.25, 659.25, 783.99, 1046.50]
    note_dur = dur / len(notes)
    sig = np.zeros_like(t)
    for i, freq in enumerate(notes):
        start = int(i * note_dur * SAMPLE_RATE)
        end = int((i + 1) * note_dur * SAMPLE_RATE)
        t_note = t[start:end] - i * note_dur
        chunk = sine(freq, t_note) + 0.3 * sine(freq * 2, t_note)
        env = np.exp(-t_note * 3)
        sig[start:end] = chunk * env
    # Globalna obwiednia
    global_env = np.ones_like(t)
    fade = int(0.1 * SAMPLE_RATE)
    global_env[-fade:] = np.linspace(1, 0, fade)
    sig = sig * global_env * 0.7
    save_wav("streak.mp3", sig)

# ────────────────────────────────────────────────────────────
# 5. gameover.mp3 — jingle końca gry (~1.5s)
# ────────────────────────────────────────────────────────────
def gen_gameover():
    dur = 1.5
    t = np.linspace(0, dur, int(SAMPLE_RATE * dur), endpoint=False)
    # Opadająca sekwencja: G4 → E4 → C4 → G3
    notes = [392.0, 329.63, 261.63, 196.0]
    note_dur = dur / len(notes)
    sig = np.zeros_like(t)
    for i, freq in enumerate(notes):
        start = int(i * note_dur * SAMPLE_RATE)
        end = int((i + 1) * note_dur * SAMPLE_RATE)
        t_note = t[start:end] - i * note_dur
        chunk = (0.6 * sine(freq, t_note) +
                 0.3 * sine(freq * 2, t_note) +
                 0.1 * square(freq, t_note))
        env = np.exp(-t_note * 2)
        sig[start:end] = chunk * env
    fade = int(0.15 * SAMPLE_RATE)
    sig[-fade:] *= np.linspace(1, 0, fade)
    save_wav("gameover.mp3", sig * 0.8)

# ────────────────────────────────────────────────────────────
# 6. click.mp3 — kliknięcie UI (~0.1s)
# ────────────────────────────────────────────────────────────
def gen_click():
    dur = 0.1
    t = np.linspace(0, dur, int(SAMPLE_RATE * dur), endpoint=False)
    sig = 0.5 * sine(1200, t) + 0.5 * noise(t)
    env = np.exp(-t * 80)
    sig = sig * env
    save_wav("click.mp3", sig)

# ────────────────────────────────────────────────────────────
# 7. countdown.mp3 — beep odliczania (~0.3s)
# ────────────────────────────────────────────────────────────
def gen_countdown():
    dur = 0.3
    t = np.linspace(0, dur, int(SAMPLE_RATE * dur), endpoint=False)
    sig = sine(880, t)
    env = np.exp(-t * 10)
    # Krótki attack
    atk = int(0.005 * SAMPLE_RATE)
    attack_ramp = np.ones_like(t)
    attack_ramp[:atk] = np.linspace(0, 1, atk)
    sig = sig * env * attack_ramp
    save_wav("countdown.mp3", sig * 0.8)

# ────────────────────────────────────────────────────────────
print("Generowanie dźwięków...")
gen_correct()
gen_wrong()
gen_tick()
gen_streak()
gen_gameover()
gen_click()
gen_countdown()
print("Gotowe! Wszystkie dźwięki zapisane.")

# Sprawdź czy pydub jest dostępny, żeby ewentualnie skonwertować do prawdziwego MP3
try:
    from pydub import AudioSegment
    print("\nKonwertuję WAV -> MP3 przez pydub...")
    for name in ["correct", "wrong", "tick", "streak", "gameover", "click", "countdown"]:
        wav_path = os.path.join(OUTPUT_DIR, f"{name}.mp3")
        # Nasze pliki są już nazwane .mp3 ale są WAV — konwertujemy
        tmp = wav_path + ".wav_tmp"
        os.rename(wav_path, tmp)
        seg = AudioSegment.from_wav(tmp)
        seg.export(wav_path, format="mp3", bitrate="128k")
        os.remove(tmp)
        print(f"  Skonwertowano: {name}.mp3")
    print("Konwersja zakończona.")
except ImportError:
    print("\npydub niedostępny — pliki zapisane jako WAV z rozszerzeniem .mp3")
    print("Przeglądarki obsługują WAV — wszystko działa poprawnie.")
