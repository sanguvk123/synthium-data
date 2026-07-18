// Google Apps Script — Email Backend for Synthium Data
// Deploy as Web App: Execute as "Me", Access "Anyone"
// This handles both JSON POST and form-encoded submissions.
//
// Every submission is logged to a Google Sheet (auto-created on first run)
// AS WELL AS emailed — so you always have a permanent record even if the
// email gets filtered, delayed, or lost. Check the "Applications Log"
// spreadsheet in your Google Drive to see every submission that reaches
// this script, regardless of email delivery.

function doPost(e) {
  const data = e.parameter || JSON.parse(e.postData.contents);
  let mailError = null;
  let sheetError = null;

  try {
    logToSheet(data);
  } catch (err) {
    sheetError = err.toString();
  }

  try {
    let body = "=== New Application ===\n\n";
    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith("_")) continue;
      body += `${key}\n${value}\n\n`;
    }

    MailApp.sendEmail({
      to: "sangkalbe@gmail.com",
      subject: data._subject || "New application from synthium-data website",
      body: body,
    });
  } catch (err) {
    mailError = err.toString();
  }

  return ContentService
    .createTextOutput(JSON.stringify({ success: !mailError, mailError, sheetError }))
    .setMimeType(ContentService.MimeType.JSON);
}

function logToSheet(data) {
  const props = PropertiesService.getScriptProperties();
  let sheetId = props.getProperty("SHEET_ID");
  let sheet = null;

  if (sheetId) {
    try {
      sheet = SpreadsheetApp.openById(sheetId).getSheetByName("Applications");
    } catch (err) {
      sheet = null; // stored ID is stale (sheet deleted, etc.) — recreate below
    }
  }

  if (!sheet) {
    const ss = SpreadsheetApp.create("Synthium Data — Applications Log");
    sheet = ss.getActiveSheet();
    sheet.setName("Applications");
    sheet.appendRow(["Timestamp", "Subject", "Raw Data (JSON)"]);
    props.setProperty("SHEET_ID", ss.getId());
  }

  sheet.appendRow([new Date(), data._subject || "(no subject)", JSON.stringify(data)]);
}

// Test with:
//   curl -X POST <DEPLOY_URL> -d "_subject=Test&Name=Alice&Role=Engineer"
//
// After running this once, check script.google.com > your project > Overview
// or your Google Drive for a new spreadsheet called "Synthium Data — Applications Log".
