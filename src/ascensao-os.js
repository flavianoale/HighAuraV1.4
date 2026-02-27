const MODULE_NAMES = [
  'treino',
  'dieta',
  'financeiro',
  'academico',
  'espiritual',
  'mental',
  'internet'
];

const MODULE_WEIGHTS = {
  treino: 0.2,
  dieta: 0.18,
  financeiro: 0.14,
  academico: 0.14,
  espiritual: 0.12,
  mental: 0.14,
  internet: 0.08
};

const DAY_SPLIT = ['PUSH', 'PULL', 'LEGS', 'PUSH', 'PULL', 'LEGS', 'ACTIVE_REST'];

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

export function createInitialState({ age = 25 } = {}) {
  const now = new Date().toISOString();
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
      alertState: 'NORMAL',
      lastEvaluationDate: now,
      scoreHistory: []
    },
    modules: {
      treino: {
        score: 0,
        currentCycle: 1,
        week: 1,
        dayType: 'PUSH',
        exercises: defaultExercises('PUSH'),
        weeklyVolume: 0,
        fatigueIndex: 0,
        strengthIndex: 0,
        longTermStrengthGoal: '200kg squat',
        performanceTrend: []
      },
      dieta: {
        score: 0,
        age,
        weight: 86,
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
        lastDailyIntake: null,
        plan: null
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
        gamblingFlag: false,
        disciplineScore: 100,
        netWorth: 0,
        projection1y: 0,
        projection3y: 0,
        projection5y: 0,
        growthTrend: []
      },
      academico: {
        score: 0,
        studyHoursWeek: 0,
        studyHoursTotal: 0,
        weeklyStudyHours: 0,
        subjects: [],
        authorityIndex: 0,
        performanceTrend: [],
        masteryTrend: []
      },
      espiritual: {
        score: 0,
        cleanDays: 0,
        relapseFlag: false,
        sacramentalFrequency: 0,
        moralStabilityScore: 0,
        dailyPrayerStreak: 0,
        prayerStreak: 0,
        confessionLog: []
      },
      mental: {
        score: 0,
        relapseCount: 0,
        triggerPatterns: [],
        triggerLog: [],
        stabilityTrend: [],
        moodTrend: [],
        dopamineIndex: 0,
        impulseResistanceScore: 0,
        emotionalVolatilityIndex: 50
      },
      internet: {
        score: 0,
        contentProducedWeek: 0,
        contentCountWeek: 0,
        engagementScore: 0,
        engagementRate: 0,
        growthRate: 0,
        authorityScore: 0,
        consistencyIndex: 0,
        lastContentDate: null
      }
    },
    projections: {
      projected90DaysScore: 0,
      projected3YearsScore: 0,
      regressionRisk: 20,
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
}

function defaultExercises(dayType) {
  const templates = {
    PUSH: ['Supino com barra', 'Desenvolvimento halteres', 'Elevação lateral', 'Tríceps mergulho', 'Flexão até falha'],
    PULL: ['Remada curvada', 'Barra fixa', 'Remada unilateral', 'Rosca direta', 'Face pull'],
    LEGS: ['Agachamento', 'Levantamento romeno', 'Avanço', 'Panturrilha', 'Agachamento búlgaro']
  };
  if (!templates[dayType]) {
    return [];
  }
  return templates[dayType].map((name) => ({ name, sets: 4, reps: 6, load: 40, rpe: 7, history: [] }));
}

export class AscensaoOS {
  constructor(storage = null, initialState = createInitialState()) {
    this.storage = storage;
    this.state = initialState;
    this.recalculateAll();
  }

  persist() {
    if (!this.storage) return;
    this.storage.setItem('ascensao_os_state', JSON.stringify(this.state));
  }

  static restore(storage) {
    const raw = storage.getItem('ascensao_os_state');
    if (!raw) return new AscensaoOS(storage);
    return new AscensaoOS(storage, JSON.parse(raw));
  }

