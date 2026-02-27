const ALERT_STATES = {
  NORMAL: 'NORMAL',
  ALERT: 'ALERT',
  RESTRICTED: 'RESTRICTED',
  FAILED: 'FAILED',
};

const DAY_TYPES = ['PUSH', 'PULL', 'LEGS'];

const MODULE_WEIGHTS = {
  treino: 0.2,
  dieta: 0.15,
  financeiro: 0.15,
  academico: 0.15,
  espiritual: 0.1,
  mental: 0.15,
  internet: 0.1,
};

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function avg(values) {
  if (!values.length) return 0;
  return values.reduce((acc, cur) => acc + cur, 0) / values.length;
}

function estimate1RM(load, reps) {
  return load * (1 + reps / 30);
}

function makeDefaultState() {
  return {
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
      alertState: ALERT_STATES.ALERT,
      lastEvaluationDate: null,
      scoreHistory: [],
    },
    modules: {
      treino: {
        currentCycle: 1,
        week: 1,
        dayType: 'PUSH',
        exercises: [],
        weeklyVolume: 0,
        fatigueIndex: 0,
        strengthIndex: 0,
        longTermStrengthGoal: { exercise: 'Squat', kg: 200 },
        performanceTrend: [],
        score: 0,
      },
      dieta: {
        age: 30,
        height: 171,
        weight: 86,
        bodyFatEstimate: 25,
        calorieTarget: 0,
        proteinTarget: 0,
        carbTarget: 0,
        fatTarget: 0,
        deficitLevel: 0.2,
        adherenceScore: 0,
        bingeFlag: false,
        weeklyWeightTrend: [],
        controlScore: 0,
        score: 0,
      },
      financeiro: {
        monthlyIncome: 0,
        monthlyExpenses: 0,
        savingsRate: 0,
        investmentValue: 0,
        disciplineScore: 50,
        gamblingFlag: false,
        projection1y: 0,
        projection3y: 0,
        projection5y: 0,
        score: 0,
      },
      academico: {
        studyHoursWeek: 0,
        studyHoursTotal: 0,
        subjects: [],
        authorityIndex: 0,
        performanceTrend: [],
        score: 0,
      },
      espiritual: {
        cleanDays: 0,
        sacramentalFrequency: 0,
        moralStabilityScore: 0,
        dailyPrayerStreak: 0,
        confessionLog: [],
        score: 0,
      },
      mental: {
        relapseCount: 0,
        triggerPatterns: [],
        stabilityTrend: [],
        dopamineIndex: 50,
        impulseResistanceScore: 50,
        emotionalVolatilityIndex: 50,
        score: 0,
      },
      internet: {
        contentProducedWeek: 0,
        engagementScore: 0,
        growthRate: 0,
        authorityScore: 0,
        consistencyIndex: 0,
        score: 0,
      },
    },
    projections: {
      projected90DaysScore: 0,
      projected3YearsScore: 0,
      regressionRisk: 100,
      growthVelocity: 0,
    },
    discipline: {
      strictModeEnabled: false,
      failedDaysCount: 0,
      restrictionLevel: 0,
      lastPenaltyDate: null,
    },
    logs: [],
  };
}

class AscensaoOS {
  constructor(initialState = null) {
    this.state = initialState ? structuredClone(initialState) : makeDefaultState();
    this.calculateDietTargets();
    this.recalculateAll();
  }

  calculateDietTargets() {
    const dieta = this.state.modules.dieta;
    const bmr = 10 * dieta.weight + 6.25 * dieta.height - 5 * dieta.age + 5;
    const tdee = bmr * 1.55;
    dieta.calorieTarget = Math.round(tdee * (1 - dieta.deficitLevel));
    dieta.proteinTarget = Math.round(2.2 * dieta.weight);
    dieta.fatTarget = Math.round(0.8 * dieta.weight);
    const kcalRemaining = dieta.calorieTarget - (dieta.proteinTarget * 4 + dieta.fatTarget * 9);
    dieta.carbTarget = Math.max(0, Math.round(kcalRemaining / 4));
  }

