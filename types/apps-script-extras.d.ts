// Tipos que faltan en @types/google-apps-script y que SÍ existen en el entorno de Apps Script.
// Solo describe lo que este proyecto usa y ya se comprobó que funciona al generar informes.

declare namespace GoogleAppsScript {
  namespace Document {
    // Paragraph admite formato de texto directamente (setItalic, setFontSize, ...), pero @types no lo declara.
    interface Paragraph {
      setBold(bold: boolean): Paragraph;
      setItalic(italic: boolean): Paragraph;
      setFontSize(size: number): Paragraph;
      setForegroundColor(color: string): Paragraph;
    }
  }
}

// Servicio avanzado de Drive en versión v2 (ver appsscript.json); @types solo describe v3.
declare namespace Drive {
  namespace Permissions {
    function insert(resource: { role: string; type: string; value: string }, fileId: string,
      optionalArgs?: { sendNotificationEmails?: boolean }): unknown;
  }
}
