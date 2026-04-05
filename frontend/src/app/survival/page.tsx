'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { useLocale } from '@/lib/LocaleContext';

type GameState = 'idle' | 'playing' | 'gameover';

interface Question {
  id: number;
  text: string;
  options: string[];
  correct: number;
}

const FALLBACK_QUESTIONS: Question[] = [
  { id: 1, text: 'Który kraj jest największy powierzchniowo?', options: ['Kanada', 'Rosja', 'Chiny', 'USA'], correct: 1 },
  { id: 2, text: 'Ile planet ma Układ Słoneczny?', options: ['7', '8', '9', '10'], correct: 1 },
  { id: 3, text: 'Kto napisał "Pana Tadeusza"?', options: ['Słowacki', 'Norwid', 'Mickiewicz', 'Krasicki'], correct: 2 },
  { id: 4, text: 'Jaka jest stolica Australii?', options: ['Sydney', 'Melbourne', 'Brisbane', 'Canberra'], correct: 3 },
  { id: 5, text: 'Który pierwiastek ma symbol chemiczny "Au"?', options: ['Srebro', 'Miedź', 'Złoto', 'Platyna'], correct: 2 },
  { id: 6, text: 'W którym roku wybuchła II Wojna Światowa?', options: ['1937', '1938', '1939', '1940'], correct: 2 },
  { id: 7, text: 'Ile cm ma metr?', options: ['10', '100', '1000', '10000'], correct: 1 },
  { id: 8, text: 'Kto namalował "Mona Lisę"?', options: ['Picasso', 'Rembrandt', 'van Gogh', 'Leonardo da Vinci'], correct: 3 },
  { id: 9, text: 'Jaki jest najdłuższy ocean?', options: ['Atlantycki', 'Spokojny', 'Indyjski', 'Arktyczny'], correct: 1 },
  { id: 10, text: 'Ile boków ma sześciokąt?', options: ['5', '6', '7', '8'], correct: 1 },
  { id: 11, text: 'Co jest stolicą Japonii?', options: ['Osaka', 'Kyoto', 'Tokio', 'Hiroszima'], correct: 2 },
  { id: 12, text: 'Ile minut ma godzina?', options: ['30', '45', '60', '100'], correct: 2 },
  { id: 13, text: 'Który kontynent jest najmniejszy?', options: ['Europa', 'Australia', 'Antarktyda', 'Ameryka Płd.'], correct: 1 },
  { id: 14, text: 'Jaki kolor mają liście chlorofilu?', options: ['Żółty', 'Niebieski', 'Zielony', 'Czerwony'], correct: 2 },
  { id: 15, text: 'Ile jest kontynentów na Ziemi?', options: ['5', '6', '7', '8'], correct: 2 },
];

const MAX_LIVES = 3;
const QUESTION_TIME = 15;
const BEST_SCORE_KEY = 'survival_best';

function Heart({ filled }: { filled: boolean }) {
  return (
    <span className={`text-2xl transition-all ${filled ? 'text-red-400' : 'text-white/20'}`}>
      {filled ? '❤️' : '🤍'}
    </span>
  );
}

