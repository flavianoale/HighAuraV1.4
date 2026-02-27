export const ALERT_STATES = {
  NORMAL: 'NORMAL',
  ALERT: 'ALERT',
  RESTRICTED: 'RESTRICTED',
  FAILED: 'FAILED'
};

export const DAY_TYPES = ['PUSH', 'PULL', 'LEGS'];

export function createInitialState(overrides = {}) {
  const state = {
    core: {
      currentDay: 1,
      totalDays: 90,
      xp: 0,
      level: 1,
      globalScore: 0,
      disciplineIndex: 0,
      stabilityIndex: 0,
      growthIndex: 0,
      streak: 0,
      alertState: ALERT_STATES.NORMAL,
      lastEvaluationDate: null,
      scoreHistory: []
    },
    modules: {
      treino: {
        score: 0,
        currentCycle: 1,
        week: 1,
        dayType: 'PUSH',
        exercises: [],
        weeklyVolume: 0,
        fatigueIndex: 0,
        strengthIndex: 0,
        longTermStrengthGoal: 200,
        performanceTrend: []
      },
      dieta: {
        score: 0,
        weight: 86,
        height: 171,
        age: 25,
        bodyFatEstimate: 24,
        calorieTarget: 0,
        proteinTarget: 0,
        carbTarget: 0,
        fatTarget: 0,
        deficitLevel: 0.2,
        adherenceScore: 0,
        bingeFlag: false,
        weeklyWeightTrend: [],
        controlScore: 0,
        mealPlan: []
      },
      financeiro: {
        score: 0,
        monthlyIncome: 0,
        monthlyExpenses: 0,
        fixedExpenses: 0,
        variableExpenses: 0,
        savingsRate: 0,
        savings: 0,
        investmentValue: 0,
        disciplineScore: 0,
        gamblingFlag: false,
        projection1y: 0,
        projection3y: 0,
        projection5y: 0,
        netWorth: 0,
        growthTrend: []
      },
      academico: {
        score: 0,
        studyHoursWeek: 0,
        studyHoursTotal: 0,
        subjects: [],
        authorityIndex: 0,
        performanceTrend: [],
        masteryTrend: []
      },
      espiritual: {
        score: 0,
        cleanDays: 0,
        sacramentalFrequency: 0,
        moralStabilityScore: 0,
        dailyPrayerStreak: 0,
        confessionLog: [],
        relapseFlag: false
      },
      mental: {
        score: 0,
        relapseCount: 0,
        triggerPatterns: [],
        stabilityTrend: [],
        dopamineIndex: 0,
        impulseResistanceScore: 0,
        emotionalVolatilityIndex: 50,
        moodTrend: [],
        triggerLog: []
      },
      internet: {
        score: 0,
        contentProducedWeek: 0,
        engagementScore: 0,
        growthRate: 0,
        authorityScore: 0,
        consistencyIndex: 0
      }
    },
    projections: {
      projected90DaysScore: 0,
      projected3YearsScore: 0,
      regressionRisk: 50,
      growthVelocity: 0
    },
    discipline: {
      strictModeEnabled: false,
      failedDaysCount: 0,
      restrictionLevel: 0,
      lastPenaltyDate: null
    },
    logs: []
  };
  return mergeDeep(state, overrides);
}

function mergeDeep(target, source) {
  if (!source || typeof source !== 'object') return target;
  for (const key of Object.keys(source)) {
    if (Array.isArray(source[key])) {
      target[key] = source[key].slice();
      continue;
    }
    if (source[key] && typeof source[key] === 'object') {
      target[key] = mergeDeep(target[key] || {}, source[key]);
      continue;
    }
    target[key] = source[key];
  }
  return target;
}