  validateExecution(moduleName, executionData) {
    if (!this.state.modules[moduleName]) {
      return { valid: false, reason: 'Módulo inexistente.' };
    }
    if (this.state.discipline.strictModeEnabled) {
      const allowed = ['treino', 'dieta', 'academico', 'espiritual'];
      if (!allowed.includes(moduleName)) {
        return { valid: false, reason: 'Modo Estrito: módulo bloqueado.' };
      }
    }

    const validator = this[`validate${moduleName[0].toUpperCase()}${moduleName.slice(1)}Execution`];
    if (!validator) return { valid: false, reason: 'Validação indisponível.' };

    const validation = validator.call(this, executionData);
    if (!validation.valid) return validation;

    const updater = this[`update${moduleName[0].toUpperCase()}${moduleName.slice(1)}Module`];
    updater.call(this, executionData);

    const xpDelta = Math.max(5, Math.round(validation.qualityScore / 2));
    this.state.core.xp += xpDelta;
    this.state.logs.push({ date: new Date().toISOString(), moduleName, executionData, xpDelta });

    this.recalculateAll();
    return { valid: true, xpDelta, globalScore: this.state.core.globalScore };
  }

  validateTreinoExecution(data) {
    if (!Array.isArray(data.exercises) || data.exercises.length === 0) {
      return { valid: false, reason: 'Treino inválido: sem exercícios.' };
    }
    for (const ex of data.exercises) {
      if (!ex.name || !ex.load || !ex.reps || !ex.sets) {
        return { valid: false, reason: 'Treino inválido: carga/reps/sets obrigatórios.' };
      }
    }
    return { valid: true, qualityScore: 90 };
  }

  updateTreinoModule(data) {
    const treino = this.state.modules.treino;
    treino.dayType = data.dayType || treino.dayType;
    treino.exercises = data.exercises.map((ex) => {
      const success = ex.targetReps ? ex.reps >= ex.targetReps && ex.rpe <= 8 : ex.rpe <= 8;
      const nextLoad = success ? +(ex.load * 1.025).toFixed(2) : ex.repeatFailure ? +(ex.load * 0.975).toFixed(2) : ex.load;
      return {
        ...ex,
        nextLoad,
        history: [...(ex.history || []), { date: new Date().toISOString(), load: ex.load, reps: ex.reps }],
      };
    });

    treino.weeklyVolume = treino.exercises.reduce((acc, ex) => acc + ex.load * ex.reps * ex.sets, 0);
    const avgRpe = avg(treino.exercises.map((ex) => ex.rpe));
    const consecutiveDays = data.consecutiveDays ?? 1;
    treino.fatigueIndex = clamp((treino.weeklyVolume / 500) * 0.5 + avgRpe * 5 + consecutiveDays * 7);

    const oneRMs = treino.exercises.map((ex) => estimate1RM(ex.load, ex.reps));
    const currentStrength = avg(oneRMs);
    const previous = treino.performanceTrend.length ? treino.performanceTrend[treino.performanceTrend.length - 1] : currentStrength;
    treino.strengthIndex = clamp((currentStrength / (treino.longTermStrengthGoal.kg || 200)) * 100 + (currentStrength - previous) * 2);
    treino.performanceTrend.push(currentStrength);

    const fatiguePenalty = treino.fatigueIndex > 80 ? 15 : 0;
    treino.score = clamp(50 + (treino.strengthIndex * 0.4) + (100 - treino.fatigueIndex) * 0.3 - fatiguePenalty);
  }

  validateDietaExecution(data) {
    if (!data.macros) return { valid: false, reason: 'Dieta inválida: macros obrigatórios.' };
    const { protein, carbs, fat, calories } = data.macros;
    if ([protein, carbs, fat, calories].some((v) => typeof v !== 'number')) {
      return { valid: false, reason: 'Dieta inválida: macros numéricos obrigatórios.' };
    }
    return { valid: true, qualityScore: 85 };
  }

