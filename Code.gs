/**
 * 🎓 GENERADOR DE REPORTES DE EVALUACIÓN DOCENTE - CELE PUCV
 * ==========================================================
 * 
 * Este script automatiza la generación de informes de evaluación docente a partir de una Hoja de Cálculo de Google.
 * 
 * CARACTERÍSTICAS:
 * - Procesa respuestas bilingües (Español/Inglés).
 * - Calcula estadísticas descriptivas (Media, Mediana, Desv. Est., % Acuerdo).
 * - Separa dimensiones de docencia y autoevaluación del estudiante.
 * - Genera documentos Google Docs con diseño institucional (100 Años PUCV).
 * - Guarda los reportes organizados en carpetas dentro de Google Drive.
 * 
 * INSTRUCCIONES DE USO:
 * 1. Pegar este código en Extensiones > Apps Script.
 * 2. Recargar la hoja de cálculo.
 * 3. Usar el menú "Evaluación Docente" > "Generar Reportes".
 * 
 * @author Luciano Cataldo (Refactorizado por Asistente IA)
 * @version 2.0.0 - Modular & Themed
 */

/* ==========================================================================
   1. CONFIGURACIÓN GENERAL (CONFIG)
   ========================================================================== */
const CONFIG = {
    // --- Mapeo de Columnas (Indices comienzan en 0) ---
    COL_TIMESTAMP: 0,
    COL_EMAIL: 1,
    COL_COURSE_PROFESSOR: 2, // "Curso — Profesor" en una sola celda
    COL_LANG: 3,      // "¿Deseas responder en español o en inglés?..."

    // --- Configuración de Preguntas (Español) ---
    // Ajustar si cambian las columnas en el formulario
    COL_START_SPANISH: 4,    // Primera pregunta de escala
    COL_COMMENT_SPANISH: 23, // Comentarios al profesor; +1 = comentarios sobre la asignatura

    // --- Configuración de Preguntas (Inglés) ---
    COL_START_ENGLISH: 26,
    COL_COMMENT_ENGLISH: 45,

    // --- Parámetros del Formulario ---
    NUM_QUESTIONS: 19, // Total de preguntas de escala (Docencia + Autoevaluación)

    // Cantidad de preguntas que evalúan al DOCENTE (las primeras N).
    // Las restantes se consideran autoevaluación del estudiante.
    TEACHING_DIMENSIONS_COUNT: 15,

    // --- Dimensiones Evaluadas (En orden de aparición) ---
    DIMENSIONS: [
        // --- Docencia (1-15) ---
        "Contenidos, actividades y materiales acorde al programa",
        "Organización y carga de trabajo equilibrada",
        "Claridad en la resolución de dudas",
        "Desarrollo de habilidades lingüísticas",
        "Desarrollo de capacidades para interactuar en español",
        "Evaluación coherente con el programa",
        "Evaluación coherente con lo trabajado en clases",
        "Claridad en criterios de evaluación",
        "Motivación a la participación",
        "Receptividad a necesidades",
        "Enfoque centrado en el estudiante",
        "Cumplimiento de horas de clase",
        "Puntualidad en inicio",
        "Puntualidad en término",
        "Uso del español durante toda la clase",
        // --- Autoevaluación (16-19) ---
        "Asistencia constante del estudiante",
        "Participación activa",
        "Cumplimiento de plazos de entrega",
        "Preparación adecuada para evaluaciones"
    ],

    // Preguntas que no aplican a ciertos cursos: { índice de la dimensión: [nombres exactos de curso] }.
    // 14 = "Uso del español durante toda la clase" (no aplica en cursos dictados en inglés).
    NOT_APPLICABLE: {
        14: [
            "Human Rights in Latin America",
            "Resistance, Appropriation and Sustainability: Cross-Cultural Encounters with the Native Mapuche People",
            "Political and Social Change in Chile and Latin America",
            "Contemporary Latin American films",
            "Global Entrepreneurship"
        ]
    },

    // Período que aparece en informes y asunto de correos
    SHEET_SUMMARY: "Resumen_Comparativo",

    // Vacío = se detecta solo (nombre del archivo o fechas de respuesta). Escribir un texto lo fuerza.
    PERIOD_LABEL: "",
    PERIOD_SPLIT_MONTH: 9, // respuestas hasta este mes = 1er semestre; después, 2º

    // Bloques del formulario (en orden); la suma debe ser NUM_QUESTIONS
    BLOCKS: [
        { title: "Enseñanza-aprendizaje", count: 5 },
        { title: "Evaluación-aprendizaje", count: 3 },
        { title: "Estilo de enseñanza-aprendizaje", count: 3 },
        { title: "Aspectos formales del profesor/a", count: 4 },
        { title: "Desempeño del estudiante (autoevaluación)", count: 4 }
    ],

    SIGNATURE: "Coordinación Académica\nCentro de Español Lengua Extranjera (CELE)\nDirección General de Asuntos Internacionales\nPontificia Universidad Católica de Valparaíso",

    // --- Configuración de Archivos ---
    FILES: {
        LOGO_NAME: "Grilla_arriba_color.png", // Nombre del archivo de logo en Drive
        LOGO_URL: "https://comunicacionestrategica.pucv.cl/LOGO100/7/color.png" // URL de respaldo
    },

    // --- Umbrales de Evaluación ---
    THRESHOLDS: {
        CRITICAL: 4.0,       // Nota mínima aceptable (la escala es 1-5, bajo 4.0 es alerta)
        BAND: 0.2,           // Diferencia con la media semestral para decir "sobre" o "bajo" (±)
        MIN_RESPONSES: 5,    // Bajo este n, los resultados se marcan como solo indicativos
        ATTENTION_HIGH: 2,   // Resumen comparativo: prioridad Alta si hay tantas dimensiones bajo CRITICAL...
        DIFF_HIGH: 0.3       // ...o si la media docente está tantos puntos bajo la del semestre
    }
};

/* ==========================================================================
   2. SISTEMA DE DISEÑO (THEME)
   ========================================================================== */
/**
 * Objeto centralizado de estilos. Funciona como un archivo CSS.
 * Permite cambiar la apariencia de todos los reportes desde un solo lugar.
 */
