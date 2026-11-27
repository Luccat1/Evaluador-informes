/**
 * Funciones puras (sin servicios de Google) para clasificar y formatear resultados.
 * Se prueban en local con `node test/run.js`.
 */

/** Número con 1 decimal y coma (formato chileno), o "—" si no hay dato. */
function fmt(n) {
    if (n == null || isNaN(n)) return '—';
    return (Math.round(n * 10) / 10).toFixed(1).replace('.', ',');
}

/** Diferencia con signo: +0,3 / −0,2 / 0,0 */
function fmtDiff(d) {
    const r = Math.round(d * 10) / 10;
    return (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r).toFixed(1).replace('.', ',');
}

/** Diferencia curso-semestre usando los valores tal como se muestran (1 decimal). */
function diffRounded(mean, semMean) {
    return Math.round((Math.round(mean * 10) / 10 - Math.round(semMean * 10) / 10) * 10) / 10;
}

/**
 * Nivel de una dimensión: ATTENTION (< umbral crítico, solo docencia), ABOVE, EQUAL o BELOW
 * según la diferencia con la media semestral (banda ±CONFIG.THRESHOLDS.BAND).
 */
function classifyDimension(mean, semMean, isSelf) {
    const T = CONFIG.THRESHOLDS;
    if (!isSelf && Math.round(mean * 10) / 10 < T.CRITICAL) return 'ATTENTION';
    if (semMean == null || isNaN(semMean)) return 'EQUAL';
    const d = diffRounded(mean, semMean);
    if (d >= T.BAND - 1e-9) return 'ABOVE';
    if (d <= -T.BAND + 1e-9) return 'BELOW';
    return 'EQUAL';
}

/** Conteo de respuestas 1..5 → [n1, n2, n3, n4, n5]. */
function distribution(values) {
    const d = [0, 0, 0, 0, 0];
    values.forEach(v => { const k = Math.round(v); if (k >= 1 && k <= 5) d[k - 1]++; });
    return d;
}

/** Descarta comentarios vacíos o de relleno ("no", "nada", "n/a"...). */
function isMeaningfulComment(text) {
    const t = (text || '').toString().trim();
    return t.length > 2 && !/^(no|nada|ninguno|ninguna|n\/a|na|sin comentarios?|no tengo.*|-+|\.+)\.?$/i.test(t);
}

/** Párrafo de resumen con cifras (sin juicios globales tipo "EXCELENTE"). */
function buildSummaryText(n, generalMean, semesterMean, counts, totalDims) {
    const T = CONFIG.THRESHOLDS;
    let t;
    if (semesterMean == null || isNaN(semesterMean)) {
        t = `La media general de desempeño docente es ${fmt(generalMean)}. `;
    } else {
        const d = diffRounded(generalMean, semesterMean);
        const cmp = d >= T.BAND - 1e-9 ? 'por encima de' : d <= -T.BAND + 1e-9 ? 'por debajo de' : 'en línea con';
        t = `La media general de desempeño docente es ${fmt(generalMean)}, ${cmp} la del semestre (${fmt(semesterMean)}). `;
    }
    t += `De ${totalDims} dimensiones, ${counts.ABOVE} se ubican sobre la media semestral, ${counts.EQUAL} en la media y ${counts.BELOW + counts.ATTENTION} bajo ella` +
        (counts.ATTENTION ? `; ${counts.ATTENTION} de ellas requieren atención por estar bajo ${fmt(T.CRITICAL)}.` : '.');
    if (n < T.MIN_RESPONSES) {
        t = `Con ${n} ${n === 1 ? 'respuesta' : 'respuestas'} (se recomienda un mínimo de ${T.MIN_RESPONSES}), los resultados son solo indicativos y no deben generalizarse. ` + t;
    }
    return t;
}

/** Convierte una cadena de emails (separada por , o ;) en un array limpio. */
function parseEmailList(input) {
    if (!input) return [];
    return String(input).replace(/;/g, ',')
        .split(',')
        .map(e => e.trim())
        .filter(e => e.length > 0 && e.includes('@'));
}

/** Construye un mapa { nombreNormalizado: { email, cc } } desde las filas de la hoja Directorio. */
function buildDirectoryMap(dirRows, colName, colEmail, colCc) {
    const map = {};
    (dirRows || []).slice(1).forEach(row => {
        const name = row[colName];
        if (name) {
            map[name.toString().trim().toLowerCase()] = {
                email: row[colEmail],
                cc: row[colCc]
            };
        }
    });
    return map;
}

/**
 * Resuelve destinatarios (soporta múltiples profesores separados por coma) y copias.
 * Retorna { ok, toEmails, ccEmails, missing }.
 */
