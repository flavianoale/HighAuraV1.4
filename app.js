const STORAGE_KEY = 'ascensao-os-v1';

const clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, n));
const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
const todayISO = () => new Date().toISOString().slice(0, 10);

function defaultState() {
  const weeklyTemplate = [
    { name: 'Supino com barra', sets: 4, reps: 6, load: 80, rpe: 8, history: [] },
    { name: 'Desenvolvimento halteres', sets: 4, reps: 8, load: 28, rpe: 8, history: [] },
    { name: 'Elevação lateral', sets: 3, reps: 12, load: 10, rpe: 8, history: [] },
    { name: 'Tríceps mergulho', sets: 3, reps: 10, load: 0, rpe: 8, history: [] },
    { name: 'Flexão até falha', sets: 2, reps: 15, load: 0, rpe: 9, history: [] },
  ];

  return {
    core: {
      currentDay: 1,
      totalDays: 90,
      xp: 0,
      level: 1,
      globalScore: 50,
      disciplineIndex: 50,
      stabilityIndex: 50,
      growthIndex: 0,
      streak: 0,
      alertState: 'NORMAL',
      lastEvaluationDate: todayISO(),
      history: [50],
    },
    modules: {
      treino: {
        currentCycle: 1,
        week: 1,
        dayType: 'PUSH',
        exercises: weeklyTemplate,
        weeklyVolume: 0,
        fatigueIndex: 0,
        strengthIndex: 0,
        longTermStrengthGoal: '200kg squat',
        performanceTrend: [50],
        score: 50,
        daysConsecutive: 0,
      },
      dieta: {
        weight: 86,
        bodyFatEstimate: 22,
        calorieTarget: 0,
        proteinTarget: 0,
        carbTarget: 0,
        fatTarget: 0,
        deficitLevel: 0.2,
        adherenceScore: 50,
        bingeFlag: false,
        weeklyWeightTrend: [86],
        controlScore: 50,
        score: 50,
        age: 25,
        height: 171,
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
        score: 50,
      },
      academico: {
        studyHoursWeek: 0,
        studyHoursTotal: 0,
        subjects: [{ name: 'Matemática', masteryScore: 50, revisionCycle: 0, examPerformance: 0 }],
        authorityIndex: 30,
        performanceTrend: [50],
        score: 50,
      },
      espiritual: {
        cleanDays: 0,
        sacramentalFrequency: 0,
        moralStabilityScore: 50,
        dailyPrayerStreak: 0,
        confessionLog: [],
        relapseFlag: false,
        score: 50,
      },
      mental: {
        relapseCount: 0,
        triggerPatterns: [],
        stabilityTrend: [50],
        dopamineIndex: 50,
        impulseResistanceScore: 50,
        emotionalVolatilityIndex: 40,
        score: 50,
      },
      internet: {
        contentProducedWeek: 0,
        engagementScore: 0,
        growthRate: 0,
        authorityScore: 0,
        consistencyIndex: 40,
        score: 40,
      },
    },
    projections: {
      projected90DaysScore: 50,
      projected3YearsScore: 50,
      regressionRisk: 30,
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
  constructor() {
    this.state = this.load();
    this.recalculateDietaTargets();
    this.recalculateAll();
  }

  load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    try {
      return { ...defaultState(), ...JSON.parse(raw) };
    } catch {
      return defaultState();
    }
  }

  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  }

  recalculateAll() {
    this.computeModuleScores();
    this.recalculateCore();
    this.recalculateProjection();
    this.applyDisciplineSystem();
    this.save();
  }

  log(type, payload = {}) {
    this.state.logs.push({ type, payload, date: new Date().toISOString() });
    if (this.state.logs.length > 1000) this.state.logs.shift();
  }

  validateExecution(moduleName, executionData) {
    if (!executionData || typeof executionData !== 'object') return false;
    const invalid = {
      treino: () => !executionData.load || !executionData.reps,
      dieta: () => !executionData.calories || !executionData.protein,
      academico: () => !executionData.hours,
      espiritual: () => !executionData.prayer,
      financeiro: () => !executionData.income,
      mental: () => executionData.relapse === undefined,
      internet: () => !executionData.contentCount,
    };

    if (invalid[moduleName]?.()) {
      this.log('execution_invalid', { moduleName, executionData });
      return false;
    }

    this.applyExecution(moduleName, executionData);
    this.state.core.xp += 20;
    this.state.core.level = 1 + Math.floor(Math.sqrt(this.state.core.xp / 50));
    this.recalculateAll();
    this.log('execution_validated', { moduleName, executionData });
    return true;
  }

  applyExecution(moduleName, data) {
    const m = this.state.modules;
    if (moduleName === 'treino') {
      const current = m.treino.exercises[0];
      current.history.push({ date: todayISO(), load: data.load, reps: data.reps });
      current.rpe = data.rpe ?? current.rpe;
      const success = data.reps >= current.reps && current.rpe <= 8;
      current.failCount = success ? 0 : (current.failCount || 0) + 1;
      if (success) current.load = +(current.load * 1.025).toFixed(2);
      if (!success && current.failCount > 1) current.load = +(current.load * 0.975).toFixed(2);
      m.treino.weeklyVolume += data.load * data.reps * current.sets;
      m.treino.daysConsecutive += 1;
      const oneRM = data.load * (1 + data.reps / 30);
      m.treino.strengthIndex = clamp(oneRM / 2);
      m.treino.performanceTrend.push(clamp(m.treino.strengthIndex));
    }

    if (moduleName === 'dieta') {
      const adherence = data.calories <= m.dieta.calorieTarget ? 100 : 100 - (data.calories - m.dieta.calorieTarget) / 50;
      m.dieta.adherenceScore = clamp(adherence);
      m.dieta.controlScore = clamp((m.dieta.adherenceScore + (data.protein >= m.dieta.proteinTarget ? 100 : 60)) / 2);
      m.dieta.bingeFlag = Boolean(data.bingeFlag);
      if (m.dieta.bingeFlag) {
        m.mental.relapseCount += 1;
        this.state.core.disciplineIndex = clamp(this.state.core.disciplineIndex - 8);
      }
      if (data.weight) m.dieta.weeklyWeightTrend.push(data.weight);
      this.adjustDietDeficit();
    }

    if (moduleName === 'academico') {
      m.academico.studyHoursWeek += data.hours;
      m.academico.studyHoursTotal += data.hours;
      const subject = m.academico.subjects[0];
      subject.examPerformance = data.examScore ?? subject.examPerformance;
      subject.masteryScore = clamp((subject.masteryScore + data.hours * 2 + subject.examPerformance * 3) / 2);
      m.academico.authorityIndex = clamp(m.academico.authorityIndex + (data.hours >= 2 ? 2 : 0));
    }

    if (moduleName === 'espiritual') {
      if (data.relapseFlag) {
        m.espiritual.cleanDays = 0;
        m.mental.relapseCount += 1;
        this.state.core.disciplineIndex = clamp(this.state.core.disciplineIndex - 10);
      } else {
        m.espiritual.cleanDays += 1;
        m.espiritual.dailyPrayerStreak += 1;
      }
      m.espiritual.sacramentalFrequency += data.sacrament ? 1 : 0;
    }
  }

  computeModuleScores() {
    const m = this.state.modules;
    m.treino.fatigueIndex = clamp((m.treino.weeklyVolume / 5000) * 35 + avg(m.treino.exercises.map((e) => e.rpe)) * 6 + m.treino.daysConsecutive * 4);
    m.treino.score = clamp(45 + m.treino.strengthIndex * 0.4 - Math.max(0, m.treino.fatigueIndex - 80) * 0.5);

    m.dieta.score = clamp(m.dieta.controlScore - (m.dieta.bingeFlag ? 20 : 0));

    const income = m.financeiro.monthlyIncome;
    const expenses = m.financeiro.monthlyExpenses;
    m.financeiro.savingsRate = income > 0 ? (income - expenses) / income : 0;
    const net = m.financeiro.investmentValue + Math.max(income - expenses, 0);
    m.financeiro.projection1y = net * 1.08;
    m.financeiro.projection3y = net * 1.25;
    m.financeiro.projection5y = net * 1.6;
    m.financeiro.disciplineScore = clamp(50 + m.financeiro.savingsRate * 100 - (m.financeiro.gamblingFlag ? 30 : 0));
    m.financeiro.score = m.financeiro.disciplineScore;

    const subjAvg = avg(m.academico.subjects.map((s) => s.masteryScore));
    m.academico.score = clamp(subjAvg * 0.7 + Math.min(m.academico.studyHoursWeek, 20) * 1.2 + m.academico.authorityIndex * 0.2);

    m.espiritual.moralStabilityScore = clamp(m.espiritual.dailyPrayerStreak * 1.2 + m.espiritual.cleanDays * 0.8);
    m.espiritual.score = clamp(m.espiritual.moralStabilityScore);

    m.mental.dopamineIndex = clamp(65 - m.mental.relapseCount * 8 - m.mental.emotionalVolatilityIndex * 0.3 + m.mental.impulseResistanceScore * 0.4);
    m.mental.score = m.mental.dopamineIndex;
    m.mental.stabilityTrend.push(m.mental.score);

    if (m.internet.contentProducedWeek === 0) {
      m.internet.consistencyIndex = clamp(m.internet.consistencyIndex - 20);
      m.internet.growthRate = clamp(m.internet.growthRate - 10);
    }
    m.internet.score = clamp(m.internet.consistencyIndex * 0.5 + m.internet.authorityScore * 0.3 + m.internet.engagementScore * 0.2);
  }

  recalculateCore() {
    const scores = Object.values(this.state.modules).map((mod) => mod.score || 0);
    const baseScore = avg(scores);
    const under60 = scores.filter((s) => s < 60).length;
    const penalty = under60 >= 3 ? 0.4 : under60 === 2 ? 0.65 : under60 === 1 ? 0.85 : 1;
    this.state.core.globalScore = clamp(baseScore * penalty);
    this.state.core.alertState = under60 >= 3 ? 'FAILED' : under60 === 2 ? 'RESTRICTED' : under60 === 1 ? 'ALERT' : 'NORMAL';

    const last7 = this.state.core.history.slice(-7);
    this.state.core.disciplineIndex = clamp(this.state.core.streak * 0.4 + avg(last7) * 0.4 - this.state.discipline.failedDaysCount * 0.2);

    const m = this.state.modules.mental;
    this.state.core.stabilityIndex = clamp(avg(m.stabilityTrend.slice(-14)) - m.emotionalVolatilityIndex * 0.6 - m.relapseCount * 3);

    const score7daysAgo = this.state.core.history[this.state.core.history.length - 7] ?? this.state.core.globalScore;
    const growthVelocity = this.state.core.globalScore - score7daysAgo;
    this.state.core.growthIndex = clamp(growthVelocity * 5);
    this.state.core.history.push(this.state.core.globalScore);
  }

  recalculateProjection() {
    const history = this.state.core.history;
    const current = this.state.core.globalScore;
    const score14Ago = history[history.length - 14] ?? current;
    const velocity = (current - score14Ago) / 14;
    const consistencyFactor = this.state.core.disciplineIndex / 100;
    this.state.projections.growthVelocity = velocity;
    this.state.projections.projected90DaysScore = clamp(current + velocity * 90);
    this.state.projections.projected3YearsScore = clamp(current + velocity * 1095 * consistencyFactor);

    const highRisk =
      this.state.modules.mental.relapseCount >= 3 ||
      this.state.core.disciplineIndex < 60 ||
      velocity < 0;
    this.state.projections.regressionRisk = highRisk ? clamp(70 + Math.abs(velocity) * 20) : 30;
  }

  applyDisciplineSystem() {
    if (this.state.core.alertState === 'FAILED') {
      this.state.core.streak = 0;
      this.state.discipline.failedDaysCount += 1;
      this.state.discipline.restrictionLevel += 1;
      this.state.core.xp = Math.max(0, this.state.core.xp - 30);
      this.state.discipline.lastPenaltyDate = todayISO();
    }

    if (this.state.discipline.restrictionLevel >= 3) {
      this.state.discipline.strictModeEnabled = true;
    }

    if (this.state.discipline.strictModeEnabled) {
      this.state.modules.internet.score = 0;
    }
  }

  adjustDietDeficit() {
    const trend = this.state.modules.dieta.weeklyWeightTrend;
    if (trend.length < 2) return;
    const prev = trend[trend.length - 2];
    const curr = trend[trend.length - 1];
    const pct = ((prev - curr) / prev) * 100;
    if (pct > 1) this.state.modules.dieta.deficitLevel = Math.max(0.1, this.state.modules.dieta.deficitLevel - 0.05);
    if (pct < 0.3) this.state.modules.dieta.deficitLevel = Math.min(0.35, this.state.modules.dieta.deficitLevel + 0.05);
    this.recalculateDietaTargets();
  }

  recalculateDietaTargets() {
    const d = this.state.modules.dieta;
    const bmr = 10 * d.weight + 6.25 * d.height - 5 * d.age + 5;
    const tdee = bmr * 1.55;
    d.calorieTarget = Math.round(tdee * (1 - d.deficitLevel));
    d.proteinTarget = Math.round(d.weight * 2.2);
    d.fatTarget = Math.round(d.weight * 0.8);
    const pKcal = d.proteinTarget * 4;
    const fKcal = d.fatTarget * 9;
    d.carbTarget = Math.round((d.calorieTarget - pKcal - fKcal) / 4);
  }

  generateGuidedSession() {
    const t = this.state.modules.treino;
    const first = t.exercises[0];
    const rest = t.dayType === 'LEGS' ? 150 : 120;
    return `${first.name} — ${first.sets}x${first.reps} — ${first.load}kg — descanso ${rest}s\nMeta longa: ${t.longTermStrengthGoal}\nStrength Index: ${t.strengthIndex.toFixed(1)}\nFatigue Index: ${t.fatigueIndex.toFixed(1)}${t.fatigueIndex > 80 ? ' (Deload sugerido)' : ''}`;
  }

  mentorDirective() {
    const c = this.state.core;
    const m = this.state.modules;
    if (m.treino.score < 60) return 'Execute PUSH agora. Registre carga e reps completas.';
    if (m.dieta.adherenceScore < 70) return 'Ajuste carbo em -20g amanhã e mantenha proteína alvo.';
    if (m.mental.relapseCount > 0) return 'Falha registrada. Modo Estrito ativado.';
    if (c.disciplineIndex > 75) return 'Progresso real. Continue.';
    return 'Execute tarefas obrigatórias: treino, dieta, estudo e oração mínima.';
  }

  dailyEvaluation() {
    this.recalculateAll();
    const ok = this.state.core.globalScore >= 75 && this.state.modules.mental.relapseCount === 0;
    this.state.core.streak = ok ? this.state.core.streak + 1 : 0;

    if (this.state.discipline.strictModeEnabled && this.state.core.streak >= 7 && this.state.core.globalScore >= 75) {
      this.state.discipline.strictModeEnabled = false;
      this.state.discipline.restrictionLevel = Math.max(0, this.state.discipline.restrictionLevel - 1);
    }
    this.state.core.currentDay += 1;
    this.state.core.lastEvaluationDate = todayISO();
    this.log('daily_evaluation', { day: this.state.core.currentDay });
    this.save();
  }

  weeklyReport(format = 'txt') {
    const m = this.state.modules;
    const report = {
      treinoEvolucao: m.treino.performanceTrend.slice(-7),
      pesoEvolucao: m.dieta.weeklyWeightTrend.slice(-7),
      disciplina: this.state.core.disciplineIndex,
      falhas: this.state.discipline.failedDaysCount,
      projecao: this.state.projections,
    };

    if (format === 'json') return JSON.stringify(report, null, 2);

    return [
      'RELATÓRIO SEMANAL - ASCENSÃO OS',
      `Treino: ${report.treinoEvolucao.join(', ')}`,
      `Peso: ${report.pesoEvolucao.join(', ')}`,
      `Disciplina: ${report.disciplina.toFixed(1)}`,
      `Falhas: ${report.falhas}`,
      `Projeção 90d: ${report.projecao.projected90DaysScore.toFixed(1)}`,
      `Risco regressão: ${report.projecao.regressionRisk.toFixed(1)}%`,
    ].join('\n');
  }
}

