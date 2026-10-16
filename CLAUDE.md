# Market Pro - instrucciones para Claude

## Auto-commit
- Al terminar cada cambio pedido por el usuario, haz **commit automáticamente** sin preguntar.
- Commit en la rama actual. **Nunca hagas push** salvo que el usuario lo pida.
- Mensaje en español con formato Conventional Commits:
  - Título: `tipo(alcance): resumen corto` (tipos: feat, fix, refactor, docs, chore, style, test).
  - Cuerpo: lista de los cambios relevantes (qué se hizo y por qué).
- Agrega solo archivos relacionados al cambio. Nunca commitees `.env`, credenciales, `node_modules` ni `dist`.
- Si un hook de commit falla, corrige la causa; no uses `--no-verify`.
