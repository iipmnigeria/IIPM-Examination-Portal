from pathlib import Path

path = Path('src/components/StudentDashboard.tsx')
text = path.read_text(encoding='utf-8')


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    text = text.replace(old, new, 1)


replace_once(
    "  const [activeTab, setActiveTab] = useState<'catalog' | 'gradebook'>('catalog');",
    "  const [activeTab, setActiveTab] = useState<'specialist' | 'cipmn' | 'gradebook'>('specialist');",
    'active tab type',
)

replace_once(
    "  const gpa = calculateGPA();\n\n  return (",
    """  const gpa = calculateGPA();

  const isCipmnMockExam = (test: Test) => {
    const programmeCode = test.course.trim().toUpperCase();
    const examinationTitle = test.title.trim().toUpperCase();
    return programmeCode === 'CIPMN-MOCK' || examinationTitle.startsWith('CIPMN-MOD-');
  };

  const specialistCertificationTests = tests.filter((test) => !isCipmnMockExam(test));
  const cipmnMockTests = tests.filter(isCipmnMockExam);
  const isCipmnCatalogue = activeTab === 'cipmn';
  const catalogueTests = isCipmnCatalogue ? cipmnMockTests : specialistCertificationTests;
  const catalogueAttempts = attempts.filter((attempt) =>
    catalogueTests.some((test) => test.id === attempt.testId),
  );

  return (""",
    'catalogue derivations',
)

replace_once(
    """      {/* Navigation Tabs between Catalog & Academic Gradebook */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-px">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'catalog'
              ? 'border-emerald-600 text-emerald-600 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen className="w-4.5 h-4.5" /> Examination Catalog
        </button>

        <button
          onClick={() => setActiveTab('gradebook')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'gradebook'
              ? 'border-emerald-600 text-emerald-600 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <GraduationCap className="w-4.5 h-4.5" /> Academic Gradebook & Credentials
        </button>
      </div>

      {/* 1. Exam Catalog & Diagnostic Panel */}
      {activeTab === 'catalog' && (""",
    """      {/* Primary candidate navigation */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-slate-200 pb-px">
        <button
          onClick={() => setActiveTab('specialist')}
          className={`pb-3 px-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'specialist'
              ? 'border-emerald-600 text-emerald-600 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen className="w-4.5 h-4.5" /> IIPM Specialist Certification Catalogue
        </button>

        <button
          onClick={() => setActiveTab('cipmn')}
          className={`pb-3 px-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'cipmn'
              ? 'border-emerald-600 text-emerald-600 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="w-4.5 h-4.5" /> CIPMN Professional Licensing Mock Examinations
        </button>

        <button
          onClick={() => setActiveTab('gradebook')}
          className={`pb-3 px-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'gradebook'
              ? 'border-emerald-600 text-emerald-600 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <GraduationCap className="w-4.5 h-4.5" /> Academic Gradebook & Credentials
        </button>
      </div>

      {/* Specialist and CIPMN examination catalogues */}
      {activeTab !== 'gradebook' && (""",
    'candidate navigation tabs',
)

replace_once(
    """            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-950 font-sans">Available Examinations</h2>
                <p className="text-slate-500 text-xs">Choose an assessment to start your AI-proctored session</p>
              </div>
              <div className="text-xs text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-100 font-medium font-sans">
                Active Catalogs: {tests.length}
              </div>
            </div>

            <div className="space-y-4">
              {tests.map((test) => {""",
    """            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-950 font-sans">
                  {isCipmnCatalogue
                    ? 'CIPMN Professional Licensing Mock Examinations'
                    : 'Available Specialist Certification Examinations'}
                </h2>
                <p className="text-slate-500 text-xs">
                  {isCipmnCatalogue
                    ? 'Practise each CIPMN licensing module in a secure, timed examination environment.'
                    : 'Choose an IIPM specialist certification assessment to begin your AI-proctored session.'}
                </p>
              </div>
              <div className="self-start text-xs text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-100 font-medium font-sans sm:self-auto">
                Active Examinations: {catalogueTests.length}
              </div>
            </div>

            <div className="space-y-4">
              {catalogueTests.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                  <BookOpen className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                  <p className="text-sm font-semibold text-slate-600">No examinations are currently available in this catalogue.</p>
                  <p className="mx-auto mt-1 max-w-md text-xs text-slate-400">Newly published or assigned examinations will appear here automatically.</p>
                </div>
              )}
              {catalogueTests.map((test) => {""",
    'catalogue heading and list',
)

replace_once(
    "                const pastAttempts = attempts.filter(a => a.testId === test.id);",
    "                const pastAttempts = catalogueAttempts.filter(a => a.testId === test.id);",
    'catalogue card attempts',
)

replace_once(
    """              {attempts.length === 0 ? (
                <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-400 text-sm space-y-2">""",
    """              {catalogueAttempts.length === 0 ? (
                <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-400 text-sm space-y-2">""",
    'catalogue history empty state',
)

replace_once(
    "                  {attempts.map((attempt) => {",
    "                  {catalogueAttempts.map((attempt) => {",
    'catalogue history list',
)

for obsolete in [
    "setActiveTab('catalog')",
    "activeTab === 'catalog'",
    'Examination Catalog',
]:
    if obsolete in text:
        raise SystemExit(f'obsolete navigation marker remains: {obsolete}')

for required in [
    'IIPM Specialist Certification Catalogue',
    'CIPMN Professional Licensing Mock Examinations',
    'Academic Gradebook & Credentials',
    "programmeCode === 'CIPMN-MOCK'",
    'catalogueTests.map',
]:
    if required not in text:
        raise SystemExit(f'required navigation marker missing: {required}')

path.write_text(text, encoding='utf-8')
print('CIPMN and specialist catalogue navigation applied successfully.')
