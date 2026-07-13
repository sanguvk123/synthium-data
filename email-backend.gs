// Google Apps Script — Email Backend for Synthium Data
// Deploy as Web App: Execute as "Me", Access "Anyone"
// This handles both JSON POST and form-encoded submissions

function doPost(e) {
  try {
    const data = e.parameter || JSON.parse(e.postData.contents);

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

    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Test with:
//   curl -X POST <DEPLOY_URL> -d "_subject=Test&Name=Alice&Role=Engineer"
