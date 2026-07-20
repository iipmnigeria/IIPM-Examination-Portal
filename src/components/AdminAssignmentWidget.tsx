import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { ClipboardPlus, Loader2, Mail, ShieldCheck, X } from 'lucide-react';
import { getCurrentPortalUser } from '../services/authService';
import { assignExamToCandidate, getAvailableTests } from '../services/examService';
import type { Test } from '../types';

export default function AdminAssignmentWidget() {
  const [isAuthorised, setIsAuthorised] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [tests, setTests] = useState<Test[]>([]);
  const [candidateEmail, setCandidateEmail] = useState('');
  const [examinationId, setExaminationId] = useState('');
  const [maxAttempts, setMaxAttempts] = useState('1');
  const [expiresAt, setExpiresAt] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    getCurrentPortalUser()
      .then((current) => {
        if (!active || !current) return;
        setIsAuthorised(['exam_admin', 'super_admin'].includes(current.profile.role));
      })
      .catch((authError) => {
        console.error('Unable to initialise assignment control:', authError);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isOpen || tests.length > 0) return;

    setIsLoading(true);
    getAvailableTests()
      .then((catalogue) => {
        setTests(catalogue);
        if (catalogue[0]) setExaminationId(catalogue[0].id);
      })
      .catch((catalogueError) => {
        setError(catalogueError?.message || 'Unable to load the examination catalogue.');
      })
      .finally(() => setIsLoading(false));
  }, [isOpen, tests.length]);

  const selectedTest = useMemo(
    () => tests.find((test) => test.id === examinationId),
    [tests, examinationId],
  );

  const handleAssign = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!candidateEmail.trim() || !examinationId) {
      setError('Enter the candidate email and select an examination.');
      return;
    }

    try {
      setIsLoading(true);
      const result = await assignExamToCandidate({
        examinationId,
        candidateEmail,
        maxAttempts: Number(maxAttempts) || 1,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      });

      const candidateName = String(result.candidateName || candidateEmail.trim());
      setMessage(`${selectedTest?.title || 'Examination'} has been assigned to ${candidateName}.`);
      setCandidateEmail('');
    } catch (assignmentError: any) {
      setError(assignmentError?.message || 'The examination could not be assigned.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthorised) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white shadow-2xl transition hover:bg-emerald-700"
      >
        <ClipboardPlus className="h-4 w-4" /> Assign Examination
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-slate-950 px-5 py-4 text-white">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-emerald-600 p-2">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Protected Admin Action</p>
                  <h2 className="text-lg font-extrabold">Assign Candidate Examination</h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
                aria-label="Close assignment panel"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAssign} className="space-y-4 p-5">
              <div>
                <label className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-slate-600">
                  Candidate email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={candidateEmail}
                    onChange={(event) => setCandidateEmail(event.target.value)}
                    placeholder="candidate@example.com"
                    className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-slate-600">
                  Examination
                </label>
                <select
                  required
                  value={examinationId}
                  onChange={(event) => setExaminationId(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                >
                  {tests.map((test) => (
                    <option key={test.id} value={test.id}>
                      {test.course} — {test.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-slate-600">
                    Maximum attempts
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={maxAttempts}
                    onChange={(event) => setMaxAttempts(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-slate-600">
                    Expiry (optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(event) => setExpiresAt(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                  {error}
                </div>
              )}
              {message && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || tests.length === 0}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardPlus className="h-4 w-4" />}
                {isLoading ? 'Processing…' : 'Assign Examination'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
