import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const repositoryRoot = process.cwd();
const outputPath = process.argv[2] || path.join(
  repositoryRoot,
  'supabase/migrations/202607220014_ai_studio_course_catalogue.sql',
);

const questionBankFiles = [
  ['chrmgQuestions', 'src/chrmgQuestions.ts'],
  ['chrmpQuestions', 'src/chrmpQuestions.ts'],
  ['pmQuestions', 'src/pmQuestions.ts'],
  ['pcitQuestions', 'src/pcitQuestions.ts'],
  ['rmpQuestions', 'src/rmpQuestions.ts'],
  ['qmpQuestions', 'src/qmpQuestions.ts'],
  ['pcmQuestions', 'src/pcmQuestions.ts'],
];

const selectedCourseConfiguration = {
  'ai-ml-101': { code: 'AIML', passMark: 70 },
  'cyber-sec-201': { code: 'CYBER', passMark: 70 },
  'ethics-swe-301': { code: 'SWEETH', passMark: 70 },
  'hrmfc-101': {
    code: 'HRMFC',
    passMark: 70,
    examinationId: '20000000-0000-4000-8000-000000000101',
    programmeId: '10000000-0000-4000-8000-000000000101',
  },
  'chrmg-201': { code: 'CHRMG', passMark: 70 },
  'chrmp-301': {
    code: 'CHRMP',
    passMark: 70,
    examinationId: '20000000-0000-4000-8000-000000000102',
  },
  'pm-201': { code: 'PM', passMark: 70 },
  'pcit-301': { code: 'PCIT', passMark: 70 },
  'rmp-301': { code: 'RMP', passMark: 70 },
  'qmp-301': { code: 'QMP', passMark: 70 },
  'pcm-301': { code: 'PCM', passMark: 70 },
};

function readSource(relativePath) {
  return fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8').replace(/^\uFEFF/, '');
}

function evaluateQuestionBank(variableName, relativePath, context) {
  let source = readSource(relativePath);
  source = source.replace(/^import\s+.*?;\s*$/gm, '');
  const declaration = new RegExp(
    `export\\s+const\\s+${variableName}\\s*:\\s*Question\\[\\]\\s*=`,
  );
  source = source.replace(declaration, `globalThis.${variableName} =`);

  if (!source.includes(`globalThis.${variableName} =`)) {
    throw new Error(`Unable to locate ${variableName} in ${relativePath}.`);
  }

  vm.runInContext(source, context, { filename: relativePath });
  const result = context[variableName];
  if (!Array.isArray(result)) {
    throw new Error(`${relativePath} did not produce an array.`);
  }
  return result;
}

function evaluateFallbackExams(context) {
  let source = readSource('src/fallbackData.ts');
  source = source.replace(/^import\s+.*?;\s*$/gm, '');
  source = source.replace(
    /export\s+const\s+fallbackExams\s*:\s*Test\[\]\s*=/,
    'globalThis.fallbackExams =',
  );

  if (!source.includes('globalThis.fallbackExams =')) {
    throw new Error('Unable to locate fallbackExams in src/fallbackData.ts.');
  }

  vm.runInContext(source, context, { filename: 'src/fallbackData.ts' });
  if (!Array.isArray(context.fallbackExams)) {
    throw new Error('src/fallbackData.ts did not produce an examination array.');
  }
  return context.fallbackExams;
}

