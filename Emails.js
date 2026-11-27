/**
 * 📧 MÓDULO DE ENVÍO DE CORREOS INSTITUCIONALES
 * ==============================================
 * 
 * Gestiona el envío masivo de informes a profesores y autoridades.
 * Funcionalidades clave:
 * - Lee la hoja "Registro_Reportes" para saber qué enviar.
 * - Cruza datos con la hoja "Directorio" para obtener destinatarios.
 * - Asigna permisos de LECTOR (Viewer) en los Docs de Google.
 * - Envía correos con formato HTML institucional.
 */

const EMAIL_CONFIG = {
    SHEET_LOG: "Registro_Reportes",
    SHEET_DIR: "Directorio",
    SHEET_CONFIG: "Configuración",
    SENDER_NAME: "Unidad de Evaluación Docente CELE", 
    SENDER_EMAIL: "cele.dgai@pucv.cl", // Cuenta delegada
    LOGO_URL: "https://comunicacionestrategica.pucv.cl/LOGO100/7/color.png",
    
    SUBJECT_TEMPLATE: (curso) => `Resultados Evaluación Docente: ${curso} - ${getPeriodLabel_()}`,
    
    // Columnas en 'Registro_Reportes' (0-based)
    COL_LOG_PROFESSOR: 1,
    COL_LOG_COURSE: 2,
    COL_LOG_DOC_ID: 3,
    COL_LOG_URL: 4,
    COL_LOG_STATUS: 5, // Columna F
    
    // Columnas en 'Directorio' (0-based)
    COL_DIR_NAME: 0,
    COL_DIR_EMAIL: 1,
    COL_DIR_CC: 2
};

/**
 * Función principal activada desde el menú.
 */
function launchEmailSender() {
    const ui = SpreadsheetApp.getUi();
    const response = ui.alert(
        'Confirmar Envío Masivo',
        'Se buscarán reportes en estado "PENDIENTE" y se enviarán a los correos registrados en la hoja "Directorio".\n\n¿Deseas continuar?',
        ui.ButtonSet.YES_NO
    );

    if (response !== ui.Button.YES) return;

    sendReportEmails();
}

/**
 * Proceso batch de envío de correos.
 */
// Cache para alias
let CACHED_ALIASES = null;

function getAliasesSafe_() {
    if (!CACHED_ALIASES) {
        try {
            CACHED_ALIASES = GmailApp.getAliases();
        } catch (e) {
            console.warn("No se pudieron obtener alias:", e);
            CACHED_ALIASES = [];
        }
    }
    return CACHED_ALIASES;
}

/**
 * Lee la lista global de correos en copia desde la hoja "Configuración".
 */
function getGlobalCcList_(ss) {
    const sheetCfg = ss.getSheetByName(EMAIL_CONFIG.SHEET_CONFIG);
    if (!sheetCfg) return [];
    const rows = sheetCfg.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
        const key = (rows[i][0] || '').toString().trim().toUpperCase();
        if (key === 'AUTHORITIES_CC') {
            return parseEmailList(rows[i][1]);
        }
    }
    return [];
}

const LOCK_TIMEOUT_MS = 30000; // 30 segundos de espera para el bloqueo

/**
 * Proceso batch de envío de correos.
 * Protegido contra ejecuciones concurrentes.
 */