const THEME = {
    // --- Paleta de Colores (Institucional 100 Años PUCV) ---
    COLORS: {
        PRIMARY: "#24588d",    // Azul Oscuro (Títulos, Encabezados)
        SECONDARY: "#1d71b8",  // Azul Medio (Subtítulos, Etiquetas)
        ACCENT: "#30b6be",     // Turquesa (Detalles)
        TEXT_MAIN: "#333333",  // Texto Principal
        TEXT_LIGHT: "#555555", // Texto Secundario
        BG_HEADER: "#ece5e0",  // Beige (Fondos de tabla)
        TINT: "#a3d1e3",       // Celeste (fondo "sobre la media")
        WARN: "#f4ce46",       // Amarillo (fondo "bajo la media")
        GRILLA: ["#24588d", "#1d71b8", "#008cba", "#36a9e1", "#30b6be", "#f4ce46", "#ee7269", "#e73a34", "#9366a9"],
        POSITIVE: "#008cba",   // Azul (Fortalezas / Sobre Media)
        NEUTRAL: "#333333",    // Gris Oscuro (Adecuado / Estándar)
        NEGATIVE: "#e73a34"    // Rojo (Alerta / Bajo Estándar)
    },

    // --- Niveles de desempeño (chip de la columna "Nivel") ---
    LEVELS: {
        ABOVE:     { label: "Sobre la media",    bg: "#a3d1e3", fg: "#24588d" },
        EQUAL:     { label: "En la media",       bg: "#ece5e0", fg: "#333333" },
        BELOW:     { label: "Bajo la media",     bg: "#f4ce46", fg: "#333333" },
        ATTENTION: { label: "Requiere atención", bg: "#e73a34", fg: "#ffffff" }
    },

    // --- Tipografía ---
    FONTS: {
        MAIN: "Roboto"
    },

    // --- Definición de Estilos para DocumentApp ---
    // Se generan dinámicamente para ser usados con setAttributes()
    STYLES: {
        TITLE: {},
        HEADER_INSTITUTIONAL: {},
        H1: {},
        H2: {},
        NORMAL: {},
        LABEL: {},
        TABLE_HEADER: {},
        TABLE_CELL_LEFT: {},
        TABLE_CELL_CENTER: {}
    }
};

// Inicialización de estilos (IIFE para ejecutar al cargar)
(function initTheme() {
    const T = THEME;
    const A = DocumentApp.Attribute;
    const H = DocumentApp.HorizontalAlignment;

    // Título Principal
    T.STYLES.TITLE[A.FONT_SIZE] = 16;
    T.STYLES.TITLE[A.BOLD] = true;
    T.STYLES.TITLE[A.FOREGROUND_COLOR] = T.COLORS.PRIMARY;
    T.STYLES.TITLE[A.HORIZONTAL_ALIGNMENT] = H.CENTER;
    T.STYLES.TITLE[A.FONT_FAMILY] = T.FONTS.MAIN;

    // H1 (Títulos de Sección)
    T.STYLES.H1[A.FONT_SIZE] = 12;
    T.STYLES.H1[A.BOLD] = true;
    T.STYLES.H1[A.FOREGROUND_COLOR] = T.COLORS.PRIMARY;
    T.STYLES.H1[A.SPACING_BEFORE] = 14;
    T.STYLES.H1[A.SPACING_AFTER] = 6;
    T.STYLES.H1[A.FONT_FAMILY] = T.FONTS.MAIN;
    T.STYLES.H1[A.ITALIC] = false; // Asegurar no cursiva

    // H2 (Subtítulos)
    T.STYLES.H2[A.FONT_SIZE] = 11;
    T.STYLES.H2[A.BOLD] = true;
    T.STYLES.H2[A.FOREGROUND_COLOR] = T.COLORS.SECONDARY;
    T.STYLES.H2[A.SPACING_BEFORE] = 10;
    T.STYLES.H2[A.SPACING_AFTER] = 4;
    T.STYLES.H2[A.FONT_FAMILY] = T.FONTS.MAIN;

    // Texto Normal
    T.STYLES.NORMAL[A.FONT_SIZE] = 10;
    T.STYLES.NORMAL[A.FONT_FAMILY] = T.FONTS.MAIN;
    T.STYLES.NORMAL[A.FOREGROUND_COLOR] = T.COLORS.TEXT_MAIN;
    T.STYLES.NORMAL[A.LINE_SPACING] = 1.15;
    T.STYLES.NORMAL[A.BOLD] = false; // Forzar no-negrita
    T.STYLES.NORMAL[A.ITALIC] = false; // Forzar no-cursiva (Fix crítico)

    // Etiquetas (Label: Valor)
    T.STYLES.LABEL[A.FONT_SIZE] = 10;
    T.STYLES.LABEL[A.FONT_FAMILY] = T.FONTS.MAIN;
    T.STYLES.LABEL[A.BOLD] = true;
    T.STYLES.LABEL[A.FOREGROUND_COLOR] = T.COLORS.SECONDARY;

    // Estilos de Tabla
    T.STYLES.TABLE_HEADER[A.FONT_SIZE] = 10;
    T.STYLES.TABLE_HEADER[A.FONT_FAMILY] = T.FONTS.MAIN;
    T.STYLES.TABLE_HEADER[A.BOLD] = true;
    T.STYLES.TABLE_HEADER[A.FOREGROUND_COLOR] = T.COLORS.PRIMARY;
    T.STYLES.TABLE_HEADER[A.HORIZONTAL_ALIGNMENT] = H.CENTER;

    T.STYLES.TABLE_CELL_LEFT[A.FONT_SIZE] = 10;
    T.STYLES.TABLE_CELL_LEFT[A.FONT_FAMILY] = T.FONTS.MAIN;
    T.STYLES.TABLE_CELL_LEFT[A.HORIZONTAL_ALIGNMENT] = H.LEFT;
    T.STYLES.TABLE_CELL_LEFT[A.FOREGROUND_COLOR] = T.COLORS.TEXT_MAIN; // Forzar color texto
    T.STYLES.TABLE_CELL_LEFT[A.BOLD] = false; // Forzar no-negrita
    T.STYLES.TABLE_CELL_LEFT[A.ITALIC] = false; // Forzar no-cursiva

    T.STYLES.TABLE_CELL_CENTER[A.FONT_SIZE] = 10;
    T.STYLES.TABLE_CELL_CENTER[A.FONT_FAMILY] = T.FONTS.MAIN;
    T.STYLES.TABLE_CELL_CENTER[A.HORIZONTAL_ALIGNMENT] = H.CENTER;
    T.STYLES.TABLE_CELL_CENTER[A.FOREGROUND_COLOR] = T.COLORS.TEXT_MAIN; // Forzar color texto
    T.STYLES.TABLE_CELL_CENTER[A.BOLD] = false; // Forzar no-negrita
    T.STYLES.TABLE_CELL_CENTER[A.ITALIC] = false; // Forzar no-cursiva
})();


/* ==========================================================================
   3. LÓGICA PRINCIPAL (CORE)
   ========================================================================== */

/**
 * Crea el menú al abrir la hoja. Solo se ejecuta si este código está pegado directo en la hoja;
 * si la hoja usa el stub (stub/Code.gs) con esto como librería, el menú lo crea el stub.
 */
function onOpen() {
    SpreadsheetApp.getUi()
        .createMenu('Evaluación Docente')
        .addItem('📊 Generar Reportes', 'generateReports')
        .addItem('📈 Resumen Comparativo', 'generateComparativeSummary')
        .addItem('📄 Exportar Informes a PDF', 'exportReportsToPdf')
        .addSeparator()
        .addItem('📧 Enviar Correos Masivos', 'launchEmailSender')
        .addItem('📋 Crear Plantilla Directorio', 'createDirectoryTemplate')
        .addSeparator()
        .addItem('🧪 Enviar Prueba de Diseño', 'sendTestEmail')
        .addToUi();
}