function resolveRecipients(professorName, directoryMap, globalCcList) {
    const names = String(professorName || '')
        .split(',')
        .map(n => n.trim())
        .filter(Boolean);

    const toSet = new Set();
    const ccSet = new Set(globalCcList || []);
    const missing = [];

    names.forEach(name => {
        const entry = directoryMap[name.toLowerCase()];
        const emails = entry ? parseEmailList(entry.email) : [];
        if (!entry || emails.length === 0) {
            missing.push(name);
            return;
        }
        emails.forEach(e => toSet.add(e));
        parseEmailList(entry.cc).forEach(e => ccSet.add(e));
    });

    return {
        ok: names.length > 0 && missing.length === 0 && toSet.size > 0,
        toEmails: Array.from(toSet),
        ccEmails: Array.from(ccSet),
        missing
    };
}

/** ¿La pregunta `dimIndex` no aplica al curso? (p. ej. "usa el español" en cursos dictados en inglés). */
function isNotApplicable(course, dimIndex) {
    const list = (CONFIG.NOT_APPLICABLE || {})[dimIndex] || [];
    const c = (course || '').toString().trim().toLowerCase();
    return list.some(x => x.trim().toLowerCase() === c);
}

/**
 * Período ("1er Semestre 2026") a partir del nombre del archivo y las fechas de respuesta.
 * El nombre manda si trae semestre/año explícitos; si no, se usa la fecha más frecuente.
 * Respuestas hasta CONFIG.PERIOD_SPLIT_MONTH (septiembre) = 1er semestre; después, 2º.
 * Devuelve null si no puede determinarlo.
 */
function detectPeriod(name, dates) {
    const n = (name || '').toLowerCase();
    let year = (n.match(/\b(20\d{2})\b/) || [])[1];
    let sem = null;
    if (/(primer|\b1\s*(er|ro|º|°)?)\s*semestre|semestre\s*(1|uno)\b|20\d{2}\s*[-\/]\s*1\b/.test(n)) sem = 1;
    else if (/(segundo|\b2\s*(do|º|°)?)\s*semestre|semestre\s*(2|dos)\b|20\d{2}\s*[-\/]\s*2\b/.test(n)) sem = 2;

    if (!sem || !year) {
        const tally = {};
        (dates || []).forEach(d => {
            if (!(d instanceof Date) || isNaN(d)) return;
            const k = d.getFullYear() + '|' + (d.getMonth() + 1 <= CONFIG.PERIOD_SPLIT_MONTH ? 1 : 2);
            tally[k] = (tally[k] || 0) + 1;
        });
        const best = Object.keys(tally).sort((a, b) => tally[b] - tally[a] || (a < b ? 1 : -1))[0];
        if (best) {
            const [y, sm] = best.split('|');
            year = year || y;
            sem = sem || Number(sm);
        }
    }
    return sem && year ? `${sem === 1 ? '1er' : '2º'} Semestre ${year}` : null;
}

/**
 * Separa "Curso — Profesor" por el ÚLTIMO separador: raya larga, raya media o guion con espacios.
 * (Un guion pegado, como en "Cross-Cultural", no cuenta.) Devuelve null si no hay separador.
 */
function splitCourseProfessor(text) {
    const t = (text || '').toString().trim();
    // Rayas (U+2012-2015) con o sin espacios; cualquier otro guion o signo menos (U+2010-2015, U+2212) solo si lleva espacios
    const re = /\s*[\u2012-\u2015]\s*|\s+[\u2010-\u2015\u2212-]\s+/g;
    let last = null, m;
    while ((m = re.exec(t)) !== null) last = m;
    if (!last) return null;
    const course = t.slice(0, last.index).trim();
    const professor = t.slice(last.index + last[0].length).trim();
    return course && professor ? { course, professor } : null;
}

/**
 * Prioridad de atención de un curso/profesor para el resumen comparativo.
 * Alta: varias dimensiones bajo el umbral crítico, o muy por debajo del semestre.
 * Media: una dimensión bajo el umbral, o bajo la media semestral por la banda.
 */
function priorityOf(attention, diff) {
    const T = CONFIG.THRESHOLDS;
    if (attention >= T.ATTENTION_HIGH || diff <= -T.DIFF_HIGH + 1e-9) return 'Alta';
    if (attention >= 1 || diff <= -T.BAND + 1e-9) return 'Media';
    return 'Baja';
}

/** Orden del resumen: prioridad, luego más dimensiones en atención, luego peor diferencia con el semestre. */
function compareSummary(a, b) {
    const rank = { Alta: 0, Media: 1, Baja: 2 };
    return rank[a.priority] - rank[b.priority] || b.att - a.att || a.diff - b.diff || a.mean - b.mean;
}
