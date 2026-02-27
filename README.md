# ASCENSÃO OS

Implementação inicial do **ASCENSÃO OS** como motor modular de performance humana total.

## Entregue nesta versão

- Arquitetura em 5 camadas refletida no código (`Core`, `Module Engines`, `Discipline`, `Projection`, `Interface helpers`).
- Modelo de dados completo baseado em `AppState` persistível localmente.
- Core matemático com:
  - Global Score ponderado + multiplicadores de penalidade.
  - XP e Level por execução validada.
  - Discipline/Stability/Growth Index.
  - Reprovação diária e penalidade progressiva.
- Módulos com validação anti-autoengano (`validateExecution`):
  - Treino, Dieta, Financeiro, Acadêmico, Espiritual, Mental, Internet.
- Projection Engine com projeções 90 dias / 3 anos e risco de regressão.
- Discipline Control System com níveis de restrição e Modo Estrito.
- Mentor Engine com diretivas objetivas (sem motivação vazia).
- Relatório semanal exportável em objeto JSON.

## Execução de teste rápido

```bash
node test/run-tests.js
```