function deterministicUuid(seed) {
  const hex = crypto.createHash('md5').update(seed).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlUuid(value) {
  return `${sqlString(value)}::uuid`;
}

const context = vm.createContext({ console });
for (const [variableName, relativePath] of questionBankFiles) {
  context[variableName] = evaluateQuestionBank(variableName, relativePath, context);
}

const fallbackExams = evaluateFallbackExams(context);
const selectedExams = Object.entries(selectedCourseConfiguration).map(([sourceId, config]) => {
  const sourceExam = fallbackExams.find((exam) => exam.id === sourceId);
  if (!sourceExam) throw new Error(`The configured examination ${sourceId} is missing.`);
  if (!Array.isArray(sourceExam.questions) || sourceExam.questions.length === 0) {
    throw new Error(`${sourceId} has no questions.`);
  }
  if (Number(sourceExam.questionCount) !== sourceExam.questions.length) {
    throw new Error(
      `${sourceId} declares ${sourceExam.questionCount} questions but contains ${sourceExam.questions.length}.`,
    );
  }

  for (const [index, question] of sourceExam.questions.entries()) {
    if (!question.text || !Array.isArray(question.options) || question.options.length < 2) {
      throw new Error(`${sourceId} question ${index + 1} is incomplete.`);
    }
    if (
      !Number.isInteger(question.correctOptionIndex)
      || question.correctOptionIndex < 0
      || question.correctOptionIndex >= question.options.length
    ) {
      throw new Error(`${sourceId} question ${index + 1} has an invalid answer key.`);
    }
  }

  const programmeId = config.programmeId || deterministicUuid(`iipm:programme:${config.code}`);
  const examinationId = config.examinationId || deterministicUuid(`iipm:examination:${sourceId}`);

  return {
    ...sourceExam,
    sourceId,
    ...config,
    programmeId,
    examinationId,
  };
});

const lines = [];
lines.push('begin;');
lines.push('');
lines.push('-- Generated from the Google AI Studio catalogue on main.');
lines.push('-- Includes all selected IIPM examinations and deliberately excludes any separate CIPMN-branded catalogue.');
lines.push('-- Existing questions are retained for historical attempts, moved out of active positions and deactivated.');
lines.push('');

for (const exam of selectedExams) {
  lines.push(`-- ${exam.code}: ${exam.title}`);
  lines.push('insert into public.programmes (id, code, name, description, is_active)');
  lines.push('values (');
  lines.push(`  ${sqlUuid(exam.programmeId)},`);
  lines.push(`  ${sqlString(exam.code)},`);
  lines.push(`  ${sqlString(exam.title)},`);
  lines.push(`  ${sqlString(exam.description || exam.title)},`);
  lines.push('  true');
  lines.push(')');
  lines.push('on conflict (code) do update');
  lines.push('set name = excluded.name,');
  lines.push('    description = excluded.description,');
  lines.push('    is_active = true,');
  lines.push('    updated_at = now();');
  lines.push('');

  lines.push('insert into public.examinations (');
  lines.push('  id, programme_id, title, instructions, duration_minutes, pass_mark,');
  lines.push('  status, max_attempts, randomize_questions, randomize_options,');
  lines.push('  allow_self_enrollment, requires_payment');
  lines.push(') values (');
  lines.push(`  ${sqlUuid(exam.examinationId)},`);
  lines.push(`  (select id from public.programmes where code = ${sqlString(exam.code)}),`);
  lines.push(`  ${sqlString(exam.title)},`);
  lines.push(`  ${sqlString('Answer every question. This examination is timed and protected by IIPM examination integrity controls. Payment, an approved scholarship coupon or an administrator assignment is required before launch.')},`);
  lines.push(`  ${Math.max(1, Number(exam.durationMinutes) || 60)},`);
  lines.push(`  ${exam.passMark},`);
  lines.push("  'published',");
  lines.push('  1,');
  lines.push('  true,');
  lines.push('  true,');
  lines.push('  false,');
  lines.push('  true');
  lines.push(')');
  lines.push('on conflict (id) do update');
  lines.push('set programme_id = excluded.programme_id,');
  lines.push('    title = excluded.title,');
  lines.push('    instructions = excluded.instructions,');
  lines.push('    duration_minutes = excluded.duration_minutes,');
  lines.push('    pass_mark = excluded.pass_mark,');
  lines.push('    status = excluded.status,');
  lines.push('    max_attempts = excluded.max_attempts,');
  lines.push('    randomize_questions = excluded.randomize_questions,');
  lines.push('    randomize_options = excluded.randomize_options,');
  lines.push('    allow_self_enrollment = false,');
  lines.push('    requires_payment = true,');
  lines.push('    updated_at = now();');
  lines.push('');

  lines.push('with ranked_existing as (');
  lines.push('  select id, row_number() over (order by id) as replacement_position');
  lines.push('  from public.questions');
  lines.push(`  where examination_id = ${sqlUuid(exam.examinationId)}`);
  lines.push(')');
  lines.push('update public.questions q');
  lines.push('set is_active = false,');
  lines.push('    position = 100000 + ranked_existing.replacement_position,');
  lines.push('    updated_at = now()');
  lines.push('from ranked_existing');
  lines.push('where q.id = ranked_existing.id;');
  lines.push('');

  const questionRows = [];
  const optionRows = [];
  const answerRows = [];

  exam.questions.forEach((question, questionIndex) => {
    const questionKey = String(question.id || questionIndex + 1);
    const questionId = deterministicUuid(`iipm:question:${exam.code}:${questionKey}`);
    questionRows.push(
      `  (${sqlUuid(questionId)}, ${sqlUuid(exam.examinationId)}, ${sqlString(question.text)}, ${questionIndex + 1}, 1, true)`,
    );

    question.options.forEach((option, optionIndex) => {
      const optionId = deterministicUuid(`iipm:option:${exam.code}:${questionKey}:${optionIndex + 1}`);
      optionRows.push(
        `  (${sqlUuid(optionId)}, ${sqlUuid(questionId)}, ${sqlString(option)}, ${optionIndex + 1})`,
      );
    });

    const correctOptionId = deterministicUuid(
      `iipm:option:${exam.code}:${questionKey}:${question.correctOptionIndex + 1}`,
    );
    answerRows.push(`  (${sqlUuid(questionId)}, ${sqlUuid(correctOptionId)})`);
  });

  lines.push('insert into public.questions (id, examination_id, question_text, position, points, is_active)');
  lines.push('values');
  lines.push(questionRows.join(',\n'));
  lines.push('on conflict (id) do update');
  lines.push('set examination_id = excluded.examination_id,');
  lines.push('    question_text = excluded.question_text,');
  lines.push('    position = excluded.position,');
  lines.push('    points = excluded.points,');
  lines.push('    is_active = true,');
  lines.push('    updated_at = now();');
  lines.push('');

  lines.push('insert into public.question_options (id, question_id, option_text, position)');
  lines.push('values');
  lines.push(optionRows.join(',\n'));
  lines.push('on conflict (id) do update');
  lines.push('set question_id = excluded.question_id,');
  lines.push('    option_text = excluded.option_text,');
  lines.push('    position = excluded.position;');
  lines.push('');

  lines.push('insert into public.question_answer_keys (question_id, correct_option_id)');
  lines.push('values');
  lines.push(answerRows.join(',\n'));
  lines.push('on conflict (question_id) do update');
  lines.push('set correct_option_id = excluded.correct_option_id,');
  lines.push('    updated_at = now();');
  lines.push('');

  lines.push('update public.exam_prices');
  lines.push('set is_default = false, updated_at = now()');
  lines.push(`where examination_id = ${sqlUuid(exam.examinationId)}`);
  lines.push("  and currency <> 'NGN'");
  lines.push('  and is_default = true;');
  lines.push('');

  const priceId = deterministicUuid(`iipm:price:${exam.code}:NGN`);
  lines.push('insert into public.exam_prices (');
  lines.push('  id, examination_id, currency, amount_minor, country_codes,');
  lines.push('  is_default, is_active, effective_from, effective_to');
  lines.push(') values (');
  lines.push(`  ${sqlUuid(priceId)},`);
  lines.push(`  ${sqlUuid(exam.examinationId)},`);
  lines.push("  'NGN',");
  lines.push('  2500000,');
  lines.push("  array['NG']::text[],");
  lines.push('  true,');
  lines.push('  true,');
  lines.push('  now(),');
  lines.push('  null');
  lines.push(')');
  lines.push('on conflict (examination_id, currency) do update');
  lines.push('set amount_minor = 2500000,');
  lines.push("    country_codes = array['NG']::text[],");
  lines.push('    is_default = true,');
  lines.push('    is_active = true,');
  lines.push('    effective_from = least(public.exam_prices.effective_from, now()),');
  lines.push('    effective_to = null,');
  lines.push('    updated_at = now();');
  lines.push('');
}

lines.push('do $$');
lines.push('declare');
lines.push('  v_record record;');
lines.push('  v_actual integer;');
lines.push('begin');
lines.push('  for v_record in');
lines.push('    select * from (values');
lines.push(
  selectedExams
    .map(
      (exam) => `      (${sqlUuid(exam.examinationId)}, ${sqlString(exam.code)}, ${exam.questions.length})`,
    )
    .join(',\n'),
);
lines.push('    ) as expected(examination_id, programme_code, expected_questions)');
lines.push('  loop');
lines.push('    select count(*) into v_actual');
lines.push('    from public.questions');
lines.push('    where examination_id = v_record.examination_id and is_active = true;');
lines.push('');
lines.push('    if v_actual <> v_record.expected_questions then');
lines.push("      raise exception 'Question count validation failed for %: expected %, found %.',");
lines.push('        v_record.programme_code, v_record.expected_questions, v_actual;');
lines.push('    end if;');
lines.push('');
lines.push('    if not exists (');
lines.push('      select 1 from public.examinations e');
lines.push('      where e.id = v_record.examination_id');
lines.push("        and e.status = 'published'");
lines.push('        and e.requires_payment = true');
lines.push('        and e.allow_self_enrollment = false');
lines.push('    ) then');
lines.push("      raise exception 'Payment and publication configuration failed for %.', v_record.programme_code;");
lines.push('    end if;');
lines.push('');
lines.push('    if not exists (');
lines.push('      select 1 from public.exam_prices ep');
lines.push('      where ep.examination_id = v_record.examination_id');
lines.push("        and ep.currency = 'NGN'");
lines.push('        and ep.amount_minor = 2500000');
lines.push('        and ep.is_default = true');
lines.push('        and ep.is_active = true');
lines.push('    ) then');
lines.push("      raise exception 'NGN 25,000 price validation failed for %.', v_record.programme_code;");
lines.push('    end if;');
lines.push('  end loop;');
lines.push('end;');
lines.push('$$;');
lines.push('');
lines.push('commit;');
lines.push('');
lines.push('-- Imported catalogue summary:');
for (const exam of selectedExams) {
  lines.push(`-- ${exam.code}: ${exam.questions.length} questions, NGN 25,000, Pay & Unlock enabled.`);
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');

console.log(`Generated ${outputPath}`);
console.log(`Courses: ${selectedExams.length}`);
console.log(`Questions: ${selectedExams.reduce((total, exam) => total + exam.questions.length, 0)}`);
for (const exam of selectedExams) {
  console.log(`- ${exam.code}: ${exam.questions.length}`);
}
