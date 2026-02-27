import { createInitialState } from './state.js';
import { LocalPersistence, MemoryStorage } from './persistence.js';
import { AscensaoEngine } from './engine.js';

export function createAscensaoOS({ initialState, storage } = {}) {
  const persistence = new LocalPersistence(storage ?? new MemoryStorage());
  const state = createInitialState(initialState ?? persistence.load() ?? {});
  const engine = new AscensaoEngine(state, persistence);

  return {
    state,
    validateExecution: engine.validateExecution.bind(engine),
    dailyEvaluation: engine.dailyEvaluation.bind(engine),
    generateGuidedSession: engine.generateGuidedSession.bind(engine),
    mentorDirective: engine.mentorDirective.bind(engine),
    strictModeView: engine.strictModeView.bind(engine),
    dashboard: engine.dashboard.bind(engine),
    exportWeeklyReport: engine.exportWeeklyReport.bind(engine)
  };
}
