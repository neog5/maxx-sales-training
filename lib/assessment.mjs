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

export function gradeAssessment(questions, answers, passThreshold) {
  const graded = questions.map((question) => {
    const selectedIndex = answers[question.id];
    return {
      ...question,
      selected_index: selectedIndex,
      is_correct: selectedIndex === question.correct_index,
    };
  });
  const correctCount = graded.filter((question) => question.is_correct).length;
  const mandatoryQuestions = graded.filter((question) => question.is_mandatory);
  const mandatoryCorrectCount = mandatoryQuestions.filter((question) => question.is_correct).length;
  const score = graded.length ? Math.round((correctCount / graded.length) * 100) : 0;
  const mandatoryPassed = mandatoryCorrectCount === mandatoryQuestions.length;

  return {
    graded,
    score,
    passed: graded.length > 0 && score >= passThreshold && mandatoryPassed,
    correctCount,
    mandatoryCorrectCount,
    mandatoryCount: mandatoryQuestions.length,
    mandatoryPassed,
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
