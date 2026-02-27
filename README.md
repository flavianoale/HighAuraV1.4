# ASCENSÃO OS

Sistema operacional de performance humana total com arquitetura modular, cálculo disciplinador e projeções orientadas por execução validada.

## Camadas
- **Core Engine**: consolidação de scores, XP/Level, disciplina, estabilidade e crescimento.
- **Module Engines**: Treino, Dieta, Financeiro, Acadêmico, Espiritual, Mental e Internet.
- **Discipline Control System**: penalidades automáticas, reprovação de dia, restrições e Modo Estrito.
- **Projection Engine**: projeção 90 dias, 3 anos, regressão e velocidade de crescimento.
- **Interface Layer**: API para dashboard, mentor directives, treino guiado e relatório exportável.

## Premissas implementadas
- Validação obrigatória por módulo (`validateExecution`) antes de conceder XP.
- Persistência local via interface de storage compatível com `localStorage`.
- Score global com penalidade multiplicativa para inconsistência entre módulos.
- Modo estrito com visão reduzida e bloqueio de módulos não essenciais.
- Relatório semanal exportável (`json`/`txt`).

## Uso básico
```js
import { AscensaoOS } from './src/ascensao-os.js';

const app = new AscensaoOS(localStorage);

app.validateExecution('treino', {
  dayType: 'PUSH',
  exercises: [{ name: 'Supino', sets: 4, reps: 6, load: 82, rpe: 8, hitAllReps: true }]
});

console.log(app.state.core.globalScore);
console.log(app.mentorGenerateDirective());
```

## Testes
```bash
npm test
```
