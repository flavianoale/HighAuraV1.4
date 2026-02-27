import { ALERT_STATES, DAY_TYPES } from './state.js';

const WEIGHTS = {
  treino: 0.2,
  dieta: 0.2,
  financeiro: 0.15,
  academico: 0.15,
  espiritual: 0.1,
  mental: 0.1,
  internet: 0.1
};

export function clamp(v, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number.isFinite(v) ? v : min));
}

function avg(values) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export class AscensaoEngine {
  constructor(state, persistence) {
    this.state = state;
    this.persistence = persistence;
  }

  validateExecution(moduleName, executionData) {
    const validators = {
      treino: this.validateTreinoExecution.bind(this),
      dieta: this.validateDietaExecution.bind(this),
      academico: d => Number(d.hours) > 0,
      financeiro: d => Number(d.monthlyIncome) >= 0,
      espiritual: d => typeof d.prayed === 'boolean',
      mental: d => Number(d.sleepQuality) >= 0,
      internet: d => Number(d.contentProducedWeek) >= 0
    };
    const valid = validators[moduleName]?.(executionData) ?? false;
    if (!valid) {
      this.log(`Execução inválida para ${moduleName}`);
      return false;
    }

    this.applyModuleUpdate(moduleName, executionData);
    this.applyXP(moduleName, executionData);
    this.recalculateAll();
    this.persist();
    return true;
  }

  validateTreinoExecution(data) {
    return Array.isArray(data.exercises) && data.exercises.length > 0 &&
      data.exercises.every(ex => Number(ex.load) > 0 && Number(ex.sets) > 0 && Number(ex.reps) > 0);
  }

  validateDietaExecution(data) {
    return Number(data.calories) > 0 && Number(data.protein) >= 0 && Number(data.carbs) >= 0 && Number(data.fat) >= 0;
  }

  applyModuleUpdate(moduleName, data) {
    switch (moduleName) {
      case 'treino':
        this.updateTreino(data);
        break;
      case 'dieta':
        this.updateDieta(data);
        break;
      case 'financeiro':
        this.updateFinanceiro(data);
        break;
      case 'academico':
        this.updateAcademico(data);
        break;
      case 'espiritual':
        this.updateEspiritual(data);
        break;
      case 'mental':
        this.updateMental(data);
        break;
      case 'internet':
        this.updateInternet(data);
        break;
      default:
        throw new Error(`Módulo desconhecido: ${moduleName}`);
    }
  }

  applyXP(moduleName, data) {
    const completion = clamp(data.completion ?? 100);
    const gain = Math.round((completion / 10) + 5);
    this.state.core.xp += gain;
    this.state.core.level = 1 + Math.floor(Math.sqrt(this.state.core.xp / 50));
    this.log(`XP +${gain} via ${moduleName}`);
  }

  updateTreino({ exercises, dayType, consecutiveDays = 1 }) {
    const treino = this.state.modules.treino;
    treino.dayType = DAY_TYPES.includes(dayType) ? dayType : treino.dayType;
    treino.exercises = exercises.map(ex => {
      const hitGoal = ex.hitAllReps && Number(ex.rpe) <= 8;
      const repeatedFailure = ex.failedLastWeek && !ex.hitAllReps;
      const nextLoad = hitGoal ? ex.load * 1.025 : repeatedFailure ? ex.load * 0.975 : ex.load;
      return {
        ...ex,
        nextLoad: Number(nextLoad.toFixed(2)),
        history: [...(ex.history ?? []), { date: new Date().toISOString(), load: ex.load, reps: ex.reps }]
      };
    });
    treino.weeklyVolume = treino.exercises.reduce((sum, ex) => sum + (ex.sets * ex.reps * ex.load), 0);
    const avgRpe = avg(treino.exercises.map(ex => ex.rpe));
    treino.fatigueIndex = clamp((treino.weeklyVolume / 500) + (avgRpe * 8) + (consecutiveDays * 5));
    const estimated1RM = avg(treino.exercises.map(ex => ex.load * (1 + ex.reps / 30)));
    const previousStrength = treino.strengthIndex || estimated1RM;
    treino.strengthIndex = clamp((estimated1RM / treino.longTermStrengthGoal) * 100);
    treino.performanceTrend.push(treino.strengthIndex - previousStrength);
    treino.score = clamp((treino.strengthIndex * 0.5) + ((100 - treino.fatigueIndex) * 0.2) + (avgRpe <= 8 ? 30 : 10));
    if (treino.fatigueIndex > 80) this.log('Deload sugerido: fatigueIndex > 80');
  }

  updateDieta({ calories, protein, carbs, fat, weight, bingeFlag = false }) {
    const dieta = this.state.modules.dieta;
    dieta.weight = weight ?? dieta.weight;
    const bmr = (10 * dieta.weight) + (6.25 * dieta.height) - (5 * dieta.age) + 5;
    const tdee = bmr * 1.55;
    dieta.calorieTarget = Math.round(tdee * (1 - dieta.deficitLevel));
    dieta.proteinTarget = Math.round(dieta.weight * 2.2);
    dieta.fatTarget = Math.round(dieta.weight * 0.8);
    const proteinCals = dieta.proteinTarget * 4;
    const fatCals = dieta.fatTarget * 9;
    dieta.carbTarget = Math.max(0, Math.round((dieta.calorieTarget - proteinCals - fatCals) / 4));
    dieta.adherenceScore = clamp(100 - Math.abs(calories - dieta.calorieTarget) / dieta.calorieTarget * 100);
    dieta.controlScore = clamp((protein >= dieta.proteinTarget ? 40 : 20) + (dieta.adherenceScore * 0.6));
    dieta.bingeFlag = bingeFlag;
    dieta.weeklyWeightTrend.push(dieta.weight);
    dieta.mealPlan = buildRiceChickenPlan(dieta);
    if (dieta.weeklyWeightTrend.length >= 2) {
      const weeklyDelta = (dieta.weeklyWeightTrend.at(-2) - dieta.weeklyWeightTrend.at(-1)) / dieta.weight;
      if (weeklyDelta > 0.01) dieta.deficitLevel = Math.max(0.1, dieta.deficitLevel - 0.05);
      else if (weeklyDelta < 0.003) dieta.deficitLevel = Math.min(0.35, dieta.deficitLevel + 0.05);
    }
    dieta.score = clamp((dieta.adherenceScore * 0.5) + (dieta.controlScore * 0.5) - (bingeFlag ? 20 : 0));
    if (bingeFlag) {
      this.state.modules.mental.relapseCount += 1;
      this.state.core.disciplineIndex = clamp(this.state.core.disciplineIndex - 10);
    }
  }

  updateFinanceiro(data) {
    const f = this.state.modules.financeiro;
    Object.assign(f, data);
    f.monthlyExpenses = (f.fixedExpenses ?? 0) + (f.variableExpenses ?? 0);
    f.savingsRate = f.monthlyIncome > 0 ? (f.monthlyIncome - f.monthlyExpenses) / f.monthlyIncome : 0;
    f.netWorth = (f.savings ?? 0) + (f.investmentValue ?? 0);
    f.projection1y = f.netWorth * 1.08;
    f.projection3y = f.netWorth * 1.25;
    f.projection5y = f.netWorth * 1.6;
    f.disciplineScore = clamp((f.savingsRate * 100) + (f.gamblingFlag ? -30 : 20));
    f.score = clamp((f.savingsRate * 60) + ((f.netWorth > 0 ? 20 : 0)) + (f.gamblingFlag ? -30 : 20));
    if (f.gamblingFlag) {
      this.state.core.disciplineIndex = clamp(this.state.core.disciplineIndex - 15);
      this.state.discipline.restrictionLevel += 1;
    }
  }

  updateAcademico(data) {
    const a = this.state.modules.academico;
    a.studyHoursWeek = data.studyHoursWeek;
    a.studyHoursTotal += data.studyHoursWeek;
    a.subjects = data.subjects;
    const mastery = a.subjects.map(s => clamp((s.hoursStudied * 4) + (s.activeRevision * 30) + (s.examPerformance * 5)));
    a.masteryTrend.push(avg(mastery));
    a.authorityIndex = clamp((a.masteryTrend.slice(-4).every(v => v >= 80) ? 80 : avg(a.masteryTrend.slice(-4))) + (data.averageGrade >= 8 ? 20 : 0));
    a.performanceTrend.push(data.averageGrade);
    a.score = clamp((avg(mastery) * 0.6) + (a.authorityIndex * 0.4) - (a.studyHoursWeek < data.targetHours ? 20 : 0));
  }

  updateEspiritual(data) {
    const e = this.state.modules.espiritual;
    e.relapseFlag = Boolean(data.relapseFlag);
    e.sacramentalFrequency = data.sacramentalFrequency ?? e.sacramentalFrequency;
    e.dailyPrayerStreak = data.prayed ? e.dailyPrayerStreak + 1 : 0;
    e.cleanDays = e.relapseFlag ? 0 : e.cleanDays + 1;
    e.confessionLog = [...e.confessionLog, ...(data.confession ? [data.confession] : [])];
    e.moralStabilityScore = clamp((e.dailyPrayerStreak * 2) + (e.cleanDays * 1.5) + (e.sacramentalFrequency * 10));
    e.score = clamp(e.moralStabilityScore);
    if (e.relapseFlag) {
      this.state.modules.mental.relapseCount += 1;
      this.state.core.disciplineIndex = clamp(this.state.core.disciplineIndex - 10);
    }
  }

  updateMental(data) {
    const m = this.state.modules.mental;
    m.triggerPatterns = data.triggerPatterns ?? m.triggerPatterns;
    m.triggerLog = [...m.triggerLog, ...(data.newTriggers ?? [])];
    m.moodTrend.push(data.moodScore);
    m.emotionalVolatilityIndex = clamp(100 - avg(m.absoluteMoodDelta ?? [40]));
    m.dopamineIndex = clamp((data.sleepQuality * 0.4) + ((data.compulsionFree ? 1 : 0) * 30) + (data.emotionalStability * 0.3));
    m.impulseResistanceScore = clamp((data.urgeDeflections * 10) - (m.relapseCount * 3) + 40);
    m.stabilityTrend.push(clamp((m.dopamineIndex + m.impulseResistanceScore) / 2));
    const recentRelapses = data.recentRelapses7d ?? m.relapseCount;
    m.score = clamp((m.dopamineIndex * 0.4) + (m.impulseResistanceScore * 0.4) + ((100 - m.emotionalVolatilityIndex) * 0.2) - (recentRelapses >= 3 ? 20 : 0));
    if (recentRelapses >= 3) this.state.projections.regressionRisk = clamp(this.state.projections.regressionRisk + 20);
  }

  updateInternet(data) {
    const i = this.state.modules.internet;
    i.contentProducedWeek = data.contentProducedWeek;
    i.engagementScore = clamp(data.engagementRate * 100);
    i.growthRate = clamp(data.growthRate * 100);
    const consistencyPenalty = data.daysWithoutPublishing >= 7 ? 20 : 0;
    i.consistencyIndex = clamp((i.contentProducedWeek * 10) - consistencyPenalty + 30);
    i.authorityScore = clamp((i.consistencyIndex * 0.5) + (i.engagementScore * 0.5));
    i.score = clamp((i.authorityScore * 0.6) + (i.growthRate * 0.4) - consistencyPenalty);
  }

  recalculateAll() {
    this.recalculateCore();
    this.recalculateDiscipline();
    this.recalculateProjection();
  }

  recalculateCore() {
    const moduleScores = Object.fromEntries(Object.entries(this.state.modules).map(([k, v]) => [k, clamp(v.score)]));
    const baseScore = Object.entries(moduleScores).reduce((sum, [k, score]) => sum + (score * WEIGHTS[k]), 0);
    const lowCount = Object.values(moduleScores).filter(v => v < 60).length;
    const penalty = lowCount === 0 ? 1 : lowCount === 1 ? 0.85 : lowCount === 2 ? 0.65 : 0.4;
    this.state.core.globalScore = clamp(baseScore * penalty);
    this.state.core.alertState = lowCount === 0 ? ALERT_STATES.NORMAL : lowCount === 1 ? ALERT_STATES.ALERT : lowCount === 2 ? ALERT_STATES.RESTRICTED : ALERT_STATES.FAILED;
    this.state.core.scoreHistory.push(this.state.core.globalScore);
    const avgLast7 = avg(this.state.core.scoreHistory.slice(-7));
    this.state.core.disciplineIndex = clamp((this.state.core.streak * 0.4) + (avgLast7 * 0.4) - (this.state.discipline.failedDaysCount * 0.2));
    const mental = this.state.modules.mental;
    const stabilityBase = avg(mental.stabilityTrend.slice(-7));
    this.state.core.stabilityIndex = clamp(stabilityBase - (mental.emotionalVolatilityIndex * 0.3) - (mental.relapseCount * 2));
    const score7 = this.state.core.scoreHistory.length >= 8 ? this.state.core.scoreHistory.at(-8) : this.state.core.globalScore;
    const growthVelocity = this.state.core.globalScore - score7;
    this.state.core.growthIndex = clamp(growthVelocity * 5);

    if (this.state.core.alertState === ALERT_STATES.FAILED) {
      this.state.core.streak = 0;
      this.state.discipline.failedDaysCount += 1;
      this.state.discipline.restrictionLevel += 1;
      this.state.core.xp = Math.max(0, this.state.core.xp - 15);
      this.log('Dia reprovado: penalidades aplicadas');
    }
  }

  recalculateDiscipline() {
    const d = this.state.discipline;
    if (d.restrictionLevel >= 3) d.strictModeEnabled = true;
    if (d.strictModeEnabled) {
      this.state.modules.internet.score = 0;
    }
  }

  recalculateProjection() {
    const history = this.state.core.scoreHistory;
    const today = history.at(-1) ?? this.state.core.globalScore;
    const score14 = history.length >= 15 ? history.at(-15) : today;
    const growthVelocity = (today - score14) / 14;
    const consistencyFactor = this.state.core.disciplineIndex / 100;
    this.state.projections.growthVelocity = growthVelocity;
    this.state.projections.projected90DaysScore = clamp(today + (growthVelocity * 90));
    this.state.projections.projected3YearsScore = clamp(today + (growthVelocity * 1095 * consistencyFactor));
    const relapseHigh = this.state.modules.mental.relapseCount >= 3;
    const disciplineLow = this.state.core.disciplineIndex < 60;
    const negativeGrowth = growthVelocity < 0;
    this.state.projections.regressionRisk = clamp(relapseHigh || disciplineLow || negativeGrowth ? 80 : 30);
  }

  generateGuidedSession() {
    const treino = this.state.modules.treino;
    return treino.exercises.map(ex => `${ex.name} — ${ex.sets}x${ex.reps} — ${ex.load}kg — descanso ${ex.restSeconds ?? 120}s`).join('\n');
  }

  mentorDirective(context = {}) {
    if (this.state.core.alertState === ALERT_STATES.FAILED) return 'Falha registrada. Modo Estrito ativado.';
    if (!context.trainingDone) return 'Execute PUSH agora. 4x6 82kg. Sem desculpas.';
    if (context.dietOffTrack) return 'Ajuste carbo em -20g amanhã.';
    if (context.relapse) return 'Falha registrada. Modo Estrito ativado.';
    return 'Progresso real. Continue.';
  }

  dailyEvaluation() {
    this.recalculateAll();
    const required = {
      treino: this.state.modules.treino.score >= 60,
      dieta: this.state.modules.dieta.score >= 60,
      academico: this.state.modules.academico.score >= 50,
      espiritual: this.state.modules.espiritual.score >= 50
    };
    const passed = Object.values(required).every(Boolean);
    if (passed) this.state.core.streak += 1;
    else {
      this.state.core.streak = 0;
      this.state.discipline.failedDaysCount += 1;
      this.state.discipline.restrictionLevel += 1;
      this.state.core.xp = Math.max(0, this.state.core.xp - 10);
    }
    if (this.state.discipline.strictModeEnabled) {
      const exitStrict = this.state.core.scoreHistory.slice(-7).every(v => v >= 75) &&
        this.state.modules.mental.relapseCount === 0 &&
        this.state.modules.treino.score >= 75 &&
        this.state.modules.dieta.score >= 75;
      if (exitStrict) this.state.discipline.strictModeEnabled = false;
    }
    this.state.core.lastEvaluationDate = new Date().toISOString();
    this.persist();
  }

  exportWeeklyReport(format = 'json') {
    const report = {
      treinoEvolution: this.state.modules.treino.performanceTrend.slice(-7),
      pesoEvolution: this.state.modules.dieta.weeklyWeightTrend.slice(-7),
      disciplinaEvolution: this.state.core.scoreHistory.slice(-7),
      failPoints: this.state.logs.filter(x => x.message.includes('Falha')).slice(-10),
      projection: this.state.projections
    };
    return format === 'txt'
      ? `TREINO: ${JSON.stringify(report.treinoEvolution)}\nPESO: ${JSON.stringify(report.pesoEvolution)}\nDISCIPLINA: ${JSON.stringify(report.disciplinaEvolution)}\nPROJECAO: ${JSON.stringify(report.projection)}`
      : JSON.stringify(report, null, 2);
  }

  strictModeView() {
    if (!this.state.discipline.strictModeEnabled) return null;
    return {
      treinoDoDia: this.state.modules.treino.dayType,
      caloriasDoDia: this.state.modules.dieta.calorieTarget,
      estudoMinimo: 2,
      oracaoMinima: 1,
      internetBlocked: true,
      futureAnalysisBlocked: true
    };
  }

  dashboard() {
    return {
      globalScore: this.state.core.globalScore,
      level: this.state.core.level,
      streak: this.state.core.streak,
      disciplineIndex: this.state.core.disciplineIndex,
      stabilityIndex: this.state.core.stabilityIndex,
      growthIndex: this.state.core.growthIndex,
      alertState: this.state.core.alertState,
      radar: Object.fromEntries(Object.entries(this.state.modules).map(([k, v]) => [k, v.score])),
      highRisk: this.state.projections.regressionRisk > 60
    };
  }

  log(message) {
    this.state.logs.push({ timestamp: new Date().toISOString(), message });
  }

  persist() {
    this.persistence?.save(this.state);
  }
}

function buildRiceChickenPlan(dieta) {
  const meals = 4;
  const ricePerMeal = Math.round((dieta.carbTarget / meals) * 1.3);
  const chickenPerMeal = Math.round((dieta.proteinTarget / meals) * 1.2);
  return Array.from({ length: meals }, (_, idx) => ({
    meal: idx + 1,
    riceGrams: ricePerMeal,
    chickenGrams: chickenPerMeal,
    adjustmentMarginCalories: 100
  }));
}
