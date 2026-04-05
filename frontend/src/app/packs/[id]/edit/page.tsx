'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, PackDetail, PackQuestion } from '@/lib/api';
import { useToast } from '@/lib/ToastContext';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { useLocale } from '@/lib/LocaleContext';
import clsx from 'clsx';

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

function QuestionForm({
  onSave,
  onCancel,
  initial,
}: {
  onSave: (q: { question_text: string; answers: string[]; correct_index: number; image_emoji: string }) => Promise<void>;
  onCancel: () => void;
  initial?: PackQuestion;
}) {
  const { t } = useLocale();
  const [text, setText] = useState(initial?.question_text ?? '');
  const [answers, setAnswers] = useState<string[]>(initial?.answers ?? ['', '', '', '']);
  const [correctIndex, setCorrectIndex] = useState(initial?.correct_index ?? 0);
  const [emoji, setEmoji] = useState(initial?.image_emoji ?? '');
  const [saving, setSaving] = useState(false);

  function setAnswer(idx: number, val: string) {
    setAnswers(prev => prev.map((a, i) => i === idx ? val : a));
  }

  async function handleSave() {
    if (!text.trim()) return;
    if (answers.some(a => !a.trim())) return;
    setSaving(true);
    try {
      await onSave({ question_text: text.trim(), answers, correct_index: correctIndex, image_emoji: emoji });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="glass-card p-5 space-y-3 border border-yellow-400/30">
      <div>
        <label className="text-white/60 text-xs mb-1 block">{t('edit_pack_question_label')} *</label>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={2}
          className="w-full bg-white/20 rounded-lg px-3 py-2 text-white placeholder-white/40 resize-none text-sm"
          placeholder={t('edit_pack_question_placeholder')}
        />
      </div>

      <div className="space-y-2">
        <label className="text-white/60 text-xs block">{t('edit_pack_answers_label')}</label>
        {answers.map((a, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <button
              onClick={() => setCorrectIndex(idx)}
              className={clsx(
                'w-7 h-7 rounded-full text-xs font-bold flex-shrink-0 transition',
                correctIndex === idx
                  ? 'bg-green-500 text-white'
                  : 'bg-white/10 text-white/50 hover:bg-white/20'
              )}
            >
              {OPTION_LABELS[idx]}
            </button>
            <input
              type="text"
              value={a}
              onChange={e => setAnswer(idx, e.target.value)}
              className="flex-1 bg-white/20 rounded-lg px-3 py-1.5 text-white placeholder-white/40 text-sm"
              placeholder={`Odpowiedź ${OPTION_LABELS[idx]}...`}
            />
          </div>
        ))}
      </div>

      <div>
        <label className="text-white/60 text-xs mb-1 block">{t('edit_pack_emoji_label')}</label>
        <input
          type="text"
          value={emoji}
          onChange={e => setEmoji(e.target.value)}
          className="w-24 bg-white/20 rounded-lg px-3 py-1.5 text-white placeholder-white/40 text-sm"
          placeholder="🌍"
        />
      </div>

      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving} className="btn-primary text-sm py-1.5 px-4">
          {saving ? '...' : t('common_save')}
        </button>
        <button onClick={onCancel} className="text-white/50 hover:text-white text-sm px-3">
          {t('common_cancel')}
        </button>
      </div>
    </div>
  );
}

