"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type InstrumentId = "kick" | "bass" | "pad" | "lead";

type PatternState = Record<InstrumentId, boolean[]>;

const STEPS = 16;

const instruments: {
  id: InstrumentId;
  name: string;
  description: string;
}[] = [
  {
    id: "kick",
    name: "کیک",
    description: "ضربه‌های ثابت چهار-چهار برای ستون فقرات ترنس"
  },
  {
    id: "bass",
    name: "بیس",
    description: "بیس رقصان برای انرژی ریتمیک"
  },
  {
    id: "pad",
    name: "پد",
    description: "آکوردهای فضایی برای حس اتمسفریک"
  },
  {
    id: "lead",
    name: "لید",
    description: "ملودی اصلی با صدای درخشان"
  }
];

const createPresetPattern = (): PatternState => ({
  kick: Array.from({ length: STEPS }, (_, i) => i % 4 === 0),
  bass: Array.from({ length: STEPS }, (_, i) => i % 2 === 0 && (i % 4 === 0 || i % 4 === 2)),
  pad: Array.from({ length: STEPS }, (_, i) => i % 4 === 0),
  lead: [
    true,
    false,
    false,
    false,
    true,
    false,
    true,
    false,
    false,
    true,
    false,
    false,
    true,
    false,
    true,
    false
  ]
});