/**
 * Función orquestadora principal.
 * 1. Lee datos. 2. Prepara carpetas/recursos. 3. Procesa estadísticas. 4. Genera Docs.
 */
function generateReports() {
    const lock = LockService.getScriptLock();
    // Bloqueo más corto para generación (10s), si está ocupado, mejor avisar rápido
    try {
        if (!lock.tryLock(10000)) {
            SpreadsheetApp.getUi().alert('⚠️ Ya se están generando reportes en segundo plano. Espera a que termine.');
            return;
        }
    } catch (e) {
        console.error("Error Lock generación:", e);
        return;
    }

    const TIME_LIMIT_MS = 4.5 * 60 * 1000; // Margen seguro antes del límite de 6 min de Apps Script
    const startTime = Date.now();

    try {
        const ui = SpreadsheetApp.getUi();
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
        const data = sheet.getDataRange().getValues();

        if (data.length < 2) {
            ui.alert('⚠️ No hay suficientes datos para procesar.');
            return;
        }

        // 1. Procesar Datos y verificar cuáles faltan por generar
        const processedData = processData(data);
        if (Object.keys(processedData).length === 0) {
            const sample = data[1][CONFIG.COL_COURSE_PROFESSOR];
            const odd = Array.from(String(sample)).filter(c => !/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\s.,:;()\/]/.test(c)).map(c => 'U+' + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0'));
            ui.alert(`⚠️ No se encontró ninguna respuesta válida en la hoja "${sheet.getName()}".\n\n` +
                `Se espera "Curso — Profesor" en la columna ${String.fromCharCode(65 + CONFIG.COL_COURSE_PROFESSOR)}. En la primera respuesta hay:\n"${sample}"\nCaracteres especiales: ${odd.join(" ") || "ninguno"}\n\n` +
                `Revisa que estés en la hoja de respuestas y que esa columna sea la del curso y profesor.`);
            return;
        }
        const existingKeys = getExistingReportKeys_();
        const pendingKeys = Object.keys(processedData).filter(k => !existingKeys.has(k));

        if (pendingKeys.length === 0) {
            ui.alert(`ℹ️ Los ${Object.keys(processedData).length} cursos de esta hoja ya tienen un informe registrado en "Registro_Reportes".\n\nSi es una hoja nueva y esa pestaña vino copiada de otra, bórrala (o sus filas) y vuelve a ejecutar.`);
            return;
        }

        // 2. Preparar Entorno (Carpetas y Logo)
        const env = setupEnvironment();
        if (!env) return; // Error crítico en setup

        // 3. Calcular Estadísticas Globales (Semestre)
        const semesterStats = calculateSemesterStats(processedData);

        // 4. Generar Reportes Individuales
        let count = 0;
        let remaining = 0;
        const errors = [];

        for (let i = 0; i < pendingKeys.length; i++) {
            if (Date.now() - startTime > TIME_LIMIT_MS) {
                remaining = pendingKeys.length - i;
                break;
            }

            const key = pendingKeys[i];
            let docId = null;
            try {
                const courseData = processedData[key];
                docId = createReportDoc(courseData, semesterStats, env.folder, env.logoBlob);
                logReportGenerated(courseData.professor, courseData.course, docId, env.folder.getUrl());
                count++;
            } catch (e) {
                if (docId) {
                    try {
                        DriveApp.getFileById(docId).setTrashed(true);
                    } catch (trashErr) {
                        console.warn(`No se pudo enviar a papelera el Doc ${docId}: ${trashErr.message}`);
                    }
                }
                console.error(`Error generando reporte para ${key}: ${e.message}\n${e.stack}`);
                errors.push(`${key}: ${e.message}`);
            }
        }

        const resumeMsg = remaining > 0
            ? `\n\n⏱️ Límite de tiempo cercano: quedaron ${remaining} reportes pendientes. Vuelve a ejecutar "Generar Reportes" para continuar.`
            : '';

        if (errors.length > 0) {
            ui.alert(`⚠️ Proceso completado con alertas.\n\nSe generaron ${count} reportes.\nHubo ${errors.length} errores:\n${errors.join('\n')}${resumeMsg}`);
        } else if (remaining > 0) {
            ui.alert(`⏸️ Pausa por tiempo.\n\nSe generaron ${count} reportes en la carpeta:\n"${env.folder.getName()}"${resumeMsg}`);
        } else {
            ui.alert(`✅ Proceso completado con éxito.\n\nSe generaron ${count} reportes en la carpeta:\n"${env.folder.getName()}"`);
        }
    } catch (e) {
        console.error("Error fatal generando reportes:", e);
        SpreadsheetApp.getUi().alert(`❌ Error crítico: ${e.message}`);
    } finally {
        lock.releaseLock();
    }
}

/**
 * Obtiene las claves "profesor|curso" ya registradas en Registro_Reportes para evitar duplicados.
 */
function getExistingReportKeys_() {
    const keys = new Set();
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Registro_Reportes");
    if (!sheet) return keys;
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
        const prof = (rows[i][1] || '').toString().trim();
        const course = (rows[i][2] || '').toString().trim();
        if (prof && course) keys.add(`${prof}|${course}`);
    }
    return keys;
}

/** Primera pestaña con datos que no sea una hoja generada por el script (registro, directorio, resumen). */
function getResponsesSheet_() {
    const skip = [EMAIL_CONFIG.SHEET_LOG, EMAIL_CONFIG.SHEET_DIR, CONFIG.SHEET_SUMMARY];
    return SpreadsheetApp.getActiveSpreadsheet().getSheets().find(sh => !skip.includes(sh.getName()) && sh.getLastRow() > 1) || null;
}

let PERIOD_CACHE_ = null;

/** Período de la evaluación: CONFIG.PERIOD_LABEL si está escrito; si no, se detecta de la hoja de respuestas. */
function getPeriodLabel_() {
    if (CONFIG.PERIOD_LABEL) return CONFIG.PERIOD_LABEL;
    if (PERIOD_CACHE_) return PERIOD_CACHE_;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getResponsesSheet_();
    const dates = sheet ? sheet.getRange(2, CONFIG.COL_TIMESTAMP + 1, sheet.getLastRow() - 1, 1).getValues().map(r => r[0]) : [];
    PERIOD_CACHE_ = detectPeriod(ss.getName(), dates) || "Semestre sin determinar (definir CONFIG.PERIOD_LABEL)";
    return PERIOD_CACHE_;
}

/**
 * Configura la carpeta de destino y obtiene el logo.
 * @returns {Object|null} Objeto con folder y logoBlob, o null si error.
 */