  updateDietaModule(data) {
    const dieta = this.state.modules.dieta;
    const m = data.macros;

    const calorieDiff = Math.abs(m.calories - dieta.calorieTarget);
    const proteinDiff = Math.abs(m.protein - dieta.proteinTarget);
    const carbDiff = Math.abs(m.carbs - dieta.carbTarget);
    const fatDiff = Math.abs(m.fat - dieta.fatTarget);

    const adherence = clamp(100 - calorieDiff * 0.08 - proteinDiff * 0.4 - carbDiff * 0.2 - fatDiff * 0.3);
    dieta.adherenceScore = adherence;
    dieta.controlScore = adherence;
    dieta.bingeFlag = !!data.bingeFlag;

    if (typeof data.weight === 'number') {
      dieta.weight = data.weight;
      dieta.weeklyWeightTrend.push(data.weight);
      if (dieta.weeklyWeightTrend.length > 12) dieta.weeklyWeightTrend.shift();

      if (dieta.weeklyWeightTrend.length >= 2) {
        const recent = dieta.weeklyWeightTrend[dieta.weeklyWeightTrend.length - 1];
        const older = dieta.weeklyWeightTrend[dieta.weeklyWeightTrend.length - 2];
        const deltaPct = ((older - recent) / older) * 100;
        if (deltaPct > 1) dieta.deficitLevel = Math.max(0.1, dieta.deficitLevel - 0.05);
        if (deltaPct < 0.3) dieta.deficitLevel = Math.min(0.35, dieta.deficitLevel + 0.05);
      }
    }

    this.calculateDietTargets();

    let score = adherence;
    if (dieta.bingeFlag) {
      score -= 20;
      this.state.modules.mental.relapseCount += 1;
      this.state.core.disciplineIndex = clamp(this.state.core.disciplineIndex - 8);
    }

    dieta.score = clamp(score);
  }

  validateFinanceiroExecution(data) {
    if (typeof data.monthlyIncome !== 'number' || typeof data.monthlyExpenses !== 'number') {
      return { valid: false, reason: 'Financeiro inválido: renda e despesas obrigatórias.' };
    }
    return { valid: true, qualityScore: 80 };
  }

  updateFinanceiroModule(data) {
    const f = this.state.modules.financeiro;
    Object.assign(f, data);
    f.savingsRate = f.monthlyIncome > 0 ? (f.monthlyIncome - f.monthlyExpenses) / f.monthlyIncome : 0;
    const netWorth = f.investmentValue || 0;
    f.projection1y = netWorth * 1.08;
    f.projection3y = netWorth * 1.25;
    f.projection5y = netWorth * 1.6;

    let score = clamp(f.savingsRate * 100 + 40);
    if (f.gamblingFlag) {
      score -= 30;
      f.disciplineScore = clamp((f.disciplineScore || 50) - 30);
      this.state.core.disciplineIndex = clamp(this.state.core.disciplineIndex - 15);
    }
    f.score = clamp(score);
  }

  validateAcademicoExecution(data) {
    if (typeof data.studyHoursWeek !== 'number') {
      return { valid: false, reason: 'Acadêmico inválido: horas semanais obrigatórias.' };
    }
    return { valid: true, qualityScore: 75 };
  }

  updateAcademicoModule(data) {
    const a = this.state.modules.academico;
    Object.assign(a, data);
    const avgMastery = avg((a.subjects || []).map((s) => s.masteryScore || 0));
    const avgExam = avg((a.subjects || []).map((s) => s.examPerformance || 0));
    const consistencyBonus = a.studyHoursWeek >= 14 ? 15 : 0;
    a.authorityIndex = clamp(avgMastery * 0.5 + avgExam * 8 + consistencyBonus);
    a.score = clamp((a.studyHoursWeek / 20) * 50 + avgMastery * 0.4 + a.authorityIndex * 0.2);
  }

  validateEspiritualExecution(data) {
    if (typeof data.prayerCompleted !== 'boolean') {
      return { valid: false, reason: 'Espiritual inválido: oração diária obrigatória.' };
    }
    return { valid: true, qualityScore: 70 };
  }

  updateEspiritualModule(data) {
    const e = this.state.modules.espiritual;
    if (data.relapseFlag) {
      e.cleanDays = 0;
      this.state.core.disciplineIndex = clamp(this.state.core.disciplineIndex - 10);
      this.state.modules.mental.relapseCount += 1;
    } else {
      e.cleanDays += 1;
    }

    if (data.prayerCompleted) e.dailyPrayerStreak += 1;
    e.sacramentalFrequency = data.sacramentalFrequency ?? e.sacramentalFrequency;
    e.moralStabilityScore = clamp(e.dailyPrayerStreak * 1.5 + e.cleanDays * 0.8 + e.sacramentalFrequency * 8);
    e.score = e.moralStabilityScore;
  }