export default function EditPackPage() {
  useRequireAuth();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { show } = useToast();
  const { t } = useLocale();
  const [pack, setPack] = useState<PackDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingQuestion, setAddingQuestion] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPublic, setEditPublic] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);

  useEffect(() => {
    api.getPack(Number(id))
      .then(p => {
        setPack(p);
        setEditName(p.name);
        setEditDesc(p.description);
        setEditPublic(p.is_public);
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSaveMeta() {
    if (!pack) return;
    setSavingMeta(true);
    try {
      await api.updatePack(pack.id, { name: editName, description: editDesc, is_public: editPublic });
      setPack(prev => prev ? { ...prev, name: editName, description: editDesc, is_public: editPublic } : prev);
      show(t('edit_pack_changes_saved'), 'success');
    } catch {
      show(t('edit_pack_save_error'), 'error');
    } finally {
      setSavingMeta(false);
    }
  }

  async function handleAddQuestion(q: { question_text: string; answers: string[]; correct_index: number; image_emoji: string }) {
    if (!pack) return;
    try {
      const created = await api.addQuestion(pack.id, q);
      setPack(prev => prev ? { ...prev, questions: [...prev.questions, created] } : prev);
      setAddingQuestion(false);
      show(t('edit_pack_question_added'), 'success');
    } catch {
      show(t('edit_pack_question_add_error'), 'error');
    }
  }

  async function handleEditQuestion(q: { question_text: string; answers: string[]; correct_index: number; image_emoji: string }) {
    if (!pack || editingId === null) return;
    try {
      const updated = await api.updateQuestion(pack.id, editingId, q);
      setPack(prev => prev ? {
        ...prev,
        questions: prev.questions.map(existing => existing.id === editingId ? updated : existing),
      } : prev);
      setEditingId(null);
      show(t('edit_pack_question_updated'), 'success');
    } catch {
      show(t('edit_pack_question_update_error'), 'error');
    }
  }

  async function handleDeleteQuestion(qId: number) {
    if (!pack) return;
    if (!confirm(t('edit_pack_delete_question_confirm'))) return;
    try {
      await api.deleteQuestion(pack.id, qId);
      setPack(prev => prev ? { ...prev, questions: prev.questions.filter(q => q.id !== qId) } : prev);
      show(t('edit_pack_question_deleted'), 'success');
    } catch {
      show(t('edit_pack_question_delete_error'), 'error');
    }
  }

  if (loading) return (
    <div className="max-w-2xl mx-auto">
      <div className="h-8 w-48 bg-white/10 rounded animate-pulse mb-6" />
    </div>
  );

  if (!pack || !pack.is_mine) return (
    <div className="max-w-2xl mx-auto text-center pt-12">
      <p className="text-red-400">{t('edit_pack_no_access')}</p>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.push('/packs')} className="text-white/50 hover:text-white text-sm">← {t('common_back')}</button>
        <h1 className="text-2xl font-bold text-white">{t('edit_pack_title')}</h1>
      </div>

      {/* Meta */}
      <div className="glass-card p-5 mb-6 space-y-3">
        <div>
          <label className="text-white/60 text-xs mb-1 block">{t('edit_pack_name_label')}</label>
          <input
            type="text"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            className="w-full bg-white/20 rounded-lg px-4 py-2 text-white"
          />
        </div>
        <div>
          <label className="text-white/60 text-xs mb-1 block">{t('edit_pack_desc_label')}</label>
          <textarea
            value={editDesc}
            onChange={e => setEditDesc(e.target.value)}
            rows={2}
            className="w-full bg-white/20 rounded-lg px-4 py-2 text-white resize-none text-sm"
          />
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={editPublic}
            onChange={e => setEditPublic(e.target.checked)}
            className="w-4 h-4 accent-yellow-400"
          />
          <span className="text-white text-sm">{t('edit_pack_public_label')}</span>
        </label>
        <button onClick={handleSaveMeta} disabled={savingMeta} className="btn-primary text-sm py-2">
          {savingMeta ? t('edit_pack_saving') : t('edit_pack_save_settings')}
        </button>
      </div>

      {/* Questions */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-bold">Pytania ({pack.questions.length})</h2>
        {!addingQuestion && (
          <button onClick={() => setAddingQuestion(true)} className="btn-primary text-sm py-1.5 px-4">
            {t('pack_add_question')}
          </button>
        )}
      </div>

      {addingQuestion && (
        <div className="mb-4">
          <QuestionForm onSave={handleAddQuestion} onCancel={() => setAddingQuestion(false)} />
        </div>
      )}

      <div className="space-y-3">
        {pack.questions.map((q, idx) => (
          editingId === q.id ? (
            <QuestionForm
              key={q.id}
              initial={q}
              onSave={handleEditQuestion}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <div key={q.id} className="glass-card p-4">
              <div className="flex items-start gap-3">
                <span className="text-white/30 text-xs pt-1 flex-shrink-0">#{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  {q.image_emoji && <span className="text-lg mr-1">{q.image_emoji}</span>}
                  <span className="text-white text-sm font-medium">{q.question_text}</span>
                  <div className="mt-2 grid grid-cols-2 gap-1">
                    {q.answers.map((a, i) => (
                      <div
                        key={i}
                        className={clsx(
                          'text-xs px-2 py-1 rounded',
                          i === q.correct_index ? 'bg-green-500/20 text-green-300' : 'bg-white/5 text-white/50'
                        )}
                      >
                        <span className="font-bold mr-1">{OPTION_LABELS[i]}.</span>{a}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => setEditingId(q.id)} className="text-yellow-400 text-xs hover:underline">{t('packs_edit')}</button>
                  <button onClick={() => handleDeleteQuestion(q.id)} className="text-red-400 text-xs hover:underline">{t('packs_delete')}</button>
                </div>
              </div>
            </div>
          )
        ))}
        {pack.questions.length === 0 && !addingQuestion && (
          <div className="glass-card p-8 text-center">
            <p className="text-white/40 text-sm">{t('edit_pack_empty')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