function sendReportEmails() {
    const lock = LockService.getScriptLock();
    
    // Intentar adquirir el bloqueo
    try {
        if (!lock.tryLock(LOCK_TIMEOUT_MS)) {
            SpreadsheetApp.getUi().alert('⚠️ Error: Ya hay un proceso de envío en curso. Por favor espera a que termine.');
            return;
        }
    } catch (e) {
        console.error("Error al adquirir Lock:", e);
        SpreadsheetApp.getUi().alert('⚠️ Error de sistema al iniciar el proceso.');
        return;
    }

    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheetLog = ss.getSheetByName(EMAIL_CONFIG.SHEET_LOG);
        const sheetDir = ss.getSheetByName(EMAIL_CONFIG.SHEET_DIR);

        if (!sheetLog || !sheetDir) {
            SpreadsheetApp.getUi().alert('⚠️ Error: Falta la hoja "Registro_Reportes" o "Directorio".\nEjecuta primero la generación de reportes y crea la hoja de directorio.');
            return;
        }

        const logData = sheetLog.getDataRange().getValues();
        const dirData = sheetDir.getDataRange().getValues();
        const directoryMap = buildDirectoryMap(
            dirData,
            EMAIL_CONFIG.COL_DIR_NAME,
            EMAIL_CONFIG.COL_DIR_EMAIL,
            EMAIL_CONFIG.COL_DIR_CC
        );

        let sentCount = 0;
        let errorCount = 0;
        const globalCcList = getGlobalCcList_(ss);
        const userEmail = Session.getActiveUser().getEmail();

        // Iterar por registros
        for (let i = 1; i < logData.length; i++) {
            const row = logData[i];
            const status = row[EMAIL_CONFIG.COL_LOG_STATUS];

            if (status !== "PENDIENTE") continue;

            const professorName = row[EMAIL_CONFIG.COL_LOG_PROFESSOR];
            const courseName = row[EMAIL_CONFIG.COL_LOG_COURSE];
            const docId = row[EMAIL_CONFIG.COL_LOG_DOC_ID];
            const docUrl = row[EMAIL_CONFIG.COL_LOG_URL];

            // Buscar datos contacto (soporta múltiples profesores separados por coma)
            const resolved = resolveRecipients(professorName, directoryMap, globalCcList);

            if (!resolved.ok) {
                sheetLog.getRange(i + 1, EMAIL_CONFIG.COL_LOG_STATUS + 1).setValue("ERROR: Email no encontrado");
                sheetLog.getRange(i + 1, EMAIL_CONFIG.COL_LOG_STATUS + 2).setValue(
                    resolved.missing.length ? `Falta en Directorio: ${resolved.missing.join(", ")}` : "Sin correo válido"
                );
                errorCount++;
                continue;
            }

            try {
                const toList = resolved.toEmails;
                const finalCcList = resolved.ccEmails;

                // 1. Dar Permisos de Lectura (Silencioso)
                toList.forEach(email => addViewerSilently_(docId, email)); // Profesores
                finalCcList.forEach(email => addViewerSilently_(docId, email)); // Copias

                // 2. Construir y Enviar Correo
                const htmlBody = getEmailTemplate(professorName, courseName, docUrl);
                
                const emailOptions = {
                    htmlBody: htmlBody,
                    name: EMAIL_CONFIG.SENDER_NAME,
                    bcc: userEmail // Copia oculta trazabilidad
                };

                if (finalCcList.length > 0) {
                    emailOptions.cc = finalCcList.join(",");
                }

                // Usar Alias si corresponde
                const aliases = getAliasesSafe_();
                if (aliases.includes(EMAIL_CONFIG.SENDER_EMAIL)) {
                    emailOptions.from = EMAIL_CONFIG.SENDER_EMAIL;
                }

                GmailApp.sendEmail(toList.join(","), EMAIL_CONFIG.SUBJECT_TEMPLATE(courseName), "", emailOptions);

                // 3. Actualizar Log
                sheetLog.getRange(i + 1, EMAIL_CONFIG.COL_LOG_STATUS + 1).setValue("ENVIADO");
                sheetLog.getRange(i + 1, EMAIL_CONFIG.COL_LOG_STATUS + 2).setValue(`Enviado a: ${toList.join(", ")}`);
                sentCount++;

            } catch (e) {
                console.error(`Error enviando a ${professorName}:`, e);
                sheetLog.getRange(i + 1, EMAIL_CONFIG.COL_LOG_STATUS + 1).setValue("ERROR ENVÍO");
                sheetLog.getRange(i + 1, EMAIL_CONFIG.COL_LOG_STATUS + 2).setValue(e.toString());
                errorCount++;
            }
        }

        SpreadsheetApp.getUi().alert(`✅ Proceso Finalizado.\n\nEnviados: ${sentCount}\nErrores: ${errorCount}`);

    } catch (e) {
        console.error("Error fatal en proceso de envío:", e);
        SpreadsheetApp.getUi().alert(`❌ Error crítico: ${e.message}`);
    } finally {
        lock.releaseLock();
    }
}

/**
 * Plantilla HTML del correo institucional.
 */