  validateMentalExecution(data) {
    if (typeof data.emotionalVolatilityIndex !== 'number') {
      return { valid: false, reason: 'Mental inválido: volatilidade obrigatória.' };
    }
    return { valid: true, qualityScore: 70 };
  }

  updateMentalModule(data) {
    const m = this.state.modules.mental;
    Object.assign(m, data);
    const recentRelapses = (data.recentRelapses7d ?? 0);
    if (recentRelapses >= 3) {
      m.emotionalVolatilityIndex = clamp(m.emotionalVolatilityIndex + 15);
    }
    m.score = clamp(
      m.dopamineIndex * 0.35 +
      m.impulseResistanceScore * 0.4 +
      (100 - m.emotionalVolatilityIndex) * 0.25 -
      m.relapseCount * 2
    );
  }

  validateInternetExecution(data) {
    if (typeof data.contentProducedWeek !== 'number') {
      return { valid: false, reason: 'Internet inválido: produção semanal obrigatória.' };
    }
    return { valid: true, qualityScore: 65 };
  }

  updateInternetModule(data) {
    const i = this.state.modules.internet;
    Object.assign(i, data);
    if (data.daysWithoutContent >= 7) {
      i.consistencyIndex = clamp(i.consistencyIndex - 20);
      i.growthRate = clamp(i.growthRate - 10);
    }
    i.score = clamp(i.consistencyIndex * 0.4 + i.engagementScore * 0.3 + i.authorityScore * 0.3);
  }

  recalculateCoreScore() {
    const scores = Object.entries(this.state.modules).map(([name, module]) => ({ name, score: module.score || 0 }));
    const weighted = scores.reduce((acc, item) => acc + item.score * MODULE_WEIGHTS[item.name], 0);
    const below60 = scores.filter((s) => s.score < 60).length;
    const penalty = below60 >= 3 ? 0.4 : below60 === 2 ? 0.65 : below60 === 1 ? 0.85 : 1;

    this.state.core.globalScore = clamp(weighted * penalty);
    this.state.core.alertState = below60 === 0
      ? ALERT_STATES.NORMAL
      : below60 === 1
        ? ALERT_STATES.ALERT
        : below60 === 2
          ? ALERT_STATES.RESTRICTED
          : ALERT_STATES.FAILED;
  }

  recalculateIndexes() {
    const core = this.state.core;
    const d = this.state.discipline;
    const mental = this.state.modules.mental;

    const history = core.scoreHistory;
    const avgLast7 = avg(history.slice(-7));

    core.disciplineIndex = clamp(core.streak * 0.4 + avgLast7 * 0.4 - d.failedDaysCount * 0.2);

    const trend = avg(mental.stabilityTrend.slice(-7));
    core.stabilityIndex = clamp(
      trend * 0.5 + (100 - mental.emotionalVolatilityIndex) * 0.3 + (100 - mental.relapseCount * 5) * 0.2
    );

    const score7DaysAgo = history.length >= 7 ? history[history.length - 7] : core.globalScore;
    const growthVelocity = core.globalScore - score7DaysAgo;
    core.growthIndex = clamp(growthVelocity * 5);

    core.level = 1 + Math.floor(Math.sqrt(core.xp / 50));
  }

  recalculateProjections() {
    const core = this.state.core;
    const history = core.scoreHistory;
    const score14Ago = history.length >= 14 ? history[history.length - 14] : core.globalScore;

    const growthVelocity = (core.globalScore - score14Ago) / 14;
    const consistencyFactor = core.disciplineIndex / 100;

    const mental = this.state.modules.mental;
    const highRisk = mental.relapseCount >= 3 || core.disciplineIndex < 60 || growthVelocity < 0;

    this.state.projections = {
      growthVelocity,
      projected90DaysScore: clamp(core.globalScore + growthVelocity * 90),
      projected3YearsScore: clamp(core.globalScore + growthVelocity * 1095 * consistencyFactor),
      regressionRisk: clamp(highRisk ? 70 + mental.relapseCount * 3 : 20 + (100 - core.stabilityIndex) * 0.2),
    };
  }