function setupEnvironment() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ssFile = DriveApp.getFileById(ss.getId());

    // Obtener carpeta padre
    const parents = ssFile.getParents();
    const parentFolder = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();

    // Reutilizar o crear carpeta de reportes del día
    const folderName = `Reportes Evaluación Docente ${new Date().toLocaleDateString()}`;
    const existingFolders = parentFolder.getFoldersByName(folderName);
    const folder = existingFolders.hasNext() ? existingFolders.next() : parentFolder.createFolder(folderName);

    // Obtener Logo (Local -> Descarga -> Fallback)
    let logoBlob = null;
    const logoFiles = parentFolder.getFilesByName(CONFIG.FILES.LOGO_NAME);

    if (logoFiles.hasNext()) {
        logoBlob = logoFiles.next().getBlob();
    } else {
        try {
            const response = UrlFetchApp.fetch(CONFIG.FILES.LOGO_URL);
            if (response.getResponseCode() === 200) {
                logoBlob = response.getBlob().setName(CONFIG.FILES.LOGO_NAME);
                parentFolder.createFile(logoBlob); // Guardar para futuro uso
            }
        } catch (e) {
            console.warn("No se pudo descargar el logo:", e);
            SpreadsheetApp.getUi().alert(`⚠️ Aviso: No se encontró ni se pudo descargar el logo.\nLos reportes se generarán sin imagen institucional.\n\nPara solucionarlo: Sube "${CONFIG.FILES.LOGO_NAME}" a la carpeta del Excel.`);
        }
    }

    return { folder, logoBlob };
}


/* ==========================================================================
   4. PROCESAMIENTO DE DATOS
   ========================================================================== */

/**
 * Convierte filas crudas en objetos estructurados agrupados por curso.
 * Maneja la lógica bilingüe.
 */
function processData(rows) {
    const responses = rows.slice(1); // Ignorar encabezados
    const groupedData = {};

    // Conservar solo la última fila por par correo|curso
    const lastIdxByEmailCourse = {};
    responses.forEach((row, idx) => {
        const email = (row[CONFIG.COL_EMAIL] || '').toString().trim().toLowerCase();
        const parts = splitCourseProfessor(row[CONFIG.COL_COURSE_PROFESSOR]);
        if (email && parts) lastIdxByEmailCourse[`${email}|${parts.course}`] = idx;
    });

    responses.forEach((row, idx) => {
        const cp = (row[CONFIG.COL_COURSE_PROFESSOR] || '').toString();
        const parts = splitCourseProfessor(cp);
        if (!parts) return;
        const { course, professor } = parts;
        const lang = row[CONFIG.COL_LANG];

        if (!professor || !course) return; // Saltar filas vacías

        const email = (row[CONFIG.COL_EMAIL] || '').toString().trim().toLowerCase();
        if (email && lastIdxByEmailCourse[`${email}|${course}`] !== idx) return;

        const key = `${professor}|${course}`;

        if (!groupedData[key]) {
            groupedData[key] = {
                professor: professor,
                course: course,
                responses: [],
                comments: [],
                commentsCourse: [],
                langs: { es: 0, en: 0 }
            };
        }

        // Detección de Idioma
        let startCol, commentCol;
        const langStr = lang ? lang.toString().toLowerCase() : '';
        const isEnglish = langStr.includes('english') || langStr.includes('inglés') || langStr.includes('ingles');

        if (isEnglish) {
            startCol = CONFIG.COL_START_ENGLISH;
            commentCol = CONFIG.COL_COMMENT_ENGLISH;
        } else {
            startCol = CONFIG.COL_START_SPANISH;
            commentCol = CONFIG.COL_COMMENT_SPANISH;
        }

        // Extracción de Respuestas Numéricas
        const evaluationValues = [];
        let hasData = false;
        for (let i = 0; i < CONFIG.NUM_QUESTIONS; i++) {
            const val = isNotApplicable(course, i) ? null : row[startCol + i];
            const numVal = (typeof val === 'number') ? val : parseFloat(val);

            if (!isNaN(numVal)) {
                evaluationValues.push(numVal);
                hasData = true;
            } else {
                evaluationValues.push(null);
            }
        }

        if (hasData) {
            groupedData[key].responses.push(evaluationValues);
            groupedData[key].langs[isEnglish ? 'en' : 'es']++;
        }

        // Extracción de Comentarios
        if (isMeaningfulComment(row[commentCol])) groupedData[key].comments.push(row[commentCol].toString().trim());
        if (isMeaningfulComment(row[commentCol + 1])) groupedData[key].commentsCourse.push(row[commentCol + 1].toString().trim());
    });

    return groupedData;
}

/**
 * Calcula estadísticas globales (semestrales) para comparación.
 * NOTA: Solo considera dimensiones de DOCENCIA para el promedio global.
 */
function calculateSemesterStats(groupedData) {
    const allDimensionValues = {};

    CONFIG.DIMENSIONS.forEach((_, index) => allDimensionValues[index] = []);

    // Aplanar todos los valores
    Object.values(groupedData).forEach(course => {
        course.responses.forEach(response => {
            response.forEach((val, index) => {
                if (val !== null && index < CONFIG.DIMENSIONS.length) {
                    allDimensionValues[index].push(val);
                }
            });
        });
    });

    // Calcular medias
    const semesterMeans = {};
    let totalSum = 0;
    let totalCount = 0;

    Object.keys(allDimensionValues).forEach(index => {
        const values = allDimensionValues[index];
        if (values.length > 0) {
            const mean = values.reduce((a, b) => a + b, 0) / values.length;
            semesterMeans[CONFIG.DIMENSIONS[index]] = mean;

            // Solo sumar a la media global si es dimensión docente
            if (parseInt(index) < CONFIG.TEACHING_DIMENSIONS_COUNT) {
                totalSum += values.reduce((a, b) => a + b, 0);
                totalCount += values.length;
            }
        } else {
            semesterMeans[CONFIG.DIMENSIONS[index]] = null;
        }
    });

    return {
        n: Object.values(groupedData).reduce((a, c) => a + c.responses.length, 0),
        meansByDimension: semesterMeans,
        globalMean: totalCount > 0 ? totalSum / totalCount : null
    };
}

/**
 * Calcula estadísticas detalladas para un curso específico.
 */
function calculateCourseStats(courseData) {
    const dimensionStats = {};
    const allMeans = [];

    for (let i = 0; i < CONFIG.DIMENSIONS.length; i++) {
        const values = [];
        courseData.responses.forEach(resp => {
            if (resp[i] !== null) values.push(resp[i]);
        });

        if (values.length === 0) {
            dimensionStats[i] = { mean: 0, agreement: 0, n: 0, dist: [0, 0, 0, 0, 0] };
            continue;
        }

        const sum = values.reduce((a, b) => a + b, 0);
        const mean = sum / values.length;
        const dist = distribution(values);
        const agreement = Math.round((values.filter(v => v >= 4).length / values.length) * 100);

        dimensionStats[i] = { mean, agreement, n: values.length, dist };

        // Acumular para media general (Solo Docencia)
        if (i < CONFIG.TEACHING_DIMENSIONS_COUNT) {
            allMeans.push(mean);
        }
    }

    const generalMean = allMeans.length > 0 ? allMeans.reduce((a, b) => a + b, 0) / allMeans.length : 0;

    return { dimensions: dimensionStats, generalMean };
}