const os = new AscensaoOS();

function download(name, content, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function render() {
  const { core, modules, projections, discipline } = os.state;
  document.getElementById('globalScore').textContent = core.globalScore.toFixed(1);
  document.getElementById('level').textContent = core.level;
  document.getElementById('streak').textContent = core.streak;
  document.getElementById('disciplineIndex').textContent = core.disciplineIndex.toFixed(1);
  document.getElementById('stabilityIndex').textContent = core.stabilityIndex.toFixed(1);
  document.getElementById('growthIndex').textContent = core.growthIndex.toFixed(1);
  document.getElementById('alertState').textContent = `${core.alertState}${discipline.strictModeEnabled ? ' | STRICT MODE' : ''}`;

  const risk = document.getElementById('risk');
  risk.textContent = `Risco de regressão: ${projections.regressionRisk.toFixed(1)}%`;
  risk.className = projections.regressionRisk > 60 ? 'alert' : 'muted';

  const radar = document.getElementById('radar');
  radar.innerHTML = '';
  Object.entries(modules).forEach(([name, module]) => {
    const val = (module.score || 0).toFixed(1);
    const row = document.createElement('div');
    row.className = 'radar-row';
    row.innerHTML = `<span>${name}</span><div class="bar"><div class="fill" style="width:${val}%"></div></div><strong>${val}</strong>`;
    radar.appendChild(row);
  });

  document.getElementById('mentor').textContent = os.mentorDirective();
  document.getElementById('guided').textContent = os.generateGuidedSession();
  document.getElementById('dietGuide').textContent = `Meta calórica: ${modules.dieta.calorieTarget} kcal\nProteína: ${modules.dieta.proteinTarget}g\nCarbo: ${modules.dieta.carbTarget}g\nGordura: ${modules.dieta.fatTarget}g`;
}

function demoAction(action) {
  const handlers = {
    treino: () => os.validateExecution('treino', { load: 82, reps: 6, rpe: 8 }),
    dieta: () => os.validateExecution('dieta', { calories: os.state.modules.dieta.calorieTarget - 80, protein: os.state.modules.dieta.proteinTarget, bingeFlag: false, weight: 85.6 }),
    academico: () => os.validateExecution('academico', { hours: 2, examScore: 8.5 }),
    espiritual: () => os.validateExecution('espiritual', { prayer: true, relapseFlag: false, sacrament: false }),
    daily: () => os.dailyEvaluation(),
  };
  handlers[action]?.();
  render();
}

document.querySelectorAll('button[data-action]').forEach((btn) => {
  btn.addEventListener('click', () => demoAction(btn.dataset.action));
});

document.getElementById('exportTxt').addEventListener('click', () => {
  download('ascensao-report.txt', os.weeklyReport('txt'));
});

document.getElementById('exportJson').addEventListener('click', () => {
  download('ascensao-report.json', os.weeklyReport('json'), 'application/json');
});

render();
