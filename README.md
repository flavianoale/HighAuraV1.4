# ASCENSÃO OS

Sistema operacional de performance humana total com arquitetura modular, persistência local e motor matemático disciplinador.

## Arquitetura

- **Core Engine**: score global, XP/level, índices estruturais, streak, alertas e histórico.
- **Module Engines**: treino, dieta, financeiro, acadêmico, espiritual, mental e internet.
- **Discipline Control System**: penalidades automáticas, falha diária, progressão de restrição e modo estrito.
- **Projection Engine**: projeções de 90 dias e 3 anos, risco de regressão e velocidade de crescimento.
- **Interface Layer API**: dashboard, sessão guiada, mentor diretivo, relatório exportável, visão de modo estrito.

## Regras críticas implementadas

- `validateExecution(moduleName, executionData)` bloqueia atualização sem dados objetivos.
- Global Score com média ponderada + penalidade multiplicativa por módulos abaixo de 60.
- Estado de alerta automático: `NORMAL | ALERT | RESTRICTED | FAILED`.
- XP só sobe com execução validada.
- Dia reprovado aplica reset de streak, aumento de falhas/restrição e perda de XP.
- Modo estrito bloqueia módulo internet e limita a visão para tarefas obrigatórias.
- Anti-autoengano:
  - treino exige carga/séries/reps válidos;
  - dieta exige calorias e macros;
  - execução inválida não concede XP.

## Uso rápido

```js
import { createAscensaoOS } from './src/index.js';

const os = createAscensaoOS();
os.validateExecution('treino', {
  dayType: 'PUSH',
  exercises: [
    { name: 'Supino', sets: 4, reps: 6, load: 82, rpe: 8, hitAllReps: true, restSeconds: 120 }
  ],
  completion: 100
});

console.log(os.generateGuidedSession());
console.log(os.dashboard());
```

## Persistência

- Interface pronta para `localStorage` no navegador.
- Fallback em `MemoryStorage` para execução em ambiente sem browser.
