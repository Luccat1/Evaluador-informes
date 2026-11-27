// Prueba la lógica pura (Stats.gs) y el procesamiento de filas, sin servicios de Google.
// Uso: node test/run.js
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const stub = new Proxy({}, { get: (_, k) => k });
const ctx = vm.createContext({ assert, DocumentApp: { Attribute: stub, HorizontalAlignment: stub }, console });
const src = ['Code.gs', 'Stats.gs'].map(f => fs.readFileSync(__dirname + '/../' + f, 'utf8')).join('\n');

vm.runInContext(src + `
  assert.strictEqual(CONFIG.BLOCKS.reduce((a, b) => a + b.count, 0), CONFIG.NUM_QUESTIONS);
  assert.strictEqual(CONFIG.DIMENSIONS.length, CONFIG.NUM_QUESTIONS);
  assert.strictEqual(classifyDimension(3.0, 4.1), 'ATTENTION');
  assert.strictEqual(classifyDimension(4.0, 4.0), 'EQUAL');
  assert.strictEqual(classifyDimension(4.0, 4.5), 'BELOW');
  assert.strictEqual(classifyDimension(5.0, 4.4), 'ABOVE');
  assert.strictEqual(classifyDimension(3.0, 3.5, true), 'BELOW'); // autoevaluación: sin umbral crítico
  assert.deepStrictEqual(distribution([5, 4, 4, 1]), [1, 0, 0, 2, 1]);
  assert.strictEqual(fmt(4.25), '4,3');
  assert.strictEqual(fmtDiff(-0.04), '0,0');
  assert.strictEqual(fmtDiff(-0.5), '−0,5');
  assert.ok(!isMeaningfulComment('No'));
  assert.ok(!isMeaningfulComment('n/a'));
  assert.ok(isMeaningfulComment('Muy buenas clases'));
  assert.ok(buildSummaryText(1, 4.3, 4.4, { ABOVE: 7, EQUAL: 5, BELOW: 2, ATTENTION: 1 }, 15).startsWith('Con 1 respuesta'));
  assert.ok(!buildSummaryText(8, 4.3, 4.4, { ABOVE: 7, EQUAL: 5, BELOW: 2, ATTENTION: 0 }, 15).startsWith('Con'));

  // processData con una fila con la estructura del formulario real
  const row = ['t', 'a@b.cl', 'Gramática en contexto. Nivel avanzado — Aldo Moreira', 'Español']
    .concat(Array(19).fill(4), ['Excelente', 'Más ejercicios', 'otros cursos'], Array(19).fill(''), ['', '', '']);
  const g = processData([[], row]);
  const k = Object.keys(g)[0];
  assert.strictEqual(g[k].professor, 'Aldo Moreira');
  assert.strictEqual(g[k].course, 'Gramática en contexto. Nivel avanzado');
  assert.deepStrictEqual(g[k].comments, ['Excelente']);
  assert.deepStrictEqual(g[k].commentsCourse, ['Más ejercicios']);
  assert.strictEqual(g[k].langs.es, 1);
  assert.deepStrictEqual(calculateCourseStats(g[k]).dimensions[0].dist, [0, 0, 0, 1, 0]);

  // Deduplicación en processData: mismo correo y mismo curso conserva solo la última fila
  const dupOld = ['t1', 'a@b.cl', 'Curso X — Prof A', 'Español'].concat(Array(19).fill(1), ['Viejo', '', ''], Array(19).fill(''), ['', '', '']);
  const dupNew = ['t2', 'A@B.CL ', 'Curso X — Prof A', 'Español'].concat(Array(19).fill(5), ['Nuevo', '', ''], Array(19).fill(''), ['', '', '']);
  const gDup = processData([[], dupOld, dupNew]);
  assert.strictEqual(gDup['Prof A|Curso X'].responses.length, 1);
  assert.strictEqual(gDup['Prof A|Curso X'].responses[0][0], 5);
  assert.deepStrictEqual(gDup['Prof A|Curso X'].comments, ['Nuevo']);

  // Búsqueda en directorio y parseEmailList
  assert.deepStrictEqual(parseEmailList('a@pucv.cl; b@pucv.cl , invalid, '), ['a@pucv.cl', 'b@pucv.cl']);
  const dirMap = buildDirectoryMap([
    ['Nombre', 'Email', 'CC'],
    ['Aldo Moreira', 'aldo@pucv.cl', 'coord@pucv.cl'],
    ['Nayra Simonó', 'nayra@pucv.cl', 'coord@pucv.cl; dir@pucv.cl'],
    ['Esperanza Godoy', 'esperanza@pucv.cl', '']
  ], 0, 1, 2);

  // Caso 1: profesor único con CC global y específico deduplicado
  const rSingle = resolveRecipients('Aldo Moreira', dirMap, ['coord@pucv.cl', 'decano@pucv.cl']);
  assert.strictEqual(rSingle.ok, true);
  assert.deepStrictEqual(rSingle.toEmails, ['aldo@pucv.cl']);
  assert.deepStrictEqual(rSingle.ccEmails, ['coord@pucv.cl', 'decano@pucv.cl']);

  // Caso 2: múltiples profesores separados por coma
  const rMulti = resolveRecipients('Aldo Moreira, Nayra Simonó, Esperanza Godoy', dirMap, ['dir@pucv.cl']);
  assert.strictEqual(rMulti.ok, true);
  assert.deepStrictEqual(rMulti.toEmails, ['aldo@pucv.cl', 'nayra@pucv.cl', 'esperanza@pucv.cl']);
  assert.deepStrictEqual(rMulti.ccEmails, ['dir@pucv.cl', 'coord@pucv.cl']);

  // Caso 3: falta un profesor en el directorio
  const rMissing = resolveRecipients('Aldo Moreira, Desconocido', dirMap, []);
  assert.strictEqual(rMissing.ok, false);
  assert.deepStrictEqual(rMissing.missing, ['Desconocido']);

  // Cursos dictados en inglés: la pregunta 14 no aplica y no entra en las medias
  assert.ok(isNotApplicable('Global Entrepreneurship', 14));
  assert.ok(isNotApplicable(' global entrepreneurship ', 14));
  assert.ok(!isNotApplicable('Global Entrepreneurship', 13));
  assert.ok(!isNotApplicable('Gramática en contexto. Nivel avanzado', 14));
  const rowEn = ['t', 'a@b.cl', 'Global Entrepreneurship — Drago Radovic', 'Español'].concat(Array(19).fill(5), ['', '', '']);
  const ge = processData([[], rowEn]);
  const gst = calculateCourseStats(ge[Object.keys(ge)[0]]);
  assert.strictEqual(gst.dimensions[14].n, 0);
  assert.strictEqual(gst.dimensions[13].n, 1);
  // Período: por fechas y por nombre del archivo
  const jun = [new Date(2026, 5, 10), new Date(2026, 5, 20), new Date(2026, 6, 2)];
  assert.strictEqual(detectPeriod('Evaluación de Cursos (respuestas)', jun), '1er Semestre 2026');
  assert.strictEqual(detectPeriod('Evaluación de Cursos (respuestas)', [new Date(2026, 10, 25), new Date(2026, 11, 3)]), '2º Semestre 2026');
  assert.strictEqual(detectPeriod('Evaluación 2º semestre 2025', jun), '2º Semestre 2025');
  assert.strictEqual(detectPeriod('Evaluación Primer Semestre', [new Date(2027, 10, 1)]), '1er Semestre 2027');
  assert.strictEqual(detectPeriod('Sin datos', []), null);
  assert.strictEqual(detectPeriod('Sin datos', ['x', null]), null);
  // Separador "Curso — Profesor" tolerante
  assert.deepStrictEqual(splitCourseProfessor('Gramática — Aldo Moreira'), { course: 'Gramática', professor: 'Aldo Moreira' });
  assert.deepStrictEqual(splitCourseProfessor('Gramática - Aldo Moreira'), { course: 'Gramática', professor: 'Aldo Moreira' });
  assert.deepStrictEqual(splitCourseProfessor('Gramática–Aldo Moreira'), { course: 'Gramática', professor: 'Aldo Moreira' });
  assert.deepStrictEqual(splitCourseProfessor('Resistance: Cross-Cultural Encounters — Torben Albertsen'),
    { course: 'Resistance: Cross-Cultural Encounters', professor: 'Torben Albertsen' });
  assert.strictEqual(splitCourseProfessor('Solo curso'), null);
  assert.strictEqual(splitCourseProfessor(''), null);
  // Guiones "raros": no separable, signo menos, raya con nbsp
  assert.deepStrictEqual(splitCourseProfessor('Nivel inicial \u2011 Andrés Medel'), { course: 'Nivel inicial', professor: 'Andrés Medel' });
  assert.deepStrictEqual(splitCourseProfessor('Nivel inicial \u2212 Andrés Medel'), { course: 'Nivel inicial', professor: 'Andrés Medel' });
  assert.deepStrictEqual(splitCourseProfessor('Nivel inicial\u00a0-\u00a0Andrés Medel'), { course: 'Nivel inicial', professor: 'Andrés Medel' });
  assert.deepStrictEqual(splitCourseProfessor('Español comunicacional y cultura chilena. Nivel inicial - Andrés Medel'),
    { course: 'Español comunicacional y cultura chilena. Nivel inicial', professor: 'Andrés Medel' });
  assert.strictEqual(splitCourseProfessor('Cross-Cultural'), null);
  // Regresión: con guion corto y correo presente, la deduplicación no debe descartar todo
  const rowHy = ['t', 'a@b.cl', 'Español comunicacional y cultura chilena. Nivel inicial - Andrés Medel', 'Español']
    .concat(Array(19).fill(4), ['', '', ''], Array(19).fill(''), ['', '', '']);
  const gh = processData([[], rowHy]);
  assert.strictEqual(Object.keys(gh).length, 1);
  // Mismo correo y curso dos veces: queda solo la última respuesta
  const rowHy2 = rowHy.slice(); rowHy2[4] = 5;
  const gd = processData([[], rowHy, rowHy2]);
  assert.strictEqual(gd[Object.keys(gd)[0]].responses.length, 1);
  assert.strictEqual(gd[Object.keys(gd)[0]].responses[0][0], 5);
  // Resumen comparativo: ordena por prioridad
  assert.strictEqual(priorityOf(2, 0), 'Alta');
  assert.strictEqual(priorityOf(0, -0.3), 'Alta');
  assert.strictEqual(priorityOf(1, 0.5), 'Media');
  assert.strictEqual(priorityOf(0, -0.2), 'Media');
  assert.strictEqual(priorityOf(0, 0.1), 'Baja');
  const mk = (course, prof, email, v) => ['t', email, course + ' — ' + prof, 'Español']
    .concat(Array(19).fill(v), ['', '', ''], Array(19).fill(''), ['', '', '']);
  const pd = processData([[], mk('Curso Bueno', 'Ana', 'a1@x.cl', 5), mk('Curso Bueno', 'Ana', 'a2@x.cl', 5),
                          mk('Curso Malo', 'Beto', 'b1@x.cl', 3), mk('Curso Malo', 'Beto', 'b2@x.cl', 3)]);
  const sr = buildSummaryRows(pd, calculateSemesterStats(pd));
  assert.strictEqual(sr.length, 2);
  assert.strictEqual(sr[0].professor, 'Beto');
  assert.strictEqual(sr[0].priority, 'Alta');
  assert.strictEqual(sr[0].att, 15);
  assert.strictEqual(sr[1].priority, 'Baja');
  assert.strictEqual(sr[1].reliable, false); // n = 2 < 5
  assert.strictEqual(sr[0].lowest.mean, 3);
  console.log('OK: todas las pruebas pasaron');
`, ctx, { filename: 'bundle' });
