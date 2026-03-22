'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useGameSocket, ConnectionStatus } from '@/lib/useGameSocket';
import { useAuth } from '@/lib/AuthProvider';
import { getAvatarEmoji } from '@/lib/avatars';
import { OPTION_LABELS, getMedalEmoji } from '@/lib/constants';
import { StatusBanner } from '@/components/StatusBanner';
import { useLocale } from '@/lib/LocaleContext';
import clsx from 'clsx';

type GamePhase = 'waiting' | 'question' | 'answer_revealed' | 'game_over';

interface QuestionState {
  round_number: number;
  total_rounds: number;
  question: string;
  options: string[];
}

interface AnswerResult {
  is_correct: boolean;
  correct_answer: string;
  explanation: string;
  points_earned: number;
  total_score: number;
}

interface LeaderboardEntry {
  nickname: string;
  score: number;
  avatar?: string;
}

const TIMER_SECONDS = 30;

// ── Sub-components ────────────────────────────────────────────────────────────

function WaitingScreen({ status }: { status: ConnectionStatus }) {
  const { t } = useLocale();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <StatusBanner status={status} />
      <div className="text-5xl animate-bounce">🤖</div>
      <h2 className="text-2xl font-bold">{t('game_ai_generating')}</h2>
      <p className="text-white/40">{t('game_patience')}</p>
      <div className="flex gap-1 mt-2">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-2 h-2 bg-[#6C63FF] rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}

interface GameOverScreenProps {
  status: ConnectionStatus;
  leaderboard: LeaderboardEntry[];
  myNick: string;
  onPlayAgain: () => void;
}

function GameOverScreen({ status, leaderboard, myNick, onPlayAgain }: GameOverScreenProps) {
  const { t } = useLocale();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <StatusBanner status={status} />
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">🏆</div>
          <h1 className="text-4xl font-black">{t('game_over')}!</h1>
          <p className="text-white/50 mt-1">{t('game_final_results')}</p>
        </div>

        <div className="bg-[#16213E] rounded-2xl overflow-hidden border border-white/5">
          {leaderboard.map((entry, i) => (
            <div
              key={entry.nickname}
              className={clsx(
                'flex items-center gap-4 px-6 py-4 border-b border-white/5 last:border-0',
                i === 0 && 'bg-yellow-400/10',
                entry.nickname === myNick && 'ring-1 ring-inset ring-[#6C63FF]/50'
              )}
            >
              <span className="text-2xl w-8 text-center">{getMedalEmoji(i)}</span>
              <span className="text-2xl">{getAvatarEmoji(entry.avatar ?? 'fox')}</span>
              <span className="flex-1 font-semibold">
                {entry.nickname}
                {entry.nickname === myNick && (
                  <span className="ml-2 text-xs text-[#6C63FF]">({t('game_you')})</span>
                )}
              </span>
              <span className="font-mono font-bold text-[#6C63FF]">
                {entry.score.toLocaleString()} pkt
              </span>
            </div>
          ))}
        </div>

        <button
          onClick={onPlayAgain}
          className="w-full mt-6 py-4 bg-[#6C63FF] hover:bg-[#5a52e0] rounded-2xl font-bold text-white text-lg transition-colors"
        >
          🎮 {t('game_play_again')}
        </button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GamePage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLocale();
  const myAvatar = user?.avatar ?? 'fox';

  const [phase, setPhase] = useState<GamePhase>('waiting');
  const [currentQuestion, setCurrentQuestion] = useState<QuestionState | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [answerResult, setAnswerResult] = useState<AnswerResult | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myNick, setMyNick] = useState('');
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [totalScore, setTotalScore] = useState(0);
  const [powerupsUsed, setPowerupsUsed] = useState<Set<string>>(new Set());
  const [removedOptions, setRemovedOptions] = useState<Set<string>>(new Set());
  const [doublePointsActive, setDoublePointsActive] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  const clearTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const startTimer = () => {
    clearTimer();
    setTimeLeft(TIMER_SECONDS);
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearTimer(); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const { send, status } = useGameSocket(code, useCallback((msg) => {
    if (msg.type === 'game_start') {
      setPhase('waiting');
      setPowerupsUsed(new Set());
      setRemovedOptions(new Set());
      setDoublePointsActive(false);
    }

    if (msg.type === 'question') {
      setCurrentQuestion({
        round_number: msg.round_number,
        total_rounds: msg.total_rounds,
        question: msg.question,
        options: msg.options,
      });
      setSelectedOption(null);
      setAnswerResult(null);
      setPhase('question');
      startTimer();
      setRemovedOptions(new Set());
      setDoublePointsActive(false);
    }

    if (msg.type === 'answer_result') {
      clearTimer();
      setAnswerResult(msg);
      setTotalScore(msg.total_score);
      setPhase('answer_revealed');
    }

    if (msg.type === 'game_over') {
      clearTimer();
      setLeaderboard(msg.leaderboard);
      setPhase('game_over');
    }

    if (msg.type === 'powerup_result') {
      if (msg.powerup === 'fifty_fifty') {
        setRemovedOptions(new Set(msg.removed_options));
      }
      if (msg.powerup === 'extra_time') {
        setTimeLeft(prev => prev + msg.extra_seconds);
      }
      if (msg.powerup === 'double_points') {
        setDoublePointsActive(true);
      }
    }

    if (msg.type === 'game_state') {
      setTotalScore(msg.score);
      if (msg.current_question) {
        setCurrentQuestion(msg.current_question);
        setSelectedOption(null);
        setAnswerResult(null);
        setPhase('question');
        startTimer();
      } else if (msg.room_status === 'in_progress') {
        setPhase('waiting');
      }
    }
  }, []));

  // Handle reconnection: rejoin room automatically when socket reconnects
  useEffect(() => {
    if (status === 'connected' && myNick) {
      send({ type: 'rejoin', nickname: myNick });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    const nick = sessionStorage.getItem(`nick_${code}`) ?? '';
    setMyNick(nick);
    send({ type: 'join', nickname: nick, avatar: myAvatar });
    return clearTimer;
  }, [code, send, myAvatar]);

  const usePowerup = (powerup: string) => {
    if (powerupsUsed.has(powerup) || phase !== 'question') return;
    setPowerupsUsed(prev => new Set([...prev, powerup]));
    send({ type: 'use_powerup', powerup, nickname: myNick, round_number: currentQuestion?.round_number });
  };

  const handleAnswer = (optionLabel: string) => {
    if (selectedOption || phase !== 'question') return;
    setSelectedOption(optionLabel);
    send({
      type: 'answer',
      nickname: myNick,
      answer: optionLabel,
      response_time_ms: Date.now() - startTimeRef.current,
      round_number: currentQuestion?.round_number,
    });
  };

  const getOptionClass = (label: string) => {
    if (removedOptions.has(label) && phase === 'question') return 'answer-btn opacity-0 pointer-events-none';
    if (phase !== 'answer_revealed') return clsx('answer-btn', { selected: selectedOption === label });
    if (label === answerResult?.correct_answer) return 'answer-btn correct';
    if (label === selectedOption && !answerResult?.is_correct) return 'answer-btn wrong';
    return 'answer-btn opacity-40';
  };

  if (phase === 'waiting') return <WaitingScreen status={status} />;
  if (phase === 'game_over') return (
    <GameOverScreen
      status={status}
      leaderboard={leaderboard}
      myNick={myNick}
      onPlayAgain={() => router.push('/')}
    />
  );

  return (
    <main className="min-h-screen flex flex-col p-4 max-w-2xl mx-auto">
      <StatusBanner status={status} />

      <div className="flex items-center justify-between mb-4 pt-2">
        <div className="text-sm text-white/50">
          {t('game_round')} <span className="text-white font-bold">{currentQuestion?.round_number}</span>
          {' '}/ {currentQuestion?.total_rounds}
        </div>
        <div className="text-sm text-white/50">
          {t('game_score')}: <span className="text-[#6C63FF] font-bold">{totalScore.toLocaleString()} pkt</span>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex justify-between text-xs text-white/30 mb-1">
          <span>{t('game_time_left')}</span>
          <span className={clsx('font-mono font-bold', timeLeft <= 5 ? 'text-red-400' : 'text-white')}>
            {timeLeft}s
          </span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className={clsx(
              'h-full rounded-full transition-all duration-1000',
              timeLeft <= 5 ? 'bg-red-500' : timeLeft <= 10 ? 'bg-orange-400' : 'bg-[#6C63FF]'
            )}
            style={{ width: `${Math.min((timeLeft / TIMER_SECONDS) * 100, 100)}%` }}
          />
        </div>
      </div>

      <div className="bg-[#16213E] rounded-2xl p-6 mb-6 border border-white/5 flex-1 flex items-center">
        <p className="text-xl font-semibold leading-relaxed text-center w-full">
          {currentQuestion?.question}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 mb-4">
        {currentQuestion?.options.map((option, idx) => {
          const label = OPTION_LABELS[idx];
          return (
            <button
              key={label}
              onClick={() => handleAnswer(label)}
              disabled={!!selectedOption}
              className={getOptionClass(label)}
            >
              <span className="inline-flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 bg-white/10">
                  {label}
                </span>
                {option}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-2 mt-2 mb-4">
        {[
          { id: 'fifty_fifty',   icon: '½',  label: '50/50' },
          { id: 'extra_time',    icon: '⏱',  label: '+15s' },
          { id: 'double_points', icon: '×2', label: '×2 pkt' },
        ].map(({ id, icon, label }) => (
          <button
            key={id}
            onClick={() => usePowerup(id)}
            disabled={powerupsUsed.has(id) || phase !== 'question'}
            title={label}
            className={clsx(
              'flex-1 py-3 rounded-xl text-sm font-bold border transition-all min-h-[44px]',
              powerupsUsed.has(id)
                ? 'opacity-30 cursor-not-allowed border-white/10 text-white/30'
                : 'border-[#6C63FF]/50 text-[#6C63FF] hover:bg-[#6C63FF]/10',
              id === 'double_points' && doublePointsActive && 'border-yellow-400 text-yellow-400'
            )}
          >
            <span className="block text-lg leading-none">{icon}</span>
            <span className="text-xs">{label}</span>
          </button>
        ))}
      </div>

      {phase === 'answer_revealed' && answerResult && (
        <div className={clsx(
          'rounded-2xl p-4 border text-sm animate-slide-in',
          answerResult.is_correct
            ? 'bg-green-500/10 border-green-500/30 text-green-300'
            : 'bg-red-500/10 border-red-500/30 text-red-300'
        )}>
          <div className="font-bold mb-1">
            {answerResult.is_correct
              ? `✅ ${t('game_correct_plus')} +${answerResult.points_earned} pkt`
              : `❌ ${t('game_wrong_answer')} ${answerResult.correct_answer}`
            }
          </div>
          {answerResult.explanation && (
            <p className="text-white/60 text-xs mt-1">{answerResult.explanation}</p>
          )}
          <p className="text-white/40 text-xs mt-2 animate-pulse">
            {t('game_next_question')}
          </p>
        </div>
      )}
    </main>
  );
}