export default function Page() {
  const [patterns, setPatterns] = useState<PatternState>(() => createPresetPattern());
  const [bpm, setBpm] = useState(138);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState<number | null>(null);

  const patternsRef = useRef(patterns);
  const synthsRef = useRef<Record<InstrumentId, any>>({
    kick: null,
    bass: null,
    pad: null,
    lead: null
  });
  const sequencesRef = useRef<Record<InstrumentId, any> | null>(null);
  const toneRef = useRef<any>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    patternsRef.current = patterns;
  }, [patterns]);

  useEffect(() => {
    if (!toneRef.current) {
      return;
    }
    toneRef.current.Transport.bpm.rampTo(bpm, 0.15);
  }, [bpm]);

  const loadTone = useCallback(async () => {
    if (toneRef.current) {
      return toneRef.current;
    }
    const tone = await import("tone");
    toneRef.current = tone;
    return tone;
  }, []);

  const initializeAudio = useCallback(async () => {
    const Tone = await loadTone();

    if (mountedRef.current) {
      Tone.Transport.bpm.value = bpm;
      return Tone;
    }

    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.02,
      octaves: 4,
      oscillator: { type: "sine" },
      envelope: {
        attack: 0.001,
        decay: 0.16,
        sustain: 0.01,
        release: 0.4
      }
    }).connect(new Tone.Compressor({ threshold: -20, ratio: 4 })).toDestination();

    const bass = new Tone.MonoSynth({
      oscillator: { type: "square" },
      filter: {
        type: "lowpass",
        rolloff: -24,
        Q: 1.2
      },
      envelope: {
        attack: 0.01,
        decay: 0.25,
        sustain: 0.2,
        release: 0.4
      },
      filterEnvelope: {
        attack: 0.001,
        decay: 0.2,
        sustain: 0,
        release: 0.2,
        baseFrequency: 80,
        octaves: 3
      }
    }).toDestination();

    const pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sawtooth" },
      envelope: {
        attack: 0.5,
        decay: 0.5,
        sustain: 0.7,
        release: 1.5
      }
    }).connect(new Tone.Reverb({ decay: 4, wet: 0.4 })).toDestination();

    const lead = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: {
        attack: 0.05,
        decay: 0.2,
        sustain: 0.6,
        release: 0.5
      }
    })
      .connect(new Tone.Delay(0.25, 0.4))
      .connect(new Tone.Reverb({ decay: 3, wet: 0.3 }))
      .toDestination();

    synthsRef.current = { kick, bass, pad, lead };

    Tone.Transport.bpm.value = bpm;
    const sequences: Record<InstrumentId, any> = {
      kick: new Tone.Sequence((time: number, step: number) => {
        Tone.Draw.schedule(() => setCurrentStep(step), time);
        if (patternsRef.current.kick[step]) {
          kick.triggerAttackRelease("C2", "8n", time);
        }
      }, Array.from({ length: STEPS }, (_, i) => i), "16n"),
      bass: new Tone.Sequence((time: number, step: number) => {
        if (patternsRef.current.bass[step]) {
          const notes = ["C2", "G1", "A1", "F1"];
          const note = notes[Math.floor(step / 4) % notes.length];
          bass.triggerAttackRelease(note, "8n", time, 0.8);
        }
      }, Array.from({ length: STEPS }, (_, i) => i), "16n"),
      pad: new Tone.Sequence((time: number, step: number) => {
        if (patternsRef.current.pad[step]) {
          const chordProgression: string[][] = [
            ["C4", "E4", "G4"],
            ["A3", "C4", "E4"],
            ["F3", "A3", "C4"],
            ["G3", "B3", "D4"]
          ];
          const chord = chordProgression[Math.floor(step / 4) % chordProgression.length];
          pad.triggerAttackRelease(chord, "2n", time, 0.4);
        }
      }, Array.from({ length: STEPS }, (_, i) => i), "4n"),
      lead: new Tone.Sequence((time: number, step: number) => {
        if (patternsRef.current.lead[step]) {
          const scale = ["C5", "D5", "E5", "G5", "A5", "B5", "C6"];
          const note = scale[(step * 2) % scale.length];
          lead.triggerAttackRelease(note, "16n", time, 0.7);
        }
      }, Array.from({ length: STEPS }, (_, i) => i), "16n")
    };

    sequencesRef.current = sequences;
    mountedRef.current = true;
    return Tone;
  }, [bpm, loadTone]);

  const togglePlayback = useCallback(async () => {
    const Tone = await initializeAudio();
    await Tone.start();

    if (!sequencesRef.current) {
      return;
    }

    if (isPlaying) {
      Tone.Transport.stop();
      Object.values(sequencesRef.current).forEach((sequence) => sequence.stop());
      setIsPlaying(false);
      setCurrentStep(null);
      return;
    }

    Tone.Transport.position = "0:0:0";
    Object.values(sequencesRef.current).forEach((sequence) => sequence.start(0));
    Tone.Transport.start("+0.1");
    setIsPlaying(true);
  }, [initializeAudio, isPlaying]);

  useEffect(() => {
    return () => {
      if (!toneRef.current) {
        return;
      }
      const Tone = toneRef.current;
      Tone.Transport.stop();
      Tone.Transport.cancel();
      Object.values(sequencesRef.current ?? {}).forEach((sequence) => sequence.dispose());
      Object.values(synthsRef.current ?? {}).forEach((synth) => synth?.dispose());
    };
  }, []);

  const toggleStep = useCallback(
    (instrument: InstrumentId, step: number) => {
      setPatterns((prev) => {
        const next = prev[instrument].map((value, index) =>
          index === step ? !value : value
        );
        return {
          ...prev,
          [instrument]: next
        };
      });
    },
    []
  );

  const setPreset = useCallback(() => {
    setPatterns(createPresetPattern());
  }, []);

  const clearPattern = useCallback(() => {
    setPatterns({
      kick: Array(STEPS).fill(false),
      bass: Array(STEPS).fill(false),
      pad: Array(STEPS).fill(false),
      lead: Array(STEPS).fill(false)
    });
  }, []);

  const randomizeLead = useCallback(() => {
    setPatterns((prev) => ({
      ...prev,
      lead: Array.from({ length: STEPS }, () => Math.random() > 0.6)
    }));
  }, []);

  const infoBlocks = useMemo(
    () => [
      {
        title: "ساختار آهنگ",
        text: "از کیک ثابت برای پایه‌ی ریتم استفاده کنید، سپس بیس و پد را برای حس پرش و فضای ملودیک اضافه کنید."
      },
      {
        title: "ریتم ترنس",
        text: "تمپو ۱۳۰ تا ۱۴۰ BPM متداول است. سعی کنید هر چهار ضرب یک اکورد یا ملودی جدید معرفی کنید."
      },
      {
        title: "صدا سازی",
        text: "برای لید از شکل موج اره‌ای یا مثلثی استفاده کنید و با دیلی و ریورب بافت ایجاد کنید."
      },
      {
        title: "کاربرد",
        text: "الگوهای ساخته شده را ضبط یا اسکرین رکورد کنید تا ایده‌ها را به آهنگسازی کامل تبدیل نمایید."
      }
    ],
    []
  );

  return (
    <main className="app">
      <section className="surface">
        <header className="header">
          <div>
            <h1 className="title">Trance Studio</h1>
            <p className="subtitle">
              با استفاده از سینتی‌سایزرهای داخل مرورگر، الگوهای ترنس بسازید، تمپو را تنظیم کنید و
              لیدهای تصادفی خلق نمایید.
            </p>
          </div>
          <div className="controls">
            <button className="primary-button" onClick={togglePlayback}>
              {isPlaying ? "توقف" : "پخش"}
            </button>
            <div className="tempo-control">
              <label htmlFor="tempo">تمپو: {bpm} BPM</label>
              <input
                className="slider"
                id="tempo"
                type="range"
                min={120}
                max={150}
                value={bpm}
                onChange={(event) => setBpm(Number(event.target.value))}
              />
            </div>
          </div>
        </header>
      </section>

      <section className="surface">
        <div className="controls" style={{ justifyContent: "space-between" }}>
          <div className="controls">
            <button className="secondary-button" onClick={setPreset}>
              الگوی پیش‌فرض
            </button>
            <button className="secondary-button" onClick={clearPattern}>
              پاک کردن
            </button>
          </div>
          <button className="secondary-button" onClick={randomizeLead}>
            لید تصادفی
          </button>
        </div>

        <div className="sequencer-grid" style={{ marginTop: 24 }}>
          {instruments.map((instrument) => (
            <div key={instrument.id} className="track">
              <div className="track-header">
                <span className="track-name">{instrument.name}</span>
                <span className="info-text">{instrument.description}</span>
              </div>
              <div className="step-row">
                {patterns[instrument.id].map((active, index) => {
                  const isCurrent = currentStep === index && isPlaying;
                  return (
                    <button
                      key={index}
                      className={`step${active ? " active" : ""}${isCurrent ? " current" : ""}`}
                      onClick={() => toggleStep(instrument.id, index)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="surface info-card">
        {infoBlocks.map((block) => (
          <div key={block.title} className="info-block">
            <div className="info-title">{block.title}</div>
            <div className="info-text">{block.text}</div>
          </div>
        ))}
      </section>
    </main>
  );
}
