/**
 * TRCF CONSOLIDATION SYSTEM — backend
 * ------------------------------------
 * Paste this into the Apps Script editor of a NEW Google Sheet (this can
 * be a totally separate sheet from "NETWORK LEADERS CELL REPORTS" — it's
 * its own small database for First Timer / VIP records).
 *
 * After pasting:
 *   1. Run `setup` once from the function dropdown (creates the
 *      "FirstTimers" tab with the right headers). Authorize when asked.
 *   2. Deploy → New deployment → type "Web app".
 *        - Execute as: Me
 *        - Who has access: Anyone
 *   3. Copy the Web App URL it gives you — you'll paste that into the
 *      Consolidation tab's config in the dashboard app.
 */

var SHEET_NAME = "FirstTimers";
var LEADERS_SHEET_NAME = "Leaders";
var NOTIF_SHEET_NAME = "Notifications";

// ── SMS Gateway for Android (https://sms-gate.app) — FREE, no per-message
// cost. Turns your own Android phone into the SMS sender:
//   1. Install "SMS Gateway for Android" (SMSGate) on the phone that has
//      your SIM (09305920971) in it. Get it from sms-gate.app or the
//      GitHub releases page (capcom6/android-sms-gateway).
//   2. Open the app, leave it on "Cloud Server" mode (default), and copy
//      the Username / Password shown on the Home tab.
//   3. Paste them into SMSGATE_USERNAME / SMSGATE_PASSWORD below.
//   4. Keep the app running in the background on that phone — it has to
//      be online (connected to the internet) for messages to go out,
//      since each send is relayed to it through SMSGate's free cloud relay.
// Recipients will see 09305920971 as the sender (regular SMS can't show a
// custom name) — that's why the message text itself signs off as
// "TRCF Consolidation TEAM" (see buildReminderMessage in App.jsx).
var SMSGATE_USERNAME = "K9MIDA";
var SMSGATE_PASSWORD = "mlsies3ghgbztq";
var SMSGATE_BASE = "https://api.sms-gate.app/3rdparty/v1";
// Default country code used to expand local "09XXXXXXXXX" numbers to the
// E.164 format (+63XXXXXXXXXX) the SMSGate API requires.
var DEFAULT_COUNTRY_CODE = "63";

var COLUMNS = [
  "ID","Name","ContactNumber","Address","Age","Gender","MaritalStatus",
  "DateVisited","InvitedBy","Decision","AssignedNetworkId","AssignedLeaderName",
  "FollowUpStatus","Notes","EncodedBy","DateEncoded"
];

var LEADER_COLUMNS = ["ID","Name","NetworkId","NetworkLabel","Gender","Phone"];

var NOTIF_COLUMNS = [
  "ID","LeaderId","LeaderName","Phone","Message",
  "SemaphoreMessageId","Status","Network","SentAt"
];

// Same leaders as ASSIGNABLE_LEADERS in src/App.jsx — IDs must match exactly
// ("<networkId>-Boys" / "<networkId>-Girls") so a phone saved here lines up
// with the right card in the dashboard. Add new leaders in both places.
var LEADER_SEED = [
  ["abraham-Boys",   "Deonie Abraham",      "abraham",   "Abraham Network",      "Boys",  ""],
  ["abraham-Girls",  "Elva Abraham",        "abraham",   "Abraham Network",      "Girls", ""],
  ["claudio-Boys",   "Sonny Claudio",       "claudio",   "Claudio Network",      "Boys",  ""],
  ["flores-Boys",    "Franklin Flores",     "flores",    "Flores Network",       "Boys",  ""],
  ["imeepatal-Girls","Imee Patal",          "imeepatal", "Patal Network (Imee)", "Girls", ""],
  ["jacaria-Boys",   "Anthony Jacaria",     "jacaria",   "Jacaria Network",      "Boys",  ""],
  ["jayabraham-Boys","Jay Abraham",         "jayabraham","Jay Abraham Network",  "Boys",  ""],
  ["jotoy-Boys",     "Emerson P. Patal",    "jotoy",     "Jotoy Network",        "Boys",  ""],
  ["jotoy-Girls",    "Joan Z. Patal",       "jotoy",     "Jotoy Network",        "Girls", ""],
  ["laparan-Girls",  "Avril Lee Laparan",   "laparan",   "Laparan Network",      "Girls", ""],
  ["pendon-Boys",    "Richard Pendon",      "pendon",    "Pendon Network",       "Boys",  ""],
  ["pendon-Girls",   "Joy Pendon",          "pendon",    "Pendon Network",       "Girls", ""],
  ["rodemio-Boys",   "Jaime Rodemio",       "rodemio",   "Rodemio Network",      "Boys",  ""],
  ["rodemio-Girls",  "Ledelyn Rodemio",     "rodemio",   "Rodemio Network",      "Girls", ""]
];

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS]);
    sheet.getRange(1, 1, 1, COLUMNS.length).setFontWeight("bold").setBackground("#1F2A44").setFontColor("#FFFFFF");
    sheet.setFrozenRows(1);
  }
  setupLeaders_();
  setupNotifications_();
}