  applyFailedDay() {
    const core = this.state.core;
    const discipline = this.state.discipline;

    core.streak = 0;
    discipline.failedDaysCount += 1;
    discipline.restrictionLevel += 1;
    discipline.lastPenaltyDate = new Date().toISOString();
    core.xp = Math.max(0, core.xp - 20);

    if (discipline.restrictionLevel >= 3) {
      discipline.strictModeEnabled = true;
    }
  }

  dailyEvaluation() {
    this.recalculateAll();
    this.state.core.scoreHistory.push(this.state.core.globalScore);
    if (this.state.core.scoreHistory.length > 60) this.state.core.scoreHistory.shift();

    if (this.state.core.alertState === ALERT_STATES.FAILED) {
      this.applyFailedDay();
    } else {
      this.state.core.streak += 1;
    }

    if (this.state.discipline.strictModeEnabled) {
      const last7 = this.state.core.scoreHistory.slice(-7);
      const allGood = last7.length === 7 && last7.every((s) => s >= 75);
      const zeroRelapse = this.state.modules.mental.relapseCount === 0;
      if (allGood && zeroRelapse) {
        this.state.discipline.strictModeEnabled = false;
        this.state.discipline.restrictionLevel = Math.max(0, this.state.discipline.restrictionLevel - 1);
      }
    }

    this.state.core.lastEvaluationDate = new Date().toISOString();
    this.state.core.currentDay += 1;
    this.recalculateAll();
  }

  generateGuidedSession() {
    const treino = this.state.modules.treino;
    const sessions = treino.exercises.map((ex) => `${ex.name} — ${ex.sets}x${ex.reps} — ${ex.nextLoad || ex.load}kg — descanso ${ex.restSeconds || 120}s`);
    return {
      dayType: treino.dayType,
      directives: sessions,
      strengthIndex: treino.strengthIndex,
      longTermGoal: `${treino.longTermStrengthGoal.exercise} ${treino.longTermStrengthGoal.kg}kg`,
      deloadSuggested: treino.fatigueIndex > 80,
    };
  }

  generateDietGuide(consumed = { protein: 0, carbs: 0, fat: 0, calories: 0 }) {
    const d = this.state.modules.dieta;
    return {
      calorieTarget: d.calorieTarget,
      proteinRemaining: d.proteinTarget - consumed.protein,
      carbsRemaining: d.carbTarget - consumed.carbs,
      fatRemaining: d.fatTarget - consumed.fat,
      caloricImpactScore: clamp(d.score - Math.max(0, consumed.calories - d.calorieTarget) * 0.05),
    };
  }

  mentorDirective(context = {}) {
    const { core, modules, discipline } = this.state;

    if (!context.treinoDone) {
      return `Execute ${modules.treino.dayType} agora. Sessão guiada pronta.`;
    }
    if (modules.dieta.adherenceScore < 70) {
      return 'Ajuste carbo em -20g amanhã.';
    }
    if (modules.mental.relapseCount > 0 || core.alertState === ALERT_STATES.FAILED) {
      return discipline.strictModeEnabled
        ? 'Falha registrada. Modo Estrito ativo.'
        : 'Falha registrada. Modo Estrito ativado.';
    }
    if (core.disciplineIndex >= 75 && core.growthIndex > 0) {
      return 'Progresso real. Continue.';
    }
    return 'Execute tarefas obrigatórias e valide dados completos.';
  }

  weeklyReport() {
    return {
      treinoEvolution: this.state.modules.treino.performanceTrend.slice(-7),
      weightEvolution: this.state.modules.dieta.weeklyWeightTrend.slice(-7),
      disciplineEvolution: this.state.core.scoreHistory.slice(-7),
      failurePoints: this.state.logs.filter((l) => l.xpDelta < 10).slice(-10),
      updatedProjection: this.state.projections,
    };
  }

  recalculateAll() {
    this.recalculateCoreScore();
    this.recalculateIndexes();
    this.recalculateProjections();
  }
}

module.exports = {
  AscensaoOS,
  makeDefaultState,
  ALERT_STATES,
  DAY_TYPES,
};
