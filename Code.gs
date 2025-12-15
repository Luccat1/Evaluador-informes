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
    COL_COURSE: 2,    // "Seleccione su curso..."
    COL_PROFESSOR: 3, // "Seleccione su profesor..."
    COL_LANG: 4,      // "¿Deseas responder en español o en inglés?..."

    // --- Configuración de Preguntas (Español) ---
    // Ajustar si cambian las columnas en el formulario
    COL_START_SPANISH: 5,    // Primera pregunta de escala
    COL_COMMENT_SPANISH: 24, // Pregunta abierta de comentarios

    // --- Configuración de Preguntas (Inglés) ---
    COL_START_ENGLISH: 27,
    COL_COMMENT_ENGLISH: 46,

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

    // --- Referencias Estadísticas ---
    SEMESTER_MEANS: {
        DEFAULT: 3.4 // Valor por defecto si no hay suficientes datos para calcular la real
    },

    // --- Configuración de Archivos ---
    FILES: {
        LOGO_NAME: "logo_pucv_100.png", // Nombre del archivo de logo en Drive
        LOGO_URL: "https://comunicacionestrategica.pucv.cl/LOGO100/7/color.png" // URL de respaldo
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
        POSITIVE: "#008cba",   // Azul (Fortalezas)
        NEGATIVE: "#e73a34"    // Rojo (Oportunidades de mejora)
    },

    // --- Tipografía ---
    FONTS: {
        MAIN: "Arial"
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

    T.STYLES.TABLE_CELL_CENTER[A.FONT_SIZE] = 10;
    T.STYLES.TABLE_CELL_CENTER[A.FONT_FAMILY] = T.FONTS.MAIN;
    T.STYLES.TABLE_CELL_CENTER[A.HORIZONTAL_ALIGNMENT] = H.CENTER;
    T.STYLES.TABLE_CELL_CENTER[A.FOREGROUND_COLOR] = T.COLORS.TEXT_MAIN; // Forzar color texto
    T.STYLES.TABLE_CELL_CENTER[A.BOLD] = false; // Forzar no-negrita
})();


/* ==========================================================================
   3. LÓGICA PRINCIPAL (CORE)
   ========================================================================== */

/**
 * Crea el menú en la hoja de cálculo al abrir el documento.
 */
function onOpen() {
    SpreadsheetApp.getUi()
        .createMenu('Evaluación Docente')
        .addItem('📊 Generar Reportes', 'generateReports')
        .addToUi();
}

/**
 * Función orquestadora principal.
 * 1. Lee datos. 2. Prepara carpetas/recursos. 3. Procesa estadísticas. 4. Genera Docs.
 */
function generateReports() {
    const ui = SpreadsheetApp.getUi();
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = sheet.getDataRange().getValues();

    if (data.length < 2) {
        ui.alert('⚠️ No hay suficientes datos para procesar.');
        return;
    }

    // 1. Preparar Entorno (Carpetas y Logo)
    const env = setupEnvironment();
    if (!env) return; // Error crítico en setup

    // 2. Procesar Datos
    const processedData = processData(data);

    // 3. Calcular Estadísticas Globales (Semestre)
    const semesterStats = calculateSemesterStats(processedData);

    // 4. Generar Reportes Individuales
    let count = 0;
    for (const key in processedData) {
        const courseData = processedData[key];
        createReportDoc(courseData, semesterStats, env.folder, env.logoBlob);
        count++;
    }

    ui.alert(`✅ Proceso completado con éxito.\n\nSe generaron ${count} reportes en la carpeta:\n"${env.folder.getName()}"`);
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

    // Crear carpeta de reportes
    const folderName = `Reportes Evaluación Docente ${new Date().toLocaleDateString()}`;
    const folder = parentFolder.createFolder(folderName);

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

    responses.forEach(row => {
        const professor = row[CONFIG.COL_PROFESSOR];
        const course = row[CONFIG.COL_COURSE];
        const lang = row[CONFIG.COL_LANG];

        if (!professor || !course) return; // Saltar filas vacías

        const key = `${professor}|${course}`;

        if (!groupedData[key]) {
            groupedData[key] = {
                professor: professor,
                course: course,
                responses: [],
                comments: []
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
            const val = row[startCol + i];
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
        }

        // Extracción de Comentarios
        const comment = row[commentCol];
        if (comment && comment.toString().trim().length > 2) {
            groupedData[key].comments.push(comment.toString().trim());
        }
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
            semesterMeans[CONFIG.DIMENSIONS[index]] = CONFIG.SEMESTER_MEANS.DEFAULT;
        }
    });

    return {
        meansByDimension: semesterMeans,
        globalMean: totalCount > 0 ? totalSum / totalCount : CONFIG.SEMESTER_MEANS.DEFAULT
    };
}