function setupNotifications_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(NOTIF_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(NOTIF_SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, NOTIF_COLUMNS.length).setValues([NOTIF_COLUMNS]);
    sheet.getRange(1, 1, 1, NOTIF_COLUMNS.length).setFontWeight("bold").setBackground("#1F2A44").setFontColor("#FFFFFF");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function setupLeaders_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(LEADERS_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(LEADERS_SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, LEADER_COLUMNS.length).setValues([LEADER_COLUMNS]);
    sheet.getRange(1, 1, 1, LEADER_COLUMNS.length).setFontWeight("bold").setBackground("#1F2A44").setFontColor("#FFFFFF");
    sheet.setFrozenRows(1);
    sheet.getRange(2, 1, LEADER_SEED.length, LEADER_COLUMNS.length).setValues(LEADER_SEED);
  }
  return sheet;
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) { setup(); sheet = ss.getSheetByName(SHEET_NAME); }
  return sheet;
}

function getLeadersSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(LEADERS_SHEET_NAME);
  if (!sheet) sheet = setupLeaders_();
  return sheet;
}

function readLeaders_() {
  var sheet = getLeadersSheet_();
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var leaders = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (!row[0]) continue;
    var rec = {};
    headers.forEach(function (h, j) { rec[h] = row[j]; });
    leaders.push(rec);
  }
  return leaders;
}

function updateLeaderPhone_(id, phone) {
  var sheet = getLeadersSheet_();
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var idCol = headers.indexOf("ID");
  var phoneCol = headers.indexOf("Phone");
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === String(id)) {
      sheet.getRange(i + 1, phoneCol + 1).setValue(phone);
      return { success: true };
    }
  }
  return { success: false, error: "Leader not found" };
}

function getNotificationsSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(NOTIF_SHEET_NAME);
  if (!sheet) sheet = setupNotifications_();
  return sheet;
}

function readNotifications_() {
  var sheet = getNotificationsSheet_();
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (!row[0]) continue;
    var rec = {};
    headers.forEach(function (h, j) { rec[h] = row[j]; });
    rows.push(rec);
  }
  return rows;
}

// Converts a local PH mobile number ("09XXXXXXXXX", "9XXXXXXXXX", or already
// "+63XXXXXXXXXX") into the E.164 format SMSGate's API requires.
function toE164Ph_(number) {
  var digits = String(number || "").replace(/[^\d+]/g, "");
  if (digits.indexOf("+") === 0) return digits;
  if (digits.indexOf("0") === 0) digits = digits.substring(1);
  if (digits.indexOf(DEFAULT_COUNTRY_CODE) === 0) return "+" + digits;
  return "+" + DEFAULT_COUNTRY_CODE + digits;
}

function smsGateAuthHeader_() {
  return "Basic " + Utilities.base64Encode(SMSGATE_USERNAME + ":" + SMSGATE_PASSWORD);
}

// Sends one SMS through your own phone via SMS Gateway for Android (free —
// no per-message API cost, just your normal carrier SMS rate) and returns
// its raw API response (contains id, state, recipients, etc.) — throws if
// the device credentials aren't configured or SMSGate returns an error
// (most commonly because the phone/app is offline).
function sendSmsGateSms_(number, message) {
  if (!SMSGATE_USERNAME || SMSGATE_USERNAME.indexOf("PASTE_") === 0) {
    throw new Error("SMSGate isn't configured yet — install the SMS Gateway for Android app on 09305920971, then paste its Username/Password into SMSGATE_USERNAME / SMSGATE_PASSWORD in ConsolidationBackend.gs");
  }
  var payload = {
    textMessage: { text: message },
    phoneNumbers: [toE164Ph_(number)],
    withDeliveryReport: true
  };
  var res = UrlFetchApp.fetch(SMSGATE_BASE + "/messages", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: smsGateAuthHeader_() },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  var text = res.getContentText();
  var body;
  try {
    body = JSON.parse(text);
  } catch (parseErr) {
    throw new Error("SMSGate: " + text);
  }
  if (code >= 300) {
    var msg = (body && (body.message || body.error || JSON.stringify(body))) ||
      ("SMSGate returned HTTP " + code + " — check that the phone has the app open and online.");
    throw new Error(msg);
  }
  return body;
}