/* ==========================================================================
   5. GENERACIÓN DE DOCUMENTOS
   ========================================================================== */

/**
 * Genera el documento Google Doc final aplicando el tema y estructura.
 * Secciones: resumen · resultados por bloque · análisis · retroalimentación cualitativa ·
 * nota metodológica.
 */
const TABLE_WIDTHS = [175, 40, 40, 38, 40, 80, 74]; // suma 487 pt (carta con márgenes de 54 pt)

function createReportDoc(courseData, semesterStats, folder, logoBlob) {
    const doc = DocumentApp.create(`Informe - ${courseData.professor} - ${courseData.course}`);
    const docId = doc.getId();
    try {
        const body = doc.getBody();
        DriveApp.getFileById(docId).moveTo(folder);

    const C = THEME.COLORS, S = THEME.STYLES;
    const n = courseData.responses.length;
    const stats = calculateCourseStats(courseData);
    body.setMarginLeft(54).setMarginRight(54).setMarginTop(54).setMarginBottom(54);

    // --- Encabezado y pie ---
    const header = doc.addHeader();
    if (logoBlob) {
        const img = header.appendImage(logoBlob);
        const w = 240;
        const h = (img.getHeight() * w) / img.getWidth(); // calcular ANTES de cambiar el ancho
        img.setWidth(w).setHeight(h);
        img.getParent().asParagraph().setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    }
    header.appendParagraph("PONTIFICIA UNIVERSIDAD CATÓLICA DE VALPARAÍSO\nDIRECCIÓN GENERAL DE ASUNTOS INTERNACIONALES\nCENTRO DE ESPAÑOL LENGUA EXTRANJERA")
        .setAttributes(S.NORMAL).setFontSize(8).setAlignment(DocumentApp.HorizontalAlignment.CENTER).setBold(true).setForegroundColor(C.PRIMARY);

    const footer = doc.addFooter();
    footer.appendParagraph(`${getPeriodLabel_()} · Documento confidencial de uso institucional`)
        .setAttributes(S.NORMAL).setFontSize(8).setForegroundColor(C.TEXT_LIGHT)
        .setAlignment(DocumentApp.HorizontalAlignment.CENTER);

    // --- Franja "grilla" Centenario + título ---
    addGrillaStrip_(body);
    body.appendParagraph("INFORME DE EVALUACIÓN DOCENTE").setAttributes(S.TITLE).setSpacingBefore(10);
    body.appendParagraph(getPeriodLabel_()).setAttributes(S.NORMAL)
        .setAlignment(DocumentApp.HorizontalAlignment.CENTER).setForegroundColor(C.SECONDARY).setBold(true);

    // --- Ficha ---
    const langs = courseData.langs || { es: 0, en: 0 };
    const meta = [
        ["Profesor/a", courseData.professor],
        ["Curso", courseData.course],
        ["Respuestas recibidas", `${n} (${langs.es} en español, ${langs.en} en inglés)`],
        ["Fecha de emisión", Utilities.formatDate(new Date(), "America/Santiago", "dd-MM-yyyy")]
    ];
    const metaTable = body.appendTable(meta);
    metaTable.setBorderColor("#d9d2cc").setBorderWidth(0.5).setColumnWidth(0, 130).setColumnWidth(1, 357);
    for (let r = 0; r < meta.length; r++) {
        for (let c = 0; c < 2; c++) {
            const cell = metaTable.getCell(r, c).setPaddingTop(3).setPaddingBottom(3);
            const p = cellPara_(cell).setAttributes(S.NORMAL);
            if (c === 0) { cell.setBackgroundColor(C.BG_HEADER); p.setBold(true).setForegroundColor(C.PRIMARY); }
        }
    }

    // --- Datos por dimensión ---
    const rows = [];
    const items = []; // solo dimensiones de docencia, para el análisis
    const counts = { ABOVE: 0, EQUAL: 0, BELOW: 0, ATTENTION: 0 };
    let idx = 0;
    CONFIG.BLOCKS.forEach(b => {
        rows.push({ type: 'block', title: b.title });
        for (let k = 0; k < b.count; k++, idx++) {
            const i = idx, name = CONFIG.DIMENSIONS[i], s = stats.dimensions[i];
            const isSelf = i >= CONFIG.TEACHING_DIMENSIONS_COUNT;
            const sem = semesterStats.meansByDimension[name];
            if (!s || s.n === 0) {
                const na = isNotApplicable(courseData.course, i);
                rows.push({ type: 'dim', cells: [name, "—", na ? "—" : fmt(sem), "—", "—", "—", na ? "No aplica" : "Sin datos"], level: null });
                continue;
            }
            const level = classifyDimension(s.mean, sem, isSelf);
            const dif = sem == null ? 0 : diffRounded(s.mean, sem);
            const difStr = sem == null ? "—" : fmtDiff(dif);
            rows.push({
                type: 'dim', level, cells: [name, fmt(s.mean), fmt(sem), difStr,
                    s.agreement + "%", s.dist.join(" · "), THEME.LEVELS[level].label]
            });
            if (!isSelf) { counts[level]++; items.push({ name, mean: s.mean, diff: dif, level }); }
        }
    });

    // --- 1. Resumen ---
    body.appendParagraph("1. RESUMEN").setAttributes(S.H1);
    const box = body.appendTable([[""]]);
    const boxCell = box.getCell(0, 0).setBackgroundColor(C.BG_HEADER).setPaddingTop(8).setPaddingBottom(8).setPaddingLeft(10).setPaddingRight(10);
    const boxHead = cellPara_(boxCell);
    boxHead.setText(`Media general docente: ${fmt(stats.generalMean)}   |   Media general del semestre: ${fmt(semesterStats.globalMean)}   |   Respuestas: ${n}`);
    boxHead.setAttributes(S.NORMAL).setBold(true).setForegroundColor(C.PRIMARY);
    boxCell.appendParagraph(buildSummaryText(n, stats.generalMean, semesterStats.globalMean, counts, items.length))
        .setAttributes(S.NORMAL).setAlignment(DocumentApp.HorizontalAlignment.JUSTIFY).setSpacingBefore(4);

    // --- 2. Análisis ---
    body.appendParagraph("2. ANÁLISIS COMPARATIVO").setAttributes(S.H1);
    addBulletGroup_(body, "Fortalezas (sobre la media semestral)", C.POSITIVE,
        items.filter(d => d.level === 'ABOVE').sort((a, b) => b.diff - a.diff).slice(0, 3),
        "Ninguna dimensión supera la media semestral en 0,2 puntos o más.");
    addBulletGroup_(body, "Aspectos que requieren atención (bajo 4,0)", C.NEGATIVE,
        items.filter(d => d.level === 'ATTENTION').sort((a, b) => a.mean - b.mean),
        "Ninguna dimensión se ubica bajo 4,0.");
    addBulletGroup_(body, "Aspectos a observar (bajo la media semestral, sobre 4,0)", C.TEXT_MAIN,
        items.filter(d => d.level === 'BELOW').sort((a, b) => a.diff - b.diff).slice(0, 3),
        "Ninguna dimensión se ubica claramente bajo la media semestral.");

    // --- 3. Resultados (detalle) ---
    body.appendPageBreak(); // la tabla completa va en su propia página
    body.appendParagraph("3. RESULTADOS CUANTITATIVOS (DETALLE)").setAttributes(S.H1);
    buildResultsTable_(body, rows);
    body.appendParagraph("Escala: 1 = Totalmente en desacuerdo · 2 = En desacuerdo · 3 = Neutral · 4 = De acuerdo · 5 = Totalmente de acuerdo. " +
        "Nivel: Sobre la media (≥ +0,2 respecto del semestre) · En la media (±0,2) · Bajo la media (≤ −0,2) · Requiere atención (< 4,0). " +
        "% Acuerdo: respuestas 4 o 5. Respuestas 1·2·3·4·5: cuántas personas marcaron cada valor. La autoevaluación se compara con el semestre, pero no tiene umbral de atención.")
        .setAttributes(S.NORMAL).setFontSize(8).setForegroundColor(C.TEXT_LIGHT).setItalic(false).setSpacingBefore(4);

    // --- 4. Retroalimentación cualitativa ---
    body.appendParagraph("4. RETROALIMENTACIÓN CUALITATIVA").setAttributes(S.H1);
    body.appendParagraph("Comentarios del estudiantado reproducidos textualmente y sin identificar a quien los escribió. Se sugiere buscar patrones que se repitan, más que comentarios aislados, y distinguir lo accionable de lo descriptivo.")
        .setAttributes(S.NORMAL).setItalic(true).setFontSize(9);
    addCommentGroup_(body, "4.1. Comentarios dirigidos al profesor/a", courseData.comments);
    addCommentGroup_(body, "4.2. Comentarios sobre la asignatura", courseData.commentsCourse || []);

    // --- Nota metodológica ---
    body.appendParagraph("NOTA METODOLÓGICA").setAttributes(S.H2);
    body.appendParagraph(`Fuente: encuesta de evaluación de cursos aplicada a estudiantes (escala 1 a 5), ${getPeriodLabel_()}. ` +
        `La media semestral agrupa las respuestas de todos los cursos evaluados (n = ${semesterStats.n}). ` +
        `Con menos de ${CONFIG.THRESHOLDS.MIN_RESPONSES} respuestas los resultados son indicativos: una sola respuesta puede mover mucho la media. ` +
        "La percepción estudiantil es una fuente de información entre otras; se recomienda complementarla con observación de clases y revisión de materiales. " +
        "Este documento es confidencial y de uso formativo.")
        .setAttributes(S.NORMAL).setFontSize(8).setForegroundColor(C.TEXT_LIGHT).setAlignment(DocumentApp.HorizontalAlignment.JUSTIFY);

        // --- Firma ---
        body.appendParagraph("\n").setAttributes(S.NORMAL);
        body.appendParagraph(CONFIG.SIGNATURE).setAttributes(S.NORMAL).setAlignment(DocumentApp.HorizontalAlignment.RIGHT);

        doc.saveAndClose();
        return docId;
    } catch (e) {
        try { DriveApp.getFileById(docId).setTrashed(true); } catch (_) {}
        throw e;
    }
}

