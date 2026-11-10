export const QUESTION_PERFORMANCE_GROUPS = [
  {
    key: "mandatory",
    label: "Mandatory",
    description: "Required knowledge",
    matches: (question) => Boolean(question.is_mandatory),
  },
  {
    key: "nonMandatory",
    label: "Non-mandatory",
    description: "Supporting knowledge",
    matches: (question) => !question.is_mandatory,
  },
  {
    key: "imageBased",
    label: "Image-based",
    description: "Questions with a visual",
    matches: (question) => Boolean(question.image_url),
  },
  {
    key: "textOnly",
    label: "Not image-based",
    description: "Text-only questions",
    matches: (question) => !question.image_url,
  },
];

// Options are shown shuffled per question so the correct answer isn't always in the same
// slot. Each keeps `originalIndex`, which is what answers are recorded against.
export function shuffleOptions(question, random = Math.random) {
  const shuffled = question.options.map((text, originalIndex) => ({ text, originalIndex }));
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
  }
  return { ...question, shuffled };
}

// Counts for answered questions ({ is_correct, is_mandatory }), e.g. an attempt's snapshot.
export function summarizeAnswers(questions) {
  const correctCount = questions.filter((question) => question.is_correct).length;
  const mandatory = questions.filter((question) => question.is_mandatory);
  const mandatoryCorrectCount = mandatory.filter((question) => question.is_correct).length;
  return {
    total: questions.length,
    correctCount,
    mandatoryCount: mandatory.length,
    mandatoryCorrectCount,
    mandatoryPassed: mandatoryCorrectCount === mandatory.length,
  };
}

// The database grades attempts (submit_attempt, migration 011). This turns its reply into
// what the results screen shows.
export function attemptResult(payload) {
  return {
    score: payload.score,
    passed: payload.passed,
    total: payload.total,
    correctCount: payload.correct_count,
    mandatoryCount: payload.mandatory_count,
    mandatoryCorrectCount: payload.mandatory_correct_count,
    mandatoryPassed: payload.mandatory_correct_count === payload.mandatory_count,
    certificateId: payload.certificate_id || null,
    questions: payload.questions || [],
  };
}

export function calculateQuestionPerformance(questions) {
  return QUESTION_PERFORMANCE_GROUPS.map((group) => {
    const matchingQuestions = questions.filter(group.matches);
    const correct = matchingQuestions.filter((question) => question.is_correct).length;

    return {
      key: group.key,
      label: group.label,
      description: group.description,
      total: matchingQuestions.length,
      correct,
      accuracy: matchingQuestions.length
        ? Math.round((correct / matchingQuestions.length) * 100)
        : null,
    };
  });
}

// Main assessments are about 60% mandatory and 40% other questions, with at least 5
// questions (the database's quiz builder uses the same rule). Given a course's main-test
// questions, says how many it needs and whether it has enough.
export const MANDATORY_SHARE = 0.6;
export const MIN_ASSESSMENT_QUESTIONS = 5;

export function assessmentMix(mainQuestions) {
  const mandatoryCount = mainQuestions.filter((question) => question.is_mandatory).length;
  const optionalCount = mainQuestions.length - mandatoryCount;
  const targetCount = Math.max(MIN_ASSESSMENT_QUESTIONS, Math.round(mandatoryCount / MANDATORY_SHARE));
  const requiredOptionalCount = Math.max(0, targetCount - mandatoryCount);
  return {
    total: mainQuestions.length,
    mandatoryCount,
    optionalCount,
    targetCount,
    requiredOptionalCount,
    isShort: mainQuestions.length < targetCount || optionalCount < requiredOptionalCount,
  };
}
