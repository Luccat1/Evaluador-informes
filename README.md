# Evaluador de informes docentes (CELE PUCV)

Script de Google Apps Script, ligado a la hoja de respuestas del Google Form de evaluación docente. Genera un Google Doc por curso/profesor con estadísticas y comentarios, y los envía por correo.

## Archivos

- `Code.gs`: configuración (`CONFIG`, `THEME`), menú, lectura de datos, estadísticas y generación de los Docs. Registra cada informe en la hoja `Registro_Reportes`.
- `Stats.gs`: funciones puras (clasificación de niveles, distribución, formato). Se prueban con `node test/run.js`.
- `Emails.gs`: envío masivo (`EMAIL_CONFIG`), plantilla HTML, permisos de lector sobre cada Doc y plantilla de la hoja `Directorio`.

## Formato esperado de la hoja de respuestas

| Col. | Contenido |
|---|---|
| 0 | Marca temporal |
| 1 | Correo |
| 2 | `Curso — Profesor` (una sola celda; se separa por el último ` — `) |
| 3 | Idioma (Español / Inglés) |
| 4–22 | 19 preguntas de escala en español |
| 23 | Comentario al profesor (ES) |
| 26–44 | 19 preguntas de escala en inglés |
| 45 | Comentario al profesor (EN) |

Las primeras 15 preguntas evalúan al docente; las últimas 4 son autoevaluación del estudiante. Si el formulario cambia, ajusta `CONFIG` en `Code.gs` (índices, `NUM_QUESTIONS`, `TEACHING_DIMENSIONS_COUNT`, `DIMENSIONS`).

## Uso

1. En la hoja de respuestas: Extensiones > Apps Script, o `clasp push` (ver abajo).
2. Recarga la hoja. Aparece el menú **Evaluación Docente**.
3. Orden recomendado:
   1. **Crear Plantilla Directorio** y rellenar profesor, correo y CC. El nombre debe coincidir con el del formulario.
   2. **Enviar Prueba de Diseño** (correo de prueba).
   3. **Generar Reportes** y revisar un Doc.
   4. **Enviar Correos Masivos**: envía los informes en estado `PENDIENTE`.

## Antes de cada semestre

En `Code.gs` → `CONFIG`: `SIGNATURE`. El período ("1er Semestre 2026") se detecta solo desde el nombre del archivo o las fechas de respuesta (`PERIOD_SPLIT_MONTH`: hasta septiembre = 1er semestre); si no acierta, escríbelo en `PERIOD_LABEL`.

En `Emails.gs` → `EMAIL_CONFIG`:
- `SUBJECT_TEMPLATE`: semestre en el asunto.
- `AUTHORITIES_CC`: autoridades en copia.
- `SENDER_EMAIL`: alias que debe estar configurado en Gmail de quien ejecuta.

Los cursos con varios profesores generan un solo informe con el nombre completo (`A, B, C`).

## Resumen comparativo

Menú **Resumen Comparativo**: crea/actualiza la hoja `Resumen_Comparativo` con una fila por curso y profesor, ordenada por prioridad de atención (Alta: 2 o más dimensiones bajo 4,0 o media docente 0,3 bajo el semestre; Media: 1 dimensión bajo 4,0 o 0,2 bajo el semestre; Baja: el resto). Incluye n, media docente, diferencia con el semestre, % de acuerdo, dimensión más baja, comentarios, confiabilidad (n < 5 = indicativo) y un mapa de calor con las 19 dimensiones. Se regenera completa cada vez; umbrales en `CONFIG.THRESHOLDS`.

## Exportar a PDF

Menú **Exportar Informes a PDF**: convierte los Docs de `Registro_Reportes` a PDF directamente desde Google Docs (incrusta Roboto; no pasar por .docx). Los deja en la subcarpeta `PDF` y guarda el enlace en la columna H. Se puede repetir: salta los ya exportados (para regenerar uno, borra su celda de la columna H).

## Preguntas que no aplican

`CONFIG.NOT_APPLICABLE` lista los cursos para los que una pregunta no tiene sentido (hoy: "usa el español durante toda la clase" en los cursos dictados en inglés). Esas respuestas se excluyen de la media del curso y del semestre, y la fila aparece como "No aplica". El nombre debe coincidir con el del formulario.

## Despliegue: librería + stub (funciona en cualquier hoja)

El código de la raíz (`Code.gs`, `Emails.gs`) es una **librería** de Apps Script (scriptId en `.clasp.json`). Cada hoja lleva un stub mínimo (`stub/`) que crea el menú y delega en la librería. Las funciones corren en el contexto de la hoja que las llama, así que sirve para cualquier hoja sin tocar el código.

**Actualizar la librería** (cuenta de `clasp` con acceso de editor y Apps Script API activada):

```bash
clasp push -f
clasp create-version "descripción"   # solo si los stubs usan una versión fija
```

**Usarla en una hoja nueva**: Extensiones > Apps Script, pegar `stub/Code.gs` y, en `appsscript.json` (activar "Mostrar archivo de manifiesto" en Configuración), copiar `stub/appsscript.json`. También se puede añadir la librería a mano con el scriptId y el identificador `EvaluadorLib`. Recargar la hoja y aceptar los permisos.

El stub usa `developmentMode: true` con versión `0`, o sea, siempre ejecuta el último `push` (solo para quienes son editores de la librería). Para otros usuarios hay que compartirles la librería y fijar una versión numérica.