/** Primer párrafo de una celda; lo crea si la celda vacía no lo trae como párrafo. */
function cellPara_(cell) {
    const ch = cell.getNumChildren() ? cell.getChild(0) : null;
    const p = ch && ch.getType() === DocumentApp.ElementType.PARAGRAPH ? ch.asParagraph() : null;
    return p || cell.insertParagraph(0, "");
}

/** Franja de colores de la grilla del Centenario (una fila, celdas coloreadas). */
function addGrillaStrip_(body) {
    const colors = THEME.COLORS.GRILLA;
    const t = body.appendTable([colors.map(() => "")]);
    t.setBorderWidth(0);
    colors.forEach((col, i) => {
        t.setColumnWidth(i, 487 / colors.length);
        const cell = t.getCell(0, i).setBackgroundColor(col).setPaddingTop(0).setPaddingBottom(0).setPaddingLeft(0).setPaddingRight(0);
        cellPara_(cell).setFontSize(4).setSpacingBefore(0).setSpacingAfter(0);
    });
}

/** Tabla de resultados con filas de bloque y chip de nivel en la última columna. */
function buildResultsTable_(body, rows) {
    const C = THEME.COLORS, S = THEME.STYLES;
    const headers = ["Dimensión", "Media\ncurso", "Media\nsem.", "Dif.", "%\nAcuerdo", "Respuestas\n1·2·3·4·5", "Nivel"];
    const table = body.appendTable([headers].concat(rows.map(r => r.type === 'block' ? [r.title, "", "", "", "", "", ""] : r.cells)));
    table.setBorderColor("#d9d2cc").setBorderWidth(0.5);
    TABLE_WIDTHS.forEach((w, i) => table.setColumnWidth(i, w));

    for (let r = 0; r < table.getNumRows(); r++) {
        const row = rows[r - 1];
        for (let c = 0; c < headers.length; c++) {
            const cell = table.getCell(r, c).setPaddingTop(3).setPaddingBottom(3).setPaddingLeft(4).setPaddingRight(4);
            const p = cellPara_(cell);
            p.setAttributes(c === 0 ? S.TABLE_CELL_LEFT : S.TABLE_CELL_CENTER).setFontSize(9);
            if (r === 0) {
                cell.setBackgroundColor(C.PRIMARY);
                p.setAttributes(S.TABLE_HEADER).setForegroundColor("#ffffff").setFontSize(9);
            } else if (row.type === 'block') {
                cell.setBackgroundColor(C.BG_HEADER);
                p.setBold(true).setForegroundColor(C.PRIMARY);
            } else if (c === headers.length - 1 && row.level) {
                const L = THEME.LEVELS[row.level];
                cell.setBackgroundColor(L.bg);
                p.setForegroundColor(L.fg).setBold(true).setFontSize(8);
            }
        }
    }
}

function addBulletGroup_(body, title, color, list, emptyText) {
    body.appendParagraph(title).setAttributes(THEME.STYLES.NORMAL).setBold(true).setForegroundColor(color).setSpacingBefore(6);
    if (list.length === 0) {
        body.appendParagraph(emptyText).setAttributes(THEME.STYLES.NORMAL).setIndentStart(18);
        return;
    }
    list.forEach(d => body.appendListItem(`${d.name} (${fmt(d.mean)}; ${fmtDiff(d.diff)} vs. semestre)`).setAttributes(THEME.STYLES.NORMAL));
}

