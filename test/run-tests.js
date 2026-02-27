const assert = require('assert');
const { AscensaoOS, ALERT_STATES } = require('../src/ascensao-os');

const app = new AscensaoOS();

let result = app.validateExecution('treino', {
  dayType: 'PUSH',
  exercises: [
    { name: 'Supino', sets: 4, reps: 6, targetReps: 6, load: 82, rpe: 8, restSeconds: 120 },
    { name: 'Desenvolvimento', sets: 3, reps: 8, targetReps: 8, load: 26, rpe: 7, restSeconds: 90 },
  ],
  consecutiveDays: 2,
});
assert.equal(result.valid, true);

result = app.validateExecution('dieta', {
  macros: {
    protein: app.state.modules.dieta.proteinTarget,
    carbs: app.state.modules.dieta.carbTarget,
    fat: app.state.modules.dieta.fatTarget,
    calories: app.state.modules.dieta.calorieTarget,
  },
  weight: 85.4,
});
assert.equal(result.valid, true);

result = app.validateExecution('financeiro', {
  monthlyIncome: 10000,
  monthlyExpenses: 5500,
  investmentValue: 20000,
  gamblingFlag: false,
});
assert.equal(result.valid, true);

result = app.validateExecution('academico', {
  studyHoursWeek: 18,
  subjects: [
    { name: 'Math', masteryScore: 80, revisionCycle: 7, examPerformance: 9 },
    { name: 'Physics', masteryScore: 76, revisionCycle: 7, examPerformance: 8.2 },
  ],
});
assert.equal(result.valid, true);

result = app.validateExecution('espiritual', {
  prayerCompleted: true,
  relapseFlag: false,
  sacramentalFrequency: 2,
});
assert.equal(result.valid, true);

result = app.validateExecution('mental', {
  dopamineIndex: 72,
  impulseResistanceScore: 74,
  emotionalVolatilityIndex: 28,
  relapseCount: 0,
  stabilityTrend: [70, 72, 73, 74, 75],
});
assert.equal(result.valid, true);

result = app.validateExecution('internet', {
  contentProducedWeek: 4,
  engagementScore: 69,
  growthRate: 12,
  authorityScore: 60,
  consistencyIndex: 78,
  daysWithoutContent: 0,
});
assert.equal(result.valid, true);

app.dailyEvaluation();

assert.ok(app.state.core.globalScore >= 0 && app.state.core.globalScore <= 100);
assert.ok(app.state.core.level >= 1);
assert.ok(Object.values(ALERT_STATES).includes(app.state.core.alertState));
assert.ok(app.generateGuidedSession().directives.length > 0);
assert.ok(typeof app.mentorDirective({ treinoDone: true }) === 'string');

console.log('All ASCENSÃO OS checks passed.');