/**
 * Calcula estadísticas detalladas para un curso específico.
 */
function calculateCourseStats(courseData) {
    const dimensionStats = {};
    const allMeans = [];
    const allStds = [];

    for (let i = 0; i < CONFIG.DIMENSIONS.length; i++) {
        const values = [];
        courseData.responses.forEach(resp => {
            if (resp[i] !== null) values.push(resp[i]);
        });

        if (values.length === 0) {
            dimensionStats[i] = { mean: 0, median: 0, std: 0, agreement: 0, n: 0 };
            continue;
        }

        // Cálculos Estadísticos
        const sum = values.reduce((a, b) => a + b, 0);
        const mean = sum / values.length;

        const squareDiffs = values.map(v => Math.pow(v - mean, 2));
        const std = Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / values.length);

        values.sort((a, b) => a - b);
        const mid = Math.floor(values.length / 2);
        const median = values.length % 2 !== 0 ? values[mid] : (values[mid - 1] + values[mid]) / 2;

        const agreement = Math.round((values.filter(v => v >= 4).length / values.length) * 100);

        dimensionStats[i] = { mean, median, std, agreement, n: values.length };

        // Acumular para media general (Solo Docencia)
        if (i < CONFIG.TEACHING_DIMENSIONS_COUNT) {
            allMeans.push(mean);
            allStds.push(std);
        }
    }

    const generalMean = allMeans.length > 0 ? allMeans.reduce((a, b) => a + b, 0) / allMeans.length : 0;
    const generalStd = allStds.length > 0 ? allStds.reduce((a, b) => a + b, 0) / allStds.length : 0;

    return { dimensions: dimensionStats, generalMean, generalStd };
}


/* ==========================================================================
   5. GENERACIÓN DE DOCUMENTOS
   ========================================================================== */

/**
 * Genera el documento Google Doc final aplicando el tema y estructura.
 */