function addCommentGroup_(body, title, comments) {
    body.appendParagraph(title).setAttributes(THEME.STYLES.H2);
    if (!comments.length) {
        body.appendParagraph("No se registraron comentarios.").setAttributes(THEME.STYLES.NORMAL);
        return;
    }
    const MAX = 12;
    comments.slice(0, MAX).forEach(c => body.appendListItem(`“${c}”`).setAttributes(THEME.STYLES.NORMAL));
    if (comments.length > MAX) {
        body.appendParagraph(`… y ${comments.length - MAX} comentarios más (disponibles en la hoja de respuestas).`).setAttributes(THEME.STYLES.NORMAL).setItalic(true);
    }
}

/**
 * Registra el reporte generado en la hoja "Registro_Reportes".
 */
function logReportGenerated(professor, course, docId, folderUrl) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("Registro_Reportes");

    // Crear hoja si no existe (Manejo de concurrencia simple)
    if (!sheet) {
        try {
            sheet = ss.insertSheet("Registro_Reportes");
            sheet.appendRow(["Timestamp", "Profesor", "Curso", "ID Archivo", "URL Archivo", "Estado Envío", "Mensaje Log"]);
            sheet.setFrozenRows(1);
            sheet.getRange(1, 1, 1, 7).setFontWeight("bold").setBackground("#ece5e0");
        } catch (e) {
            // Si falla insertSheet, probablemente ya existe (race condition rara o error de nombre)
            sheet = ss.getSheetByName("Registro_Reportes");
        }
    }

    if (sheet) {
        const fileUrl = `https://docs.google.com/document/d/${docId}/edit`;
        sheet.appendRow([new Date(), professor, course, docId, fileUrl, "PENDIENTE", ""]);
    } else {
        throw new Error("No se pudo acceder a la hoja Registro_Reportes");
    }
}

/**
 * Una fila por curso/profesor con las métricas para decidir dónde enfocarse, ordenadas por prioridad.
 * Función pura (sin servicios de Google): se prueba con `node test/run.js`.
 */
function buildSummaryRows(processedData, semesterStats) {
    const rows = Object.keys(processedData).map(key => {
        const c = processedData[key];
        const stats = calculateCourseStats(c);
        let att = 0, below = 0, agreeNum = 0, agreeDen = 0, lowest = null;
        for (let i = 0; i < CONFIG.TEACHING_DIMENSIONS_COUNT; i++) {
            const s = stats.dimensions[i];
            if (!s || s.n === 0) continue;
            const name = CONFIG.DIMENSIONS[i];
            const level = classifyDimension(s.mean, semesterStats.meansByDimension[name], false);
            if (level === 'ATTENTION') att++; else if (level === 'BELOW') below++;
            agreeNum += s.agreement * s.n;
            agreeDen += s.n;
            if (!lowest || s.mean < lowest.mean) lowest = { name, mean: s.mean };
        }
        const diff = diffRounded(stats.generalMean, semesterStats.globalMean);
        return {
            professor: c.professor, course: c.course, n: c.responses.length,
            mean: stats.generalMean, diff, att, below, lowest,
            agreement: agreeDen ? agreeNum / agreeDen / 100 : null,
            comments: c.comments.length + c.commentsCourse.length,
            reliable: c.responses.length >= CONFIG.THRESHOLDS.MIN_RESPONSES,
            priority: priorityOf(att, diff),
            dims: CONFIG.DIMENSIONS.map((_, i) => (stats.dimensions[i] && stats.dimensions[i].n ? stats.dimensions[i].mean : null))
        };
    });
    return rows.sort(compareSummary);
}