function getEmailTemplate(professorName, courseName, docUrl) {
    const colorPrimary = "#24588d"; // Azul Institucional
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; }
            .header { background-color: #ffffff; padding: 20px; text-align: center; border-bottom: 3px solid ${colorPrimary}; }
            .content { padding: 30px; background-color: #ffffff; }
            .btn { display: inline-block; background-color: ${colorPrimary}; color: white !important; text-decoration: none; padding: 12px 25px; border-radius: 4px; font-weight: bold; margin: 20px 0; }
            .footer { background-color: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #eee; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <img src="${EMAIL_CONFIG.LOGO_URL}" alt="Pontificia Universidad Católica de Valparaíso" style="max-width: 250px; height: auto;">
            </div>
            <div class="content">
                <p>Estimado/a profesor/a <strong>${professorName}</strong>,</p>
                <p>Junto con saludar, compartimos con usted el informe de resultados de la Encuesta de Opinión Estudiantil correspondiente al curso:</p>
                
                <p style="background-color: #f0f4f8; padding: 10px; border-left: 4px solid ${colorPrimary};">
                    <strong>${courseName}</strong><br>
                    <span style="font-size: 13px; color: #555;">${getPeriodLabel_()} - PUCV</span>
                </p>
                
                <p>Este informe detalla la percepción de los estudiantes sobre el proceso de enseñanza-aprendizaje y busca ser un insumo para la reflexión y mejora continua de su práctica docente.</p>
                
                <div style="text-align: center;">
                    <a href="${docUrl}" class="btn">Ver Informe Completo</a>
                </div>
                
                <p style="font-size: 13px; color: #555; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px;">
                    <em>Nota: Se han otorgado permisos de lectura a su cuenta institucional para acceder a este documento.</em><br>
                    <em>Ante cualquier duda, favor contactar a: <a href="mailto:cele.dgai@pucv.cl" style="color: ${colorPrimary};">cele.dgai@pucv.cl</a></em>
                </p>
            </div>
            <div class="footer">
                <p><strong>Pontificia Universidad Católica de Valparaíso</strong><br>
                Centro de Español Lengua Extranjera (CELE)<br>
                Dirección General de Asuntos Internacionales</p>
            </div>
        </div>
    </body>
    </html>
    `;
}

/**
 * Crea la hoja "Directorio" con encabezados y un ejemplo si no existe.
 */
function createDirectoryTemplate() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(EMAIL_CONFIG.SHEET_DIR);

    if (sheet) {
        SpreadsheetApp.getUi().alert('⚠️ La hoja "Directorio" ya existe.');
        return;
    }

    sheet = ss.insertSheet(EMAIL_CONFIG.SHEET_DIR);
    // Headers
    sheet.appendRow(["Nombre Profesor", "Email Profesor", "Emails en Copia"]);
    
    // Example
    sheet.appendRow(["Juan Pérez", "juan.perez@ejemplo.com", "director@ejemplo.com, secretaria@ejemplo.com"]);
    
    // Notas explicativas
    sheet.getRange("A4").setValue("Nota 1: El 'Nombre Profesor' debe ser idéntico al que aparece en los reportes generados.");
    sheet.getRange("A5").setValue("Nota 2: Para múltiples correos en copia (Autoridades), sepáralos con una coma (,).");
    sheet.getRange("A4:A5").setFontStyle("italic").setFontColor("#666666");

    // Format
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, 3).setFontWeight("bold").setBackground("#cfe2f3");
    sheet.autoResizeColumns(1, 3);

    // Crear hoja Configuración si no existe (para AUTHORITIES_CC fuera del código)
    if (!ss.getSheetByName(EMAIL_CONFIG.SHEET_CONFIG)) {
        const cfg = ss.insertSheet(EMAIL_CONFIG.SHEET_CONFIG);
        cfg.appendRow(["Clave", "Valor", "Descripción"]);
        cfg.appendRow(["AUTHORITIES_CC", "", "Correos en copia para todos los informes (separados por coma)"]);
        cfg.setFrozenRows(1);
        cfg.getRange(1, 1, 1, 3).setFontWeight("bold").setBackground("#cfe2f3");
        cfg.autoResizeColumns(1, 3);
    }
    
    SpreadsheetApp.getUi().alert('✅ Hoja creada. Llena los datos y borra el ejemplo.');
}

/**
 * Envía un correo de prueba al usuario activo para verificar el diseño.
 */
function sendTestEmail() {
    const ui = SpreadsheetApp.getUi();
    const userEmail = Session.getActiveUser().getEmail();
    
    if (!userEmail) {
        ui.alert('No se pudo detectar tu correo electrónico.');
        return;
    }

    const htmlBody = getEmailTemplate("Profesor de Prueba", `Curso Demo ${getPeriodLabel_()} (Test)`, "https://docs.google.com");
    
    try {
        const emailOptions = {
            htmlBody: htmlBody,
            name: EMAIL_CONFIG.SENDER_NAME
        };
        
        // Intentar usar alias en prueba también
        const aliases = getAliasesSafe_();
        if (aliases.includes(EMAIL_CONFIG.SENDER_EMAIL)) {
            emailOptions.from = EMAIL_CONFIG.SENDER_EMAIL;
        }

        GmailApp.sendEmail(userEmail, "[PRUEBA] Diseño de Entrega de Resultados", "", emailOptions);
        ui.alert(`✅ Correo de prueba enviado a: ${userEmail}\n\nRevisa tu bandeja de entrada para verificar el diseño.\n(Desde: ${emailOptions.from || 'Tu cuenta principal'})`);
    } catch (e) {
        ui.alert(`❌ Error al enviar correo: ${e.message}`);
    }
}

/**
 * Agrega permisos de lectura de forma SILENCIOSA (sin notificar por email).
 * Requiere activar el servicio "Google Drive API" en el editor.
 * Si no está activado, usa el método estándar (que sí notifica) y avisa en consola.
 */
function addViewerSilently_(fileId, email) {
    if (!email || !fileId) return;
    
    // Intento 1: API Avanzada (Silencioso)
    try {
        // Verificamos si 'Drive' está definido (Servicio activado)
        if (typeof Drive !== 'undefined') {
            Drive.Permissions.insert(
                {
                    'role': 'reader',
                    'type': 'user',
                    'value': email
                },
                fileId,
                {
                    'sendNotificationEmails': false
                }
            );
            return; // Éxito silencioso
        }
    } catch (e) {
        // Si el usuario ya tiene permiso, Drive API a veces lanza error, lo ignoramos seguro.
        if (e.message && e.message.includes("already")) return;
        console.warn(`Fallo API Avanzada para ${email}: ${e.message}. Intentando método estándar.`);
    }

    // Intento 2: Fallback Estándar (Ruidoso)
    try {
        DriveApp.getFileById(fileId).addViewer(email);
    } catch (e) {
        console.warn(`Fallo total al dar permiso a ${email}: ${e.message}`);
    }
}