function sendNotification_(body) {
  var leaderId = body.leaderId, leaderName = body.leaderName, phone = body.phone, message = body.message;
  if (!phone) return { success: false, error: "No phone number provided" };
  if (!message) return { success: false, error: "Message is empty" };

  var result = sendSmsGateSms_(phone, message);
  var sheet = getNotificationsSheet_();
  var id = String(Date.now());
  var sentAt = new Date().toISOString();
  var entry = {
    ID: id, LeaderId: leaderId, LeaderName: leaderName, Phone: phone, Message: message,
    // Reusing the old column names so existing sheets don't need re-setup:
    // "SemaphoreMessageId" now holds the SMSGate message id, "Network" is
    // left blank since SMSGate doesn't report a carrier network.
    SemaphoreMessageId: result.id || "", Status: result.state || "Pending",
    Network: "", SentAt: sentAt
  };
  var row = NOTIF_COLUMNS.map(function (c) { return entry[c]; });
  sheet.appendRow(row);
  return { success: true, notification: entry };
}

// Re-queries SMSGate for a single message's current status (Pending →
// Processed → Sent → Delivered, or Failed) and updates the logged row in
// the Notifications sheet to match.
function refreshNotificationStatus_(notifId) {
  var sheet = getNotificationsSheet_();
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var idCol = headers.indexOf("ID");
  var msgIdCol = headers.indexOf("SemaphoreMessageId");
  var statusCol = headers.indexOf("Status");
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === String(notifId)) {
      var messageId = values[i][msgIdCol];
      if (!messageId) return { success: false, error: "No SMSGate message id logged for this notification" };
      var res = UrlFetchApp.fetch(
        SMSGATE_BASE + "/messages/" + messageId,
        { method: "get", headers: { Authorization: smsGateAuthHeader_() }, muteHttpExceptions: true }
      );
      var text = res.getContentText();
      var body;
      try {
        body = JSON.parse(text);
      } catch (parseErr) {
        return { success: false, error: "SMSGate: " + text };
      }
      var status = (body && body.state) || "Unknown";
      sheet.getRange(i + 1, statusCol + 1).setValue(status);
      return { success: true, status: status };
    }
  }
  return { success: false, error: "Notification not found" };
}

function doGet(e) {
  try {
    var sheet = getSheet_();
    var values = sheet.getDataRange().getValues();
    var headers = values[0];
    var records = [];
    for (var i = 1; i < values.length; i++) {
      var row = values[i];
      if (!row[0]) continue; // skip blank rows
      var rec = {};
      headers.forEach(function (h, j) { rec[h] = row[j]; });
      records.push(rec);
    }
    var leaders = readLeaders_();
    var notifications = readNotifications_();
    return jsonOut_({ success: true, data: { records: records, leaders: leaders, notifications: notifications } });
  } catch (err) {
    return jsonOut_({ success: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action;
    if (action === "createRecord") return jsonOut_(createRecord_(body.record));
    if (action === "updateRecord") return jsonOut_(updateRecord_(body.id, body.record));
    if (action === "deleteRecord") return jsonOut_(deleteRecord_(body.id));
    if (action === "updateLeaderPhone") return jsonOut_(updateLeaderPhone_(body.id, body.phone));
    if (action === "sendNotification") return jsonOut_(sendNotification_(body));
    if (action === "refreshNotificationStatus") return jsonOut_(refreshNotificationStatus_(body.notifId));
    return jsonOut_({ success: false, error: "Unknown action" });
  } catch (err) {
    return jsonOut_({ success: false, error: String(err) });
  }
}

function createRecord_(record) {
  var sheet = getSheet_();
  var id = String(Date.now());
  var row = COLUMNS.map(function (col) {
    if (col === "ID") return id;
    if (col === "DateEncoded") return new Date().toISOString();
    return record[col] !== undefined ? record[col] : "";
  });
  sheet.appendRow(row);
  return { success: true, id: id };
}

function updateRecord_(id, patch) {
  var sheet = getSheet_();
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var idCol = headers.indexOf("ID");
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === String(id)) {
      headers.forEach(function (h, j) {
        if (patch[h] !== undefined) sheet.getRange(i + 1, j + 1).setValue(patch[h]);
      });
      return { success: true };
    }
  }
  return { success: false, error: "Record not found" };
}

function deleteRecord_(id) {
  var sheet = getSheet_();
  var values = sheet.getDataRange().getValues();
  var idCol = values[0].indexOf("ID");
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === String(id)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, error: "Record not found" };
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