function createReportDoc(courseData, semesterStats, folder, logoBlob) {
    const docName = `Informe - ${courseData.professor} - ${courseData.course}`;
    const doc = DocumentApp.create(docName);
    const body = doc.getBody();

    // Mover a carpeta
    DriveApp.getFileById(doc.getId()).moveTo(folder);

    // --- 1. ENCABEZADO ---
    const header = doc.addHeader();
    if (logoBlob) {
        const img = header.appendImage(logoBlob);
        // Ajuste de tamaño proporcional (ancho base 450px)
        const newWidth = 450;
        const newHeight = (img.getHeight() * newWidth) / img.getWidth();
        img.setWidth(newWidth).setHeight(newHeight);
        header.appendParagraph("").setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    }

    // Texto Institucional (Siempre visible)
    const pInst = header.appendParagraph("PONTIFICIA UNIVERSIDAD CATÓLICA DE VALPARAÍSO\nDIRECCIÓN GENERAL DE ASUNTOS INTERNACIONALES\nCENTRO DE ESPAÑOL LENGUA EXTRANJERA");
    pInst.setAttributes(THEME.STYLES.NORMAL);
    pInst.setAlignment(DocumentApp.HorizontalAlignment.CENTER).setBold(true).setForegroundColor(THEME.COLORS.PRIMARY);

    body.appendParagraph("\nINFORME DE EVALUACIÓN DOCENTE").setAttributes(THEME.STYLES.TITLE);

    // --- 2. DATOS GENERALES ---
    addLabelValue(body, "Profesor: ", courseData.professor);
    addLabelValue(body, "Curso: ", courseData.course);
    addLabelValue(body, "Respuestas recibidas: ", courseData.responses.length.toString());

    // --- 3. RESULTADOS CUANTITATIVOS ---
    const stats = calculateCourseStats(courseData);

    body.appendParagraph("\n1. RESULTADOS CUANTITATIVOS").setAttributes(THEME.STYLES.H1);

    // 3.1 Tabla Docencia
    body.appendParagraph("1.1. Evaluación del Desempeño Docente").setAttributes(THEME.STYLES.H2);

    // Encabezados (Sin Desv. Est.)
    const teachingHeaders = ["Dimensión Evaluada", "Media Curso", "Media Semestral", "% Acuerdo", "Estado"];
    const table = body.appendTable([teachingHeaders]);

    // Estilar Encabezado
    const headerRow = table.getRow(0);
    for (let i = 0; i < headerRow.getNumCells(); i++) {
        const cell = headerRow.getCell(i);
        cell.setBackgroundColor(THEME.COLORS.BG_HEADER).setPaddingTop(4).setPaddingBottom(4);
        cell.getChild(0).asParagraph().setAttributes(THEME.STYLES.TABLE_HEADER);
    }

    const dimensionsAbove = [];
    const dimensionsBelow = [];

    for (let i = 0; i < CONFIG.TEACHING_DIMENSIONS_COUNT; i++) {
        const dim = CONFIG.DIMENSIONS[i];
        const s = stats.dimensions[i];
        if (!s) continue;

        const semMean = semesterStats.meansByDimension[dim] || CONFIG.SEMESTER_MEANS.DEFAULT;
        const isAbove = s.mean >= semMean;
        const comparison = isAbove ? "Sobre media" : "Bajo media";
        const rowColor = isAbove ? THEME.COLORS.POSITIVE : THEME.COLORS.NEGATIVE;

        if (isAbove) dimensionsAbove.push({ name: dim, mean: s.mean });
        else dimensionsBelow.push({ name: dim, mean: s.mean });

        const row = table.appendTableRow();

        // Celdas de datos
        const cells = [
            dim,
            s.mean.toFixed(1),
            semMean.toFixed(1),
            s.agreement + "%",
            comparison
        ];

        cells.forEach((text, index) => {
            const cell = row.appendTableCell(text);
            const p = cell.getChild(0).asParagraph();

            // Estilo base
            if (index === 0) {
                p.setAttributes(THEME.STYLES.TABLE_CELL_LEFT);
            } else {
                p.setAttributes(THEME.STYLES.TABLE_CELL_CENTER);
            }

            // Aplicar color condicional SOLO a la columna "Estado" (índice 4)
            if (index === 4) {
                p.setForegroundColor(rowColor);
                p.setBold(true); // Destacar el estado
            } else {
                p.setForegroundColor(THEME.COLORS.TEXT_MAIN);
                p.setBold(false);
            }
        });
    }

    // 3.2 Tabla Autoevaluación
    body.appendParagraph("\n1.2. Autopercepción del Estudiante").setAttributes(THEME.STYLES.H2);
    body.appendParagraph("Estas dimensiones reflejan la autoevaluación del estudiante sobre su propio desempeño y compromiso.")
        .setAttributes(THEME.STYLES.NORMAL).setItalic(true);

    const selfHeaders = ["Dimensión de Autoevaluación", "Media Curso", "% Acuerdo"];
    const tableSelf = body.appendTable([selfHeaders]);

    // Estilar Encabezado Autoevaluación
    const headerRowSelf = tableSelf.getRow(0);
    for (let i = 0; i < headerRowSelf.getNumCells(); i++) {
        const cell = headerRowSelf.getCell(i);
        cell.setBackgroundColor(THEME.COLORS.BG_HEADER).setPaddingTop(4).setPaddingBottom(4);
        cell.getChild(0).asParagraph().setAttributes(THEME.STYLES.TABLE_HEADER);
    }

    for (let i = CONFIG.TEACHING_DIMENSIONS_COUNT; i < CONFIG.DIMENSIONS.length; i++) {
        const s = stats.dimensions[i];
        if (!s) continue;

        const row = tableSelf.appendTableRow();
        const cells = [
            CONFIG.DIMENSIONS[i],
            s.mean.toFixed(1),
            s.agreement + "%"
        ];

        cells.forEach((text, index) => {
            const cell = row.appendTableCell(text);
            const p = cell.getChild(0).asParagraph();
            if (index === 0) p.setAttributes(THEME.STYLES.TABLE_CELL_LEFT);
            else p.setAttributes(THEME.STYLES.TABLE_CELL_CENTER);
        });
    }

    // 3.3 Resumen
    body.appendParagraph("\nResumen Estadístico (Desempeño Docente)").setAttributes(THEME.STYLES.H1);
    body.appendParagraph(`Media General Docente: ${stats.generalMean.toFixed(1)}  |  Media General Semestre: ${semesterStats.globalMean.toFixed(1)}`)
        .setAttributes(THEME.STYLES.NORMAL).setAlignment(DocumentApp.HorizontalAlignment.CENTER);

    // --- 4. ANÁLISIS COMPARATIVO ---
    body.appendParagraph("\n2. ANÁLISIS COMPARATIVO").setAttributes(THEME.STYLES.H1);

    // Fortalezas
    const pFort = body.appendParagraph("Fortalezas (Sobre media semestral):");
    pFort.setAttributes(THEME.STYLES.NORMAL).setBold(true).setForegroundColor(THEME.COLORS.POSITIVE);

    if (dimensionsAbove.length > 0) {
        dimensionsAbove.forEach(d => body.appendListItem(d.name).setAttributes(THEME.STYLES.NORMAL));
    } else {
        body.appendParagraph("Ninguna dimensión destaca sobre la media semestral.").setAttributes(THEME.STYLES.NORMAL).setIndentStart(18);
    }

    // Mejoras
    const pMej = body.appendParagraph("\nOportunidades de Mejora (Bajo media semestral):");
    pMej.setAttributes(THEME.STYLES.NORMAL).setBold(true).setForegroundColor(THEME.COLORS.NEGATIVE);

    if (dimensionsBelow.length > 0) {
        dimensionsBelow.forEach(d => body.appendListItem(d.name).setAttributes(THEME.STYLES.NORMAL));
    } else {
        body.appendParagraph("Todas las dimensiones están sobre o igual a la media semestral.").setAttributes(THEME.STYLES.NORMAL).setIndentStart(18);
    }

    // --- 5. COMENTARIOS ---
    body.appendParagraph("\n3. COMENTARIOS CUALITATIVOS").setAttributes(THEME.STYLES.H1);
    if (courseData.comments.length > 0) {
        courseData.comments.slice(0, 5).forEach(c => body.appendListItem(`"${c}"`).setAttributes(THEME.STYLES.NORMAL).setItalic(true));
        if (courseData.comments.length > 5) {
            body.appendParagraph(`... y ${courseData.comments.length - 5} comentarios más.`).setAttributes(THEME.STYLES.NORMAL);
        }
    } else {
        body.appendParagraph("No se registraron comentarios.").setAttributes(THEME.STYLES.NORMAL);
    }

    // --- 6. APRECIACIÓN GENERAL ---
    body.appendParagraph("\n4. APRECIACIÓN GENERAL").setAttributes(THEME.STYLES.H1);

    const percentAbove = (dimensionsAbove.length / CONFIG.TEACHING_DIMENSIONS_COUNT) * 100;
    let appreciation = "";

    if (percentAbove >= 80) appreciation = "El desempeño docente es EXCELENTE, situándose significativamente por encima del promedio semestral en la gran mayoría de las dimensiones.";
    else if (percentAbove >= 60) appreciation = "El desempeño docente es BUENO, superando el promedio semestral en la mayoría de las áreas evaluadas.";
    else if (percentAbove >= 40) appreciation = "El desempeño docente es REGULAR, con resultados mixtos comparados con el promedio semestral.";
    else appreciation = "El desempeño docente requiere ATENCIÓN, situándose por debajo del promedio semestral en varias dimensiones clave.";

    const appTable = body.appendTable([[appreciation]]);
    const appCell = appTable.getCell(0, 0);
    appCell.setBackgroundColor(THEME.COLORS.BG_HEADER).setPaddingTop(10).setPaddingBottom(10).setPaddingLeft(10).setPaddingRight(10);
    appCell.getChild(0).asParagraph().setAttributes(THEME.STYLES.NORMAL).setItalic(true).setAlignment(DocumentApp.HorizontalAlignment.JUSTIFY);

    // --- 7. FIRMA ---
    body.appendParagraph("\n\n\n").setAttributes(THEME.STYLES.NORMAL);
    const signature = body.appendParagraph("Luciano Cataldo\nCoordinación Académica\nCentro de Español Lengua Extranjera (CELE)\nDirección General de Asuntos Internacionales\nPontificia Universidad Católica de Valparaíso");
    signature.setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
    signature.setAttributes(THEME.STYLES.NORMAL);

    doc.saveAndClose();
}

/**
 * Agrega un párrafo con formato "Etiqueta: Valor".
 */
function addLabelValue(body, label, value) {
    const p = body.appendParagraph(label);
    p.setAttributes(THEME.STYLES.LABEL);
    p.appendText(value).setAttributes(THEME.STYLES.NORMAL);
}
