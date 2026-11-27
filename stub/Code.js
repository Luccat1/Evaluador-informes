// Stub para cualquier hoja: solo crea el menú y delega en la librería "EvaluadorLib".
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Evaluación Docente')
    .addItem('📊 Generar Reportes', 'generateReports')
    .addSeparator()
    .addItem('📧 Enviar Correos Masivos', 'launchEmailSender')
    .addItem('📈 Resumen Comparativo', 'generateComparativeSummary')
    .addItem('📄 Exportar Informes a PDF', 'exportReportsToPdf')
    .addItem('📋 Crear Plantilla Directorio', 'createDirectoryTemplate')
    .addSeparator()
    .addItem('🧪 Enviar Prueba de Diseño', 'sendTestEmail')
    .addToUi();
}
function generateReports() { EvaluadorLib.generateReports(); }
function generateComparativeSummary() { EvaluadorLib.generateComparativeSummary(); }
function exportReportsToPdf() { EvaluadorLib.exportReportsToPdf(); }
function launchEmailSender() { EvaluadorLib.launchEmailSender(); }
function createDirectoryTemplate() { EvaluadorLib.createDirectoryTemplate(); }
function sendTestEmail() { EvaluadorLib.sendTestEmail(); }
