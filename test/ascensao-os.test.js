import test from 'node:test';
import assert from 'node:assert/strict';
import { AscensaoOS, createInitialState } from '../src/ascensao-os.js';

test('validateExecution blocks invalid treino payload', () => {
  const app = new AscensaoOS(null, createInitialState());
  const ok = app.validateExecution('treino', { exercises: [{ load: 0, reps: 8 }] });
  assert.equal(ok, false);
  assert.equal(app.state.core.xp, 0);
});

test('global score applies severe penalty when >=3 modules under 60', () => {
  const app = new AscensaoOS();
  app.state.modules.treino.score = 90;
  app.state.modules.dieta.score = 90;
  app.state.modules.financeiro.score = 40;
  app.state.modules.academico.score = 50;
  app.state.modules.espiritual.score = 50;
  app.state.modules.mental.score = 90;
  app.state.modules.internet.score = 90;
  app.recalculateGlobalScore();
  assert.equal(app.state.core.alertState, 'FAILED');
  assert.ok(app.state.core.globalScore < 35);
});

test('guided session emits direct commands', () => {
  const app = new AscensaoOS();
  app.validateExecution('treino', {
    dayType: 'PUSH',
    exercises: [
      { name: 'Supino', sets: 4, reps: 6, load: 80, rpe: 8, hitAllReps: true }
    ]
  });
  const lines = app.generateGuidedSession();
  assert.match(lines[0], /Supino/);
  assert.match(lines[0], /descanso 120s/);
});

test('daily evaluation enforces strict mode on repeated failures', () => {
  const app = new AscensaoOS();
  app.state.core.alertState = 'FAILED';
  app.dailyEvaluation();
  app.state.core.alertState = 'FAILED';
  app.dailyEvaluation();
  app.state.core.alertState = 'FAILED';
  app.dailyEvaluation();
  assert.equal(app.state.discipline.strictModeEnabled, true);
  assert.equal(app.state.discipline.restrictionLevel, 3);
});
