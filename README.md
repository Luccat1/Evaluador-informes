# Evaluador de informes docentes (CELE PUCV)

> Genera, compara y envía los informes de evaluación docente a partir de las respuestas de un Google Form, todo dentro de Google Sheets (Apps Script).

Cada semestre, el CELE recoge la opinión estudiantil con un formulario. Este proyecto convierte esas respuestas en:

- un **informe en Google Doc / PDF** por curso y profesor, con métricas cuantitativas y retroalimentación cualitativa;
- una **hoja comparativa** que ordena los cursos por prioridad de atención;
- el **envío por correo** de cada informe, con permisos de lectura.

Versión actual: **3.1.0** (ver [CHANGELOG](CHANGELOG.md), que sigue [Versionado Semántico](https://semver.org/lang/es/)).

## Contenido

- [Seguridad y confidencialidad](#seguridad-y-confidencialidad)
- [Cómo funciona](#cómo-funciona)
- [Requisitos](#requisitos)
- [Instalación](#instalación)
- [Uso](#uso)
- [Configuración](#configuración)
- [Formato de la hoja de respuestas](#formato-de-la-hoja-de-respuestas)
- [Solución de problemas](#solución-de-problemas)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Desarrollo y pruebas](#desarrollo-y-pruebas)
- [Mantenimiento y contribuciones](#mantenimiento-y-contribuciones)
- [Licencia](#licencia)

## Seguridad y confidencialidad

- Los informes contienen evaluaciones de personas y comentarios de estudiantes. **No subas respuestas reales, correos ni informes a este repositorio, que es público.**
- Los correos en copia (autoridades) **no van en el código**: se guardan en la hoja `Configuración` de cada planilla.
- Cada informe se comparte solo como *lector* con el profesor y las personas en copia. Antes de agregar a alguien externo a la PUCV en copia, confirma que corresponde: recibirá todos los informes, comentarios incluidos.
- Para reportar un problema de seguridad, ver [SECURITY.md](SECURITY.md).
- Los comentarios se reproducen textualmente. En cursos con pocas respuestas pueden identificar a quien los escribió; considera esto antes de compartir el PDF.
- El historial de Git anterior a la versión 3.0.0 contiene direcciones de correo de autoridades (ver [CHANGELOG](CHANGELOG.md#300---2026-11-27)).

## Cómo funciona

1. Lee la hoja de respuestas, agrupa por curso y profesor y calcula media, % de acuerdo y distribución por pregunta.
2. Compara cada curso con la media del semestre y clasifica cada dimensión (*Sobre la media*, *En la media*, *Bajo la media*, *Requiere atención* si baja de 4,0).
3. Crea un Google Doc por curso con la paleta y la tipografía del Centenario PUCV, y lo registra en `Registro_Reportes`.
4. Opcionalmente exporta a PDF, arma el resumen comparativo y envía los correos.

Con menos de 5 respuestas (`MIN_RESPONSES`) los resultados se marcan como solo indicativos.

## Requisitos

- Una cuenta de Google con acceso a la planilla de respuestas y a Drive/Gmail.
- Para desarrollar: [Node.js](https://nodejs.org/) (solo para las pruebas) y [clasp](https://github.com/google/clasp) con la Apps Script API activada en <https://script.google.com/home/usersettings>.
- Para enviar con el alias institucional, que ese alias esté configurado en el Gmail de quien ejecuta (`SENDER_EMAIL`).

## Instalación

Hay dos formas. Ambas necesitan los tres archivos de código y el manifiesto `appsscript.json`.

### A. Pegar el código en la hoja

1. En la planilla de respuestas: Extensiones > Apps Script.
2. Crea `Code.gs`, `Emails.gs` y `Stats.gs` en el editor y pega el contenido de `Code.js`, `Emails.js` y `Stats.js` respectivamente (en el repositorio se llaman `.js` para que los editores y TypeScript los entiendan; clasp los sube como `.gs`).
3. En Configuración del proyecto activa «Mostrar archivo "appsscript.json"» y pega el manifiesto del repositorio (activa el servicio avanzado de Drive).
4. Recarga la planilla y acepta los permisos. Aparece el menú **Evaluación Docente**.

### B. Librería + stub (un solo código para varias hojas)

El código de la raíz se publica como **librería** de Apps Script y cada hoja lleva un stub mínimo que crea el menú y la llama (`stub/`).

1. Sube la librería: `npm run push` (equivale a `clasp push -f`; el `scriptId` está en `.clasp.json`).
2. En cada hoja: Extensiones > Apps Script, pega `stub/Code.js` y copia `stub/appsscript.json`, que enlaza la librería como `EvaluadorLib`.
3. El stub usa `developmentMode: true` (siempre ejecuta el último `push`), válido solo para editores de la librería. Para otras personas, compártela y fija una versión numérica (`clasp create-version "descripción"`).

## Uso

Menú **Evaluación Docente**, en el orden recomendado:

| Paso | Ítem de menú | Qué hace |
|---|---|---|
| 1 | Crear Plantilla Directorio | Crea las hojas `Directorio` (profesor, correo, copias) y `Configuración` (`AUTHORITIES_CC`). El nombre debe coincidir con el del formulario. |
| 2 | Enviar Prueba de Diseño | Manda un correo de prueba solo a quien ejecuta. |
| 3 | Generar Reportes | Crea un Doc por curso y lo registra como `PENDIENTE`. Se puede repetir: no duplica los que ya existen. |
| 4 | Resumen Comparativo | Crea/actualiza la hoja `Resumen_Comparativo`, ordenada por prioridad. |
| 5 | Exportar Informes a PDF | Guarda los PDF en la subcarpeta `PDF` y su enlace en `Registro_Reportes`. |
| 6 | Enviar Correos Masivos | Envía los informes en estado `PENDIENTE` y los marca `ENVIADO`. |

**Resumen comparativo.** Prioridad **Alta**: 2 o más dimensiones bajo 4,0, o media docente 0,3 por debajo del semestre. **Media**: 1 dimensión bajo 4,0, o 0,2 por debajo. **Baja**: el resto. Incluye n, % de acuerdo, dimensión más baja, comentarios, confiabilidad y un mapa de calor de las 19 dimensiones. La hoja se regenera completa cada vez: no escribas datos en ella.

**PDF.** Se exporta directamente desde Google Docs, que incrusta Roboto; no pases por `.docx`, porque Word sin esa fuente reacomoda el texto. Para regenerar un PDF, borra su celda en la columna H de `Registro_Reportes`.

Los cursos con varios profesores generan **un** informe y un correo a todos ellos (cada nombre debe estar en `Directorio`).

## Configuración

Todo está en `CONFIG` (`Code.gs`) y `EMAIL_CONFIG` (`Emails.gs`).

| Clave | Para qué sirve |
|---|---|
| `PERIOD_LABEL` | Período del informe. Vacío = se detecta del nombre del archivo o de las fechas (hasta septiembre = 1er semestre). Escríbelo para forzarlo. |
| `PERIOD_SPLIT_MONTH` | Último mes que cuenta como 1er semestre. |
| `THRESHOLDS` | `CRITICAL` (4,0), `BAND` (±0,2), `MIN_RESPONSES` (5) y los umbrales de prioridad `ATTENTION_HIGH` y `DIFF_HIGH`. |
| `NOT_APPLICABLE` | Preguntas que no aplican a ciertos cursos (hoy: «usa el español» en los cursos en inglés). Los nombres deben coincidir con los del formulario. |
| `BLOCKS`, `DIMENSIONS` | Bloques y nombres de las preguntas. Si el formulario cambia, actualízalos junto con `NUM_QUESTIONS` y `TEACHING_DIMENSIONS_COUNT`. |
| `SIGNATURE` | Firma al pie del informe. |
| `SENDER_NAME`, `SENDER_EMAIL` | Remitente de los correos (`EMAIL_CONFIG`). |

Antes de cada semestre revisa `NOT_APPLICABLE`, `SIGNATURE` y la lista `AUTHORITIES_CC` de la hoja `Configuración`.

## Formato de la hoja de respuestas

El código lee por **posición**, no por el título de la columna (índices desde 0):

| Col. | Contenido |
|---|---|
| 0 | Marca temporal |
| 1 | Correo |
| 2 | `Curso — Profesor` en una sola celda (acepta raya larga, raya media o guion con espacios; separa por el último) |
| 3 | Idioma (Español / Inglés) |
| 4–22 | 19 preguntas de escala, en español |
| 23, 24, 25 | Comentarios al profesor, sobre la asignatura y «otros cursos» (este último no se usa) |
| 26–44 | 19 preguntas de escala, en inglés |
| 45, 46, 47 | Comentarios (inglés), mismo orden |

Las primeras 15 preguntas evalúan al docente; las últimas 4 son la autoevaluación del estudiante. Si un estudiante responde dos veces el mismo curso, se usa solo su última respuesta.

## Solución de problemas

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| No aparece el menú | Falta `onOpen`: el código pegado no lo incluye, o la hoja usa el stub y la librería no está accesible. | Pega el `Code.js` actual o el stub; recarga. En Apps Script, revisa Ejecuciones > `onOpen`. |
| «No se encontró ninguna respuesta válida» | Estás en otra pestaña, o la columna C no tiene `Curso — Profesor`. | Lee el aviso: muestra qué hay en la primera fila. Revisa la pestaña y el mapa de columnas. |
| «Los N cursos ya tienen un informe registrado» | `Registro_Reportes` trae filas de otro semestre (por ejemplo, copiada con la planilla). | Bórrala o vacíala y vuelve a ejecutar. |
| `... is not a function` al generar | Se usó un método que Apps Script no tiene. | Copia el error de Ejecuciones y corrígelo en el código. |
| El menú no tiene los ítems nuevos | Esa hoja tiene un stub antiguo. | Pega el `stub/Code.js` actual. |
| «Email no encontrado» para un profesor | Su nombre no coincide con `Directorio`. | Iguala el nombre al del informe. |
| La generación se detiene antes de terminar | Límite de 6 minutos de Apps Script. | Vuelve a ejecutar: continúa con los pendientes. |

## Estructura del repositorio

```
Code.js              Configuración, tema, menú, datos, estadísticas, Docs, resumen y PDF
Emails.js            Correos, plantilla, permisos y hojas Directorio/Configuración
Stats.js             Funciones puras (niveles, formato, período, separador, destinatarios)
appsscript.json      Manifiesto (zona horaria, servicio avanzado de Drive)
stub/                Menú mínimo para usar el código como librería
types/               Tipos de datos (models.d.ts) y de lo que falta en @types (apps-script-extras.d.ts)
test/run.js          Pruebas de la lógica pura (Node, sin dependencias)
tsconfig.json        Chequeo de tipos de los .js con JSDoc (checkJs), sin compilar
.clasp.json          scriptId de la librería
.claspignore         Solo se sube *.js raíz y appsscript.json
.github/             CI (tipos + pruebas), Dependabot y CODEOWNERS
CHANGELOG.md         Historial de cambios
SECURITY.md          Política de seguridad
```

## Desarrollo y pruebas

```bash
npm install            # TypeScript y los tipos de Apps Script (solo desarrollo)
npm run check          # tipos + pruebas (lo mismo que corre el CI en GitHub)
npm run typecheck      # solo tipos (tsc con checkJs)
npm test               # solo pruebas de la lógica pura; no requieren Google
npm run push           # sube la librería con clasp (cuenta con acceso de editor)
```

**Tipos sin migrar a TypeScript.** El código sigue siendo JavaScript de Apps Script; `tsc` lo revisa con los tipos oficiales (`@types/google-apps-script`) y las anotaciones JSDoc. Eso detecta, por ejemplo, llamadas a métodos que la API no tiene. Los tipos de datos están en `types/models.d.ts`. Lo que `@types` no declara pero sí existe en Apps Script (formato de texto en `Paragraph`, Drive v2) está en `types/apps-script-extras.d.ts`.

**Qué no cubre.** Ni los tipos ni las pruebas ejecutan Google (Docs, Sheets, Drive, Gmail): eso se prueba corriendo el menú sobre una hoja con pocas filas. Mantén la lógica sin servicios de Google en `Stats.js` para poder probarla.

**Buenas prácticas de Apps Script** ([guía oficial](https://developers.google.com/apps-script/guides/support/best-practices)): la hoja de respuestas se lee de una sola vez y se procesa en memoria, y el trabajo largo se divide en tandas que caben en el límite de 6 minutos (la generación y la exportación a PDF se pueden reanudar). Los registros por informe (`Registro_Reportes`, estado de envío, enlace al PDF) se escriben fila a fila a propósito: si la ejecución se corta, no se pierde lo ya hecho, a costa de más llamadas.

**CI.** En cada `push` y pull request, GitHub Actions corre `npm run check`. No despliega: subir a Apps Script es manual (`npm run push`), porque `clasp` en CI exige guardar credenciales OAuth personales como secreto.

## Mantenimiento y contribuciones

Proyecto interno de la Coordinación Académica del CELE (PUCV). Los cambios se registran en el [CHANGELOG](CHANGELOG.md) siguiendo [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/): agrega tus notas bajo `[Unreleased]` y súbelas a una versión al publicar. Antes de subir cambios, corre `npm run check`.

## Licencia

Este repositorio no tiene licencia explícita: por defecto todos los derechos están reservados. Uso interno del CELE PUCV.
