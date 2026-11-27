# Changelog

Todos los cambios relevantes de este proyecto se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa [Versionado Semántico](https://semver.org/lang/es/): **MAYOR** cuando cambia algo que obliga a actualizar la hoja, el formulario o la instalación; **MENOR** cuando se agrega una función compatible; **PARCHE** para correcciones.

## [Unreleased]

## [3.1.0] - 2026-11-27

Mejoras de herramientas y de repositorio; no cambia lo que hace el programa ni exige migrar.

### Added

- **Chequeo de tipos** con TypeScript sobre el código JavaScript (`tsconfig.json`, JSDoc y `@types/google-apps-script`): `npm run typecheck`. Detecta llamadas a métodos que la API de Apps Script no tiene.
- **Tipos del proyecto** en `types/`: forma de los datos (`models.d.ts`), métodos que existen en Apps Script pero faltan en `@types` (`apps-script-extras.d.ts`) y la librería del stub (`library.d.ts`).
- **`package.json`** con scripts (`check`, `typecheck`, `test`, `push`) y `package-lock.json`.
- **CI en GitHub Actions** (`.github/workflows/ci.yml`): tipos y pruebas en cada `push` y pull request.
- **Dependabot** para dependencias de npm y acciones de GitHub, `CODEOWNERS` y `SECURITY.md`.
- `.gitignore` (incluye `.clasprc.json`), `.gitattributes` (saltos de línea LF) y `.editorconfig`.

### Changed

- Los archivos de código pasan de `.gs` a `.js` (`Code.js`, `Emails.js`, `Stats.js`, `stub/Code.js`) para que editores, GitHub y TypeScript los reconozcan. clasp los sigue subiendo como archivos `.gs`; en el editor de Apps Script los nombres no cambian.
- `.claspignore` ahora sube `*.js` de la raíz y `appsscript.json`.
- `detectPeriod` comprueba las fechas con `getTime()` en lugar de pasar un `Date` a `isNaN`.

## [3.0.0] - 2026-11-27

Refactorización mayor: nuevo formato de informe, nueva estructura del código y nueva forma de instalarlo. Es una versión **MAYOR** porque exige actualizar la instalación existente (ver *Cómo migrar*).

### Cómo migrar desde 2.0.0

1. **Formulario:** la hoja de respuestas debe tener el curso y el profesor en **una sola celda** (columna C, `Curso — Profesor`). Antes eran dos columnas. Revisa el mapa de columnas en el [README](README.md#formato-de-la-hoja-de-respuestas).
2. **Archivos:** además de `Code.gs` y `Emails.gs`, ahora se necesita `Stats.gs` y el manifiesto `appsscript.json` (activa el servicio avanzado de Drive).
3. **Menú:** `onOpen` vive en `Code.gs` (si lo pegas directo) o en `stub/Code.gs` (si usas la librería). Con el stub, actualízalo para ver los ítems nuevos.
4. **Correos en copia:** `AUTHORITIES_CC` ya no está en el código. Se lee de la hoja `Configuración` (se crea con **Crear Plantilla Directorio**).
5. **Período:** ya no está escrito en el código; se detecta solo (ver abajo).

### Added

- **Informe rediseñado** con la paleta del Centenario PUCV y tipografía Roboto: franja de colores de la grilla, ficha del curso, resumen, análisis comparativo, tabla de detalle por bloque del formulario, retroalimentación cualitativa, nota metodológica y firma de la Coordinación.
- **Tabla de resultados** con media del curso, media del semestre, diferencia, % de acuerdo, distribución de respuestas (1 a 5) y nivel (*Sobre la media*, *En la media*, *Bajo la media*, *Requiere atención*).
- **Aviso de pocas respuestas:** con menos de 5 respuestas (`MIN_RESPONSES`) el resumen indica que los resultados son solo indicativos.
- **Comentarios sobre la asignatura** (antes solo se usaba el comentario al profesor), con descarte de respuestas de relleno ("no", "n/a", "nada").
- **Período automático** (`1er Semestre 2026`) detectado desde el nombre del archivo o las fechas de respuesta; se puede forzar con `PERIOD_LABEL`.
- **Preguntas que no aplican** (`NOT_APPLICABLE`): "usa el español durante toda la clase" se excluye en los cursos dictados en inglés, tanto del curso como del semestre.
- **Menú «Resumen Comparativo»:** hoja `Resumen_Comparativo` con una fila por curso y profesor, ordenada por prioridad (Alta, Media, Baja), con mapa de calor de las 19 dimensiones.
- **Menú «Exportar Informes a PDF»:** convierte los informes a PDF desde Google Docs, en una subcarpeta `PDF`; reanudable y con enlace en `Registro_Reportes`.
- **Librería + stub** (`stub/`): el mismo código sirve en cualquier hoja, sin copiar archivos.
- **Despliegue con clasp** (`.clasp.json`, `.claspignore`) y documentación (`README.md`, este archivo).
- **Pruebas** de la lógica pura (`Stats.gs`) con `node test/run.js`, sin dependencias.

### Changed

- **Separador `Curso — Profesor`** tolerante: acepta raya larga, raya media o guion con espacios.
- **Clasificación de niveles** con banda de ±0,2 respecto del semestre y umbral de atención de 4,0; antes "sobre media" incluía diferencias nulas (4,0 contra 4,0).
- **Correos a cursos con varios profesores:** se resuelve cada profesor en `Directorio` y se envía un solo correo a todos.
- **Asunto y cuerpo del correo** usan el período detectado, no un texto fijo.
- **Generación reanudable:** no vuelve a generar cursos que ya están en `Registro_Reportes`, y se detiene antes del límite de 6 minutos de Apps Script avisando cuántos faltan.
- **Resultado de la generación** informa todos los errores, no solo los cinco primeros.
- Cálculo de estadísticas simplificado: se eliminaron valores que no se usaban (mediana, desviación estándar) y la media semestral por defecto inventada.

### Fixed

- Informes duplicados y correos repetidos al ejecutar «Generar Reportes» más de una vez.
- Documentos vacíos que quedaban en Drive cuando un informe fallaba a mitad de camino.
- Informe registrado como correcto aunque fallara su registro en `Registro_Reportes`, lo que dejaba profesores sin correo.
- Un mismo estudiante respondiendo dos veces contaba doble: queda solo su última respuesta por curso.
- Mensaje engañoso «todos los cursos ya tienen un reporte» cuando en realidad no se leía ninguna respuesta; ahora muestra qué hay en la columna del curso.
- Texto del período fijo («2º Semestre 2025») en el correo.

### Removed

- Lista fija de autoridades en copia dentro del código (`AUTHORITIES_CC` en `EMAIL_CONFIG`).
- Dos columnas separadas de curso y profesor (`COL_COURSE`, `COL_PROFESSOR`).
- Texto de apreciación general con calificativos globales («BUENO», «EXCELENTE»), reemplazado por un resumen con cifras.

### Security

- La lista de autoridades en copia salió del código y de los commits nuevos. **El historial anterior de Git sigue conteniendo esos correos** (el repositorio es público).

## [2.0.0] - 2025-12-16

Versión «Modular & Themed» y módulo de correos. Incluye los commits del 15 y 16 de diciembre de 2025.

### Added

- Generación de informes de evaluación docente en Google Docs desde la hoja de respuestas, con tema visual centralizado (`THEME`).
- Estadísticas descriptivas (media, mediana, desviación estándar, % de acuerdo) y respuestas bilingües (español/inglés).
- Umbral crítico de 4,0 en la evaluación.
- Envío masivo de informes por correo, permisos de lector sobre cada Doc y hojas `Registro_Reportes` y `Directorio`.
- Bloqueo (`LockService`) para evitar ejecuciones simultáneas de la generación y del envío.

### Removed

- Archivo de correo de ejemplo (`CorreoEjemplo`).

[Unreleased]: https://github.com/Luccat1/Evaluador-informes/compare/v3.1.0...HEAD
[3.1.0]: https://github.com/Luccat1/Evaluador-informes/compare/v3.0.0...v3.1.0
[3.0.0]: https://github.com/Luccat1/Evaluador-informes/compare/069c38b...v3.0.0
[2.0.0]: https://github.com/Luccat1/Evaluador-informes/commits/069c38b