/** Genera/actualiza la hoja "Resumen_Comparativo" (se reescribe completa cada vez). */
function generateComparativeSummary() {
    const ui = SpreadsheetApp.getUi();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const src = getResponsesSheet_();
    if (!src) { ui.alert('⚠️ No encontré la hoja de respuestas.'); return; }

    const processed = processData(src.getDataRange().getValues());
    if (Object.keys(processed).length === 0) {
        ui.alert(`⚠️ No se encontró ninguna respuesta válida en la hoja "${src.getName()}".`);
        return;
    }
    const sem = calculateSemesterStats(processed);
    const rows = buildSummaryRows(processed, sem);
    const dims = CONFIG.DIMENSIONS;

    const header = ["Prioridad", "Profesor/a", "Curso", "Respuestas", "Media docente", "Dif. vs semestre", "% Acuerdo",
        "Dim. en atención (< 4,0)", "Dim. bajo la media", "Dimensión más baja", "Media más baja", "Comentarios", "Confiabilidad"].concat(dims);
    const FIXED = 13;
    const semRow = ["—", "MEDIA DEL SEMESTRE", "", sem.n, sem.globalMean, "", "", "", "", "", "", "", ""]
        .concat(dims.map(d => sem.meansByDimension[d] == null ? "" : sem.meansByDimension[d]));
    const body = rows.map(r => [r.priority, r.professor, r.course, r.n, r.mean, r.diff, r.agreement == null ? "" : r.agreement,
        r.att, r.below, r.lowest ? r.lowest.name : "", r.lowest ? r.lowest.mean : "", r.comments,
        r.reliable ? "Suficiente" : `Indicativo (n < ${CONFIG.THRESHOLDS.MIN_RESPONSES})`]
        .concat(r.dims.map(v => (v == null ? "" : v))));
    const all = [header, semRow].concat(body);

    const sheet = ss.getSheetByName(CONFIG.SHEET_SUMMARY) || ss.insertSheet(CONFIG.SHEET_SUMMARY);
    sheet.clear();
    sheet.clearConditionalFormatRules();
    sheet.getRange(1, 1, all.length, header.length).setValues(all);

    // Formato
    const C = THEME.COLORS;
    const nCols = header.length, nRows = all.length;
    sheet.getRange(1, 1, 1, nCols).setFontWeight("bold").setFontColor("#ffffff").setBackground(C.PRIMARY)
        .setWrap(true).setVerticalAlignment("middle").setHorizontalAlignment("center");
    sheet.getRange(2, 1, 1, nCols).setFontWeight("bold").setBackground(C.BG_HEADER);
    sheet.setRowHeight(1, 120);
    sheet.setFrozenRows(2);
    sheet.setFrozenColumns(3);
    sheet.setColumnWidth(1, 80); sheet.setColumnWidth(2, 170); sheet.setColumnWidth(3, 260);
    sheet.setColumnWidths(4, 3, 80); sheet.setColumnWidth(7, 80); sheet.setColumnWidths(8, 2, 95);
    sheet.setColumnWidth(10, 260); sheet.setColumnWidth(11, 80); sheet.setColumnWidth(12, 90); sheet.setColumnWidth(13, 130);
    sheet.setColumnWidths(FIXED + 1, dims.length, 95);
    if (nRows > 1) {
        sheet.getRange(2, 5, nRows - 1, 1).setNumberFormat("0.0");
        sheet.getRange(3, 6, Math.max(nRows - 2, 1), 1).setNumberFormat("+0.0;-0.0;0.0");
        sheet.getRange(3, 7, Math.max(nRows - 2, 1), 1).setNumberFormat("0%");
        sheet.getRange(2, 11, nRows - 1, 1).setNumberFormat("0.0");
        sheet.getRange(2, FIXED + 1, nRows - 1, dims.length).setNumberFormat("0.0").setHorizontalAlignment("center");
        sheet.getRange(2, 4, nRows - 1, 4).setHorizontalAlignment("center");
    }
    sheet.getRange(1, 1).setNote(
        "Alta: " + CONFIG.THRESHOLDS.ATTENTION_HIGH + " o más dimensiones bajo " + CONFIG.THRESHOLDS.CRITICAL +
        ", o media docente " + CONFIG.THRESHOLDS.DIFF_HIGH + " o más bajo el semestre.\n" +
        "Media: 1 dimensión bajo " + CONFIG.THRESHOLDS.CRITICAL + ", o media docente " + CONFIG.THRESHOLDS.BAND + " o más bajo el semestre.\n" +
        "Baja: el resto. Con menos de " + CONFIG.THRESHOLDS.MIN_RESPONSES + " respuestas los resultados son solo indicativos.\n" +
        "Esta hoja se regenera completa cada vez; no escribas datos aquí.");

    // Colores condicionales
    const rules = [];
    const prio = sheet.getRange(3, 1, Math.max(nRows - 2, 1), 1);
    [["Alta", "#e73a34", "#ffffff"], ["Media", "#f4ce46", "#333333"], ["Baja", "#a3d1e3", "#24588d"]].forEach(([t, bg, fg]) =>
        rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(t).setBackground(bg).setFontColor(fg).setBold(true).setRanges([prio]).build()));
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextStartsWith("Indicativo").setBackground("#ece5e0").setFontColor("#e73a34")
        .setRanges([sheet.getRange(3, 13, Math.max(nRows - 2, 1), 1)]).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberLessThan(0).setFontColor("#e73a34")
        .setRanges([sheet.getRange(3, 6, Math.max(nRows - 2, 1), 1)]).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule()
        .setGradientMinpointWithValue("#ee7269", SpreadsheetApp.InterpolationType.NUMBER, "3")
        .setGradientMidpointWithValue("#ffffff", SpreadsheetApp.InterpolationType.NUMBER, "4")
        .setGradientMaxpointWithValue("#36a9e1", SpreadsheetApp.InterpolationType.NUMBER, "5")
        .setRanges([sheet.getRange(3, FIXED + 1, Math.max(nRows - 2, 1), dims.length), sheet.getRange(3, 5, Math.max(nRows - 2, 1), 1)]).build());
    sheet.setConditionalFormatRules(rules);

    sheet.activate();
    const count = { Alta: 0, Media: 0, Baja: 0 };
    rows.forEach(r => count[r.priority]++);
    ui.alert(`✅ Resumen comparativo actualizado (${rows.length} cursos).\n\nPrioridad Alta: ${count.Alta}\nMedia: ${count.Media}\nBaja: ${count.Baja}\n\nHoja: "${CONFIG.SHEET_SUMMARY}"`);
}

/**
 * Exporta a PDF (desde Google Docs, con Roboto incrustada) los informes de "Registro_Reportes".
 * Deja los PDF en una subcarpeta "PDF" junto a cada Doc y guarda el enlace en la columna H.
 * Se puede repetir: salta los que ya tienen enlace (para regenerar uno, borra su celda de la columna H).
 */
function exportReportsToPdf() {
    const ui = SpreadsheetApp.getUi();
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) { ui.alert('⚠️ Ya hay un proceso en curso. Espera a que termine.'); return; }
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EMAIL_CONFIG.SHEET_LOG);
        if (!sheet || sheet.getLastRow() < 2) { ui.alert('⚠️ No hay informes en "Registro_Reportes". Genera los reportes primero.'); return; }

        const COL_PDF = 7; // columna H (0-based)
        const headerCell = sheet.getRange(1, COL_PDF + 1);
        if (!headerCell.getValue()) headerCell.setValue("URL PDF").setFontWeight("bold").setBackground("#ece5e0");

        const rows = sheet.getDataRange().getValues();
        const t0 = Date.now();
        const pdfFolders = {};
        let made = 0, done = 0, pending = 0;
        const errors = [];

        for (let i = 1; i < rows.length; i++) {
            const docId = rows[i][EMAIL_CONFIG.COL_LOG_DOC_ID];
            if (!docId) continue;
            if (rows[i][COL_PDF]) { done++; continue; }
            if (Date.now() - t0 > 270000) { pending++; continue; } // el límite de Apps Script es 6 min
            try {
                const file = DriveApp.getFileById(docId);
                const parent = file.getParents().next();
                const pid = parent.getId();
                if (!pdfFolders[pid]) {
                    const it = parent.getFoldersByName("PDF");
                    pdfFolders[pid] = it.hasNext() ? it.next() : parent.createFolder("PDF");
                }
                const pdf = pdfFolders[pid].createFile(file.getAs(MimeType.PDF).setName(file.getName() + ".pdf"));
                sheet.getRange(i + 1, COL_PDF + 1).setValue(pdf.getUrl());
                made++;
            } catch (e) {
                console.error(`Error exportando PDF de ${rows[i][EMAIL_CONFIG.COL_LOG_PROFESSOR]}: ${e.message}`);
                errors.push(`${rows[i][EMAIL_CONFIG.COL_LOG_PROFESSOR]}|${rows[i][EMAIL_CONFIG.COL_LOG_COURSE]}: ${e.message}`);
            }
        }

        ui.alert(`${errors.length || pending ? '⚠️' : '✅'} Exportación a PDF\n\nNuevos: ${made}\nYa exportados antes: ${done}` +
            (pending ? `\nPendientes (se acabó el tiempo): ${pending}. Vuelve a ejecutar.` : '') +
            (errors.length ? `\nErrores: ${errors.length}\n${errors.join('\n')}` : '') +
            `\n\nLos PDF están en la subcarpeta "PDF" de la carpeta de reportes.`);
    } catch (e) {
        console.error("Error fatal exportando PDF:", e);
        ui.alert(`❌ Error crítico: ${e.message}`);
    } finally {
        lock.releaseLock();
    }
}

/**
 * Agrega un párrafo con formato "Etiqueta: Valor".
 */
function addLabelValue(body, label, value) {
    const p = body.appendParagraph(label);
    p.setAttributes(THEME.STYLES.LABEL);
    p.appendText(value).setAttributes(THEME.STYLES.NORMAL);
}