export default function SurvivalPage() {
  useRequireAuth();
  const { t } = useLocale();

  const [gameState, setGameState] = useState<GameState>('idle');
  const [lives, setLives] = useState(MAX_LIVES);
  const [streak, setStreak] = useState(0);
  const [bestScore, setBestScore] = useState(() => {
    if (typeof window !== 'undefined') {
      return parseInt(localStorage.getItem(BEST_SCORE_KEY) ?? '0', 10);
    }
    return 0;
  });
  const [currentQ, setCurrentQ] = useState(0);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);
  const [showResult, setShowResult] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const question = questions[currentQ] ?? null;

  const endGame = useCallback((finalStreak: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setGameState('gameover');
    if (finalStreak > bestScore) {
      setBestScore(finalStreak);
      if (typeof window !== 'undefined') {
        localStorage.setItem(BEST_SCORE_KEY, String(finalStreak));
      }
    }
  }, [bestScore]);

  const nextQuestion = useCallback((currentStreak: number, currentLives: number) => {
    setSelected(null);
    setShowResult(false);
    setTimeLeft(QUESTION_TIME);

    if (currentLives <= 0) {
      endGame(currentStreak);
      return;
    }

    setCurrentQ(prev => {
      if (prev + 1 >= questions.length) {
        return 0;
      }
      return prev + 1;
    });
  }, [questions.length, endGame]);

  useEffect(() => {
    if (gameState !== 'playing' || showResult) return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setSelected(-1);
          setShowResult(true);
          const newLives = lives - 1;
          setLives(newLives);
          setTimeout(() => nextQuestion(streak, newLives), 1500);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState, showResult, lives, streak, nextQuestion]);

  function startGame() {
    const shuffled = [...FALLBACK_QUESTIONS].sort(() => Math.random() - 0.5);
    setQuestions(shuffled);
    setLives(MAX_LIVES);
    setStreak(0);
    setCurrentQ(0);
    setSelected(null);
    setShowResult(false);
    setTimeLeft(QUESTION_TIME);
    setGameState('playing');
  }

  function handleAnswer(optionIndex: number) {
    if (showResult || selected !== null) return;
    if (timerRef.current) clearInterval(timerRef.current);

    setSelected(optionIndex);
    setShowResult(true);

    const isCorrect = optionIndex === question.correct;
    let newStreak = streak;
    let newLives = lives;

    if (isCorrect) {
      newStreak = streak + 1;
      setStreak(newStreak);
    } else {
      newLives = lives - 1;
      setLives(newLives);
    }

    setTimeout(() => nextQuestion(newStreak, newLives), 1200);
  }

  const timePct = (timeLeft / QUESTION_TIME) * 100;
  const timeColor = timePct > 50 ? 'bg-green-400' : timePct > 25 ? 'bg-yellow-400' : 'bg-red-400';

  if (gameState === 'idle') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8 animate-fade-in-up">
          <div className="text-6xl mb-3">💀</div>
          <h1 className="text-4xl font-bold text-white mb-2">{t('survival_title')}</h1>
          <div className="flex justify-center gap-1 mb-3">
            {Array.from({ length: MAX_LIVES }).map((_, i) => <Heart key={i} filled />)}
          </div>
          <p className="text-white/60 text-lg">{t('survival_desc')}</p>
        </div>

        <div className="glass-card p-8 mb-6 text-center">
          <div className="mb-6">
            <div className="text-white/40 text-sm mb-1">{t('survival_best')}</div>
            <div className="text-yellow-400 font-black text-5xl">{bestScore}</div>
            <div className="text-white/40 text-sm">poprawnych odpowiedzi z rzędu</div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { icon: '❤️', label: `${MAX_LIVES} ${t('survival_lives')}`, sub: 'na start' },
              { icon: '⏱️', label: `${QUESTION_TIME} sekund`, sub: 'na odpowiedź' },
              { icon: '🔥', label: t('survival_streak'), sub: 'ile przeżyjesz?' },
            ].map(r => (
              <div key={r.label} className="bg-white/5 rounded-xl p-3 border border-white/10">
                <div className="text-2xl mb-1">{r.icon}</div>
                <div className="text-white text-sm font-bold">{r.label}</div>
                <div className="text-white/40 text-xs">{r.sub}</div>
              </div>
            ))}
          </div>

          <button onClick={startGame} className="btn-primary px-12 py-4 text-lg font-bold">
            ▶ {t('survival_start')}
          </button>
        </div>

        <div className="glass-card p-5">
          <h3 className="text-white/70 text-sm font-semibold mb-3">Zasady</h3>
          <ul className="space-y-1.5 text-white/50 text-sm">
            <li>• Odpowiadaj na pytania zanim skończy się czas</li>
            <li>• Każda błędna odpowiedź lub przekroczenie czasu zabiera życie</li>
            <li>• Gra kończy się gdy stracisz wszystkie życia</li>
            <li>• Twój rekord jest najdłuższą serią poprawnych odpowiedzi</li>
          </ul>
        </div>
      </div>
    );
  }

  if (gameState === 'gameover') {
    const isNewRecord = streak >= bestScore && streak > 0;
    return (
      <div className="max-w-xl mx-auto text-center">
        <div className="glass-card p-10 animate-fade-in-up">
          <div className="text-6xl mb-4">{streak === 0 ? '😵' : streak < 5 ? '😅' : streak < 10 ? '😎' : '🔥'}</div>
          <h2 className="text-3xl font-bold text-white mb-1">{t('survival_game_over')}</h2>
          {isNewRecord && (
            <p className="text-yellow-400 font-bold mb-3 animate-pulse">🏆 Nowy rekord!</p>
          )}

          <div className="my-8">
            <div className="text-white/40 text-sm mb-1">Twój wynik</div>
            <div className="text-yellow-400 font-black text-7xl mb-1">{streak}</div>
            <div className="text-white/50">poprawnych odpowiedzi z rzędu</div>
          </div>

          <div className="flex justify-center gap-1 mb-6">
            <span className="text-white/40 text-sm mr-2">{t('survival_best')}:</span>
            <span className="text-yellow-400 font-bold">{bestScore}</span>
          </div>

          <div className="flex flex-col gap-3">
            <button onClick={startGame} className="btn-primary py-3 text-base font-bold">
              🔄 {t('survival_play_again')}
            </button>
            <button
              onClick={() => setGameState('idle')}
              className="py-2.5 text-white/40 hover:text-white/70 transition-colors text-sm"
            >
              Wróć do menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!question) return null;

  return (
    <div className="max-w-2xl mx-auto">
      {/* HUD */}
      <div className="flex items-center justify-between mb-4 animate-fade-in-up">
        <div className="flex gap-1">
          {Array.from({ length: MAX_LIVES }).map((_, i) => (
            <Heart key={i} filled={i < lives} />
          ))}
        </div>
        <div className="glass-card px-4 py-1.5 flex items-center gap-2">
          <span className="text-orange-400">🔥</span>
          <span className="text-white font-bold text-lg">{streak}</span>
        </div>
      </div>

      {/* Timer bar */}
      <div className="h-2 bg-white/10 rounded-full mb-6 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${timeColor}`}
          style={{ width: `${timePct}%` }}
        />
      </div>

      {/* Question */}
      <div className="glass-card p-6 mb-4 animate-fade-in-up">
        <div className="flex items-center justify-between mb-4">
          <span className="text-white/40 text-xs">Pytanie #{currentQ + 1}</span>
          <span className={`text-sm font-bold ${timePct < 30 ? 'text-red-400 animate-pulse' : 'text-white/60'}`}>
            ⏱ {timeLeft}s
          </span>
        </div>
        <p className="text-white text-xl font-semibold leading-relaxed">{question.text}</p>
      </div>

      {/* Options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {question.options.map((option, idx) => {
          let optionClass = 'border-white/10 bg-white/5 text-white hover:bg-white/10 hover:border-white/20';
          if (showResult) {
            if (idx === question.correct) {
              optionClass = 'border-green-500/60 bg-green-500/15 text-green-300';
            } else if (idx === selected && selected !== question.correct) {
              optionClass = 'border-red-500/60 bg-red-500/15 text-red-300';
            } else {
              optionClass = 'border-white/5 bg-white/3 text-white/30';
            }
          } else if (selected === idx) {
            optionClass = 'border-[#6C63FF]/60 bg-[#6C63FF]/15 text-white';
          }

          return (
            <button
              key={idx}
              onClick={() => handleAnswer(idx)}
              disabled={showResult}
              className={`p-4 rounded-xl border text-left transition-all font-medium ${optionClass}`}
            >
              <span className="text-white/40 text-sm mr-2">{['A', 'B', 'C', 'D'][idx]}.</span>
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