  validateExecution(moduleName, executionData) {
    const validators = {
      treino: (data) => Array.isArray(data.exercises) && data.exercises.every((ex) => ex.load > 0 && ex.reps > 0),
      dieta: (data) => data.calories >= 0 && data.protein >= 0 && data.carbs >= 0 && data.fat >= 0,
      academico: (data) => Number.isFinite(data.hours) && data.hours > 0,
      financeiro: (data) => Number.isFinite(data.monthlyIncome) && Number.isFinite(data.monthlyExpenses),
      espiritual: (data) => typeof data.relapseFlag === 'boolean',
      mental: (data) => Number.isFinite(data.emotionalVolatilityIndex),
      internet: (data) => Number.isFinite(data.contentCountWeek)
    };
    const valid = validators[moduleName]?.(executionData) ?? false;
    if (!valid) {
      this.log(`Execução inválida no módulo ${moduleName}. XP não concedido.`);
      return false;
    }

    this.applyModuleUpdate(moduleName, executionData);
    this.awardXp(20);
    this.recalculateAll();
    this.persist();
    return true;
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

  awardXp(amount) {
    this.state.core.xp = Math.max(0, this.state.core.xp + amount);
    this.state.core.level = 1 + Math.floor(Math.sqrt(this.state.core.xp / 50));
  }

  updateTreino({ exercises, dayType, date = new Date().toISOString(), consecutiveDays = 1 }) {
    const treino = this.state.modules.treino;
    treino.dayType = dayType ?? treino.dayType;
    treino.exercises = exercises.map((ex) => {
      const succeeded = ex.hitAllReps && ex.rpe <= 8;
      let nextLoad = ex.load;
      if (succeeded) nextLoad = ex.load * 1.025;
      if (!succeeded && ex.repeatedFailure) nextLoad = ex.load * 0.975;
      const oneRm = ex.load * (1 + ex.reps / 30);
      return {
        ...ex,
        history: [...(ex.history ?? []), { date, load: ex.load, reps: ex.reps }],
        nextLoad,
        estimatedOneRm: oneRm
      };
    });

    treino.weeklyVolume = treino.exercises.reduce((acc, ex) => acc + ex.sets * ex.reps * ex.load, 0);
    const avgRpe = avg(treino.exercises.map((ex) => ex.rpe));
    treino.fatigueIndex = clamp((treino.weeklyVolume / 400) * 0.5 + avgRpe * 5 + consecutiveDays * 4, 0, 100);
    treino.strengthIndex = clamp(avg(treino.exercises.map((ex) => ex.estimatedOneRm)) / 2, 0, 100);
    if (treino.fatigueIndex > 80) this.log('Fadiga elevada: deload automático sugerido.');

    treino.performanceTrend.push(treino.strengthIndex);
    treino.score = clamp(treino.strengthIndex * 0.7 + (100 - treino.fatigueIndex) * 0.3);
  }

  updateDieta(data) {
    const dieta = this.state.modules.dieta;
    Object.assign(dieta, data);
    const bmr = 10 * dieta.weight + 6.25 * 171 - 5 * dieta.age + 5;
    const tdee = bmr * 1.55;
    dieta.calorieTarget = Math.round(tdee * (1 - dieta.deficitLevel));
    dieta.proteinTarget = Math.round(2.2 * dieta.weight);
    dieta.fatTarget = Math.round(0.8 * dieta.weight);
    const caloriesFromProtein = dieta.proteinTarget * 4;
    const caloriesFromFat = dieta.fatTarget * 9;
    dieta.carbTarget = Math.max(0, Math.round((dieta.calorieTarget - caloriesFromProtein - caloriesFromFat) / 4));

    const daily = dieta.lastDailyIntake ?? { calories: dieta.calorieTarget, protein: dieta.proteinTarget, carbs: dieta.carbTarget, fat: dieta.fatTarget };
    const adherence = 100 - Math.min(100, Math.abs(daily.calories - dieta.calorieTarget) / dieta.calorieTarget * 100);
    dieta.adherenceScore = clamp(adherence);

    const weekly = dieta.weeklyWeightTrend;
    if (weekly.length >= 2) {
      const deltaPct = ((weekly[weekly.length - 2] - weekly[weekly.length - 1]) / weekly[weekly.length - 2]) * 100;
      if (deltaPct > 1) dieta.deficitLevel = Math.max(0.1, dieta.deficitLevel - 0.05);
      if (deltaPct < 0.3) dieta.deficitLevel = Math.min(0.35, dieta.deficitLevel + 0.05);
    }

    dieta.controlScore = clamp(dieta.adherenceScore - (dieta.bingeFlag ? 30 : 0));
    dieta.score = dieta.controlScore;
    dieta.plan = this.generateMealPlan();

    if (dieta.bingeFlag) {
      this.state.modules.mental.relapseCount += 1;
      this.state.core.disciplineIndex = clamp(this.state.core.disciplineIndex - 10);
    }
  }

  generateMealPlan() {
    const dieta = this.state.modules.dieta;
    return {
      meals: [
        { name: 'Refeição 1', arroz_g: 200, frango_g: 200 },
        { name: 'Refeição 2', arroz_g: 180, frango_g: 220 },
        { name: 'Refeição 3', arroz_g: 170, frango_g: 220 }
      ],
      adjustmentMargin: '±20g carbo / ±10g gordura'
    };
  }

  updateFinanceiro(data) {
    const fin = this.state.modules.financeiro;
    Object.assign(fin, data);
    fin.monthlyExpenses = fin.fixedExpenses + fin.variableExpenses;
    fin.savingsRate = fin.monthlyIncome > 0 ? (fin.monthlyIncome - fin.monthlyExpenses) / fin.monthlyIncome : 0;
    fin.disciplineScore = clamp(100 * fin.savingsRate - (fin.gamblingFlag ? 30 : 0), 0, 100);
    fin.netWorth = fin.savings + fin.investmentValue;
    fin.projection1y = fin.netWorth * 1.08;
    fin.projection3y = fin.netWorth * 1.25;
    fin.projection5y = fin.netWorth * 1.6;
    const growth = fin.growthTrend.length > 1 ? fin.growthTrend[fin.growthTrend.length - 1] - fin.growthTrend[0] : 0;
    fin.score = clamp(fin.savingsRate * 100 * 0.55 + growth * 0.15 + (fin.gamblingFlag ? 0 : 30));

    if (fin.gamblingFlag) {
      this.state.core.disciplineIndex = clamp(this.state.core.disciplineIndex - 15);
    }
  }

  updateAcademico(data) {
    const ac = this.state.modules.academico;
    Object.assign(ac, data);
    const targetHours = 20;
    const hoursFactor = clamp((ac.studyHoursWeek / targetHours) * 100);
    const masteryAvg = avg(ac.subjects.map((s) => s.masteryScore));
    const examAvg = avg(ac.subjects.map((s) => s.examPerformance));
    ac.authorityIndex = clamp((ac.performanceTrend.length >= 4 ? 15 : 0) + masteryAvg * 0.6 + examAvg * 0.4);
    ac.score = clamp(hoursFactor * 0.35 + masteryAvg * 0.35 + ac.authorityIndex * 0.3);
  }

  updateEspiritual(data) {
    const esp = this.state.modules.espiritual;
    Object.assign(esp, data);
    if (esp.relapseFlag) {
      esp.cleanDays = 0;
      this.state.modules.mental.relapseCount += 1;
      this.state.core.disciplineIndex = clamp(this.state.core.disciplineIndex - 10);
    }
    esp.moralStabilityScore = clamp(esp.dailyPrayerStreak * 1.2 + esp.cleanDays * 0.8 + esp.sacramentalFrequency * 5);
    esp.score = esp.moralStabilityScore;
  }

  updateMental(data) {
    const m = this.state.modules.mental;
    Object.assign(m, data);
    const sleepScore = data.sleepQuality ?? 70;
    m.dopamineIndex = clamp(sleepScore * 0.4 + (100 - m.relapseCount * 8) * 0.3 + (100 - m.emotionalVolatilityIndex) * 0.3);
    m.impulseResistanceScore = clamp(100 - m.relapseCount * 10 - m.emotionalVolatilityIndex * 0.2);
    m.score = clamp(m.dopamineIndex * 0.5 + m.impulseResistanceScore * 0.5);
    m.stabilityTrend.push(m.score);
  }

  updateInternet(data) {
    const i = this.state.modules.internet;
    Object.assign(i, data);
    const now = new Date();
    if (i.lastContentDate) {
      const daysSince = Math.floor((now - new Date(i.lastContentDate)) / 86400000);
      if (daysSince >= 7) {
        i.consistencyIndex = clamp(i.consistencyIndex - 20);
        i.growthRate = Math.max(0, i.growthRate - 10);
      }
    }
    i.authorityScore = clamp(i.consistencyIndex * 0.4 + i.engagementRate * 0.3 + i.growthRate * 0.3);
    i.score = i.authorityScore;
  }

  recalculateAll() {
    this.recalculateGlobalScore();
    this.recalculateDisciplineIndex();
    this.recalculateStabilityIndex();
    this.recalculateGrowthIndex();
    this.recalculateProjections();
  }

  recalculateGlobalScore() {
    const scores = MODULE_NAMES.map((name) => this.state.modules[name].score ?? 0);
    const weighted = MODULE_NAMES.reduce((sum, name) => sum + (this.state.modules[name].score ?? 0) * MODULE_WEIGHTS[name], 0);
    const under60 = scores.filter((score) => score < 60).length;
    let penalty = 1;
    if (under60 === 1) penalty = 0.85;
    else if (under60 === 2) penalty = 0.65;
    else if (under60 >= 3) penalty = 0.4;

    this.state.core.globalScore = clamp(weighted * penalty);
    this.state.core.alertState = under60 === 0 ? 'NORMAL' : under60 === 1 ? 'ALERT' : under60 === 2 ? 'RESTRICTED' : 'FAILED';
    this.state.core.scoreHistory.push(this.state.core.globalScore);
  }

  recalculateDisciplineIndex() {
    const last7 = this.state.core.scoreHistory.slice(-7);
    const avgLast7DaysScore = avg(last7);
    const { streak } = this.state.core;
    const { failedDaysCount } = this.state.discipline;
    this.state.core.disciplineIndex = clamp((streak * 0.4) + (avgLast7DaysScore * 0.4) - (failedDaysCount * 0.2));
  }

  recalculateStabilityIndex() {
    const m = this.state.modules.mental;
    const trendScore = avg(m.stabilityTrend.slice(-7));
    const volatilityPenalty = m.emotionalVolatilityIndex * 0.5;
    const relapsePenalty = m.relapseCount * 2;
    this.state.core.stabilityIndex = clamp(trendScore - volatilityPenalty - relapsePenalty);
  }

  recalculateGrowthIndex() {
    const history = this.state.core.scoreHistory;
    const current = history[history.length - 1] ?? 0;
    const sevenAgo = history[Math.max(0, history.length - 8)] ?? current;
    const growthVelocity = current - sevenAgo;
    this.state.core.growthIndex = clamp(growthVelocity * 5);
  }

  recalculateProjections() {
    const history = this.state.core.scoreHistory;
    const current = this.state.core.globalScore;
    const fourteenAgo = history[Math.max(0, history.length - 15)] ?? current;
    const growthVelocity = (current - fourteenAgo) / 14;
    const consistencyFactor = this.state.core.disciplineIndex / 100;

    this.state.projections.growthVelocity = growthVelocity;
    this.state.projections.projected90DaysScore = clamp(current + growthVelocity * 90);
    this.state.projections.projected3YearsScore = clamp(current + growthVelocity * 1095 * consistencyFactor);

    const m = this.state.modules.mental;
    const highRelapse = m.relapseCount >= 3;
    if (highRelapse || this.state.core.disciplineIndex < 60 || growthVelocity < 0) {
      this.state.projections.regressionRisk = clamp(70 + m.relapseCount * 5, 70, 100);
    } else {
      this.state.projections.regressionRisk = clamp(20 + (60 - this.state.core.disciplineIndex) * 0.3, 20, 40);
    }
  }

  dailyEvaluation() {
    const c = this.state.core;
    const d = this.state.discipline;

    if (c.alertState === 'FAILED') {
      c.streak = 0;
      d.failedDaysCount += 1;
      d.restrictionLevel += 1;
      d.lastPenaltyDate = new Date().toISOString();
      this.awardXp(-30);
    } else {
      c.streak += 1;
      this.awardXp(10);
    }

    if (d.restrictionLevel >= 3) {
      d.strictModeEnabled = true;
    }

    if (d.strictModeEnabled && this.canExitStrictMode()) {
      d.strictModeEnabled = false;
      d.restrictionLevel = Math.max(0, d.restrictionLevel - 1);
    }

    c.currentDay += 1;
    c.lastEvaluationDate = new Date().toISOString();
    this.recalculateAll();
    this.persist();
  }

  canExitStrictMode() {
    const last7 = this.state.core.scoreHistory.slice(-7);
    return last7.length === 7 && last7.every((score) => score >= 75) && this.state.modules.mental.relapseCount === 0;
  }

  strictModeView() {
    if (!this.state.discipline.strictModeEnabled) return null;
    return {
      treinoDoDia: this.state.modules.treino.dayType,
      caloriasDoDia: this.state.modules.dieta.calorieTarget,
      estudoMinimo: 2,
      oracaoMinima: 1,
      blockedModules: ['internet', 'projecoes']
    };
  }

  generateGuidedSession(restSeconds = 120) {
    const treino = this.state.modules.treino;
    return treino.exercises.map((ex) => `${ex.name} — ${ex.sets}x${ex.reps} — ${Math.round(ex.nextLoad ?? ex.load)}kg — descanso ${restSeconds}s`);
  }

  mentorGenerateDirective() {
    const s = this.state;
    if (s.core.alertState === 'FAILED') return 'Falha registrada. Modo Estrito ativado.';
    if (s.modules.treino.score < 60) return 'Execute treino do dia agora. Registre carga e reps completas.';
    if (s.modules.dieta.bingeFlag) return 'Ajuste carbo em -20g amanhã.';
    if (s.modules.mental.relapseCount > 0) return 'Risco mental elevado. Bloqueie gatilhos e execute rotina mínima.';
    if (s.core.globalScore >= 80) return 'Progresso real. Continue.';
    return 'Execute tarefas obrigatórias restantes hoje.';
  }

  exportWeeklyReport(format = 'json') {
    const payload = {
      treinoEvolution: this.state.modules.treino.performanceTrend.slice(-7),
      weightEvolution: this.state.modules.dieta.weeklyWeightTrend.slice(-7),
      disciplineEvolution: this.state.core.scoreHistory.slice(-7),
      failurePoints: this.state.logs.filter((l) => l.type === 'penalty').slice(-7),
      projection: this.state.projections
    };
    if (format === 'txt') {
      return [
        '=== ASCENSÃO OS | RELATÓRIO SEMANAL ===',
        `Treino: ${JSON.stringify(payload.treinoEvolution)}`,
        `Peso: ${JSON.stringify(payload.weightEvolution)}`,
        `Disciplina: ${JSON.stringify(payload.disciplineEvolution)}`,
        `Falhas: ${payload.failurePoints.length}`,
        `Projeção 90d: ${payload.projection.projected90DaysScore.toFixed(2)}`,
        `Projeção 3 anos: ${payload.projection.projected3YearsScore.toFixed(2)}`,
        `Regression Risk: ${payload.projection.regressionRisk.toFixed(2)}`
      ].join('\n');
    }
    return JSON.stringify(payload, null, 2);
  }

  log(message, type = 'info') {
    this.state.logs.push({ at: new Date().toISOString(), type, message });
  }
}
