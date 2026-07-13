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

// ── Semaphore SMS API (https://semaphore.co) — sends real SMS to PH numbers
// and reports back delivery status. Sign up at semaphore.co, copy your API
// key from the dashboard, and paste it below. Leave SEMAPHORE_SENDER_NAME
// blank to send under Semaphore's shared default name until you register
// your own custom sender name in their dashboard.
var SEMAPHORE_API_KEY = "491adbfaa174c76c4772008c171d7d6c";
var SEMAPHORE_SENDER_NAME = "";
var SEMAPHORE_BASE = "https://api.semaphore.co/api/v4";

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

// Sends one SMS through Semaphore and returns its raw API response object
// (contains message_id, status, network, etc.) — throws if the API key isn't
// configured or Semaphore returns an error.
function sendSemaphoreSms_(number, message) {
  if (!SEMAPHORE_API_KEY || SEMAPHORE_API_KEY.indexOf("PASTE_YOUR") === 0) {
    throw new Error("Semaphore API key isn't configured yet — paste it into SEMAPHORE_API_KEY in ConsolidationBackend.gs");
  }
  var payload = { apikey: SEMAPHORE_API_KEY, number: number, message: message };
  if (SEMAPHORE_SENDER_NAME) payload.sendername = SEMAPHORE_SENDER_NAME;
  var res = UrlFetchApp.fetch(SEMAPHORE_BASE + "/messages", {
    method: "post",
    payload: payload,
    muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  var body = JSON.parse(res.getContentText());
  if (code >= 300) {
    var msg = (body && (body.message || JSON.stringify(body))) || ("Semaphore returned HTTP " + code);
    throw new Error(msg);
  }
  return Array.isArray(body) ? body[0] : body;
}

function sendNotification_(body) {
  var leaderId = body.leaderId, leaderName = body.leaderName, phone = body.phone, message = body.message;
  if (!phone) return { success: false, error: "No phone number provided" };
  if (!message) return { success: false, error: "Message is empty" };

  var result = sendSemaphoreSms_(phone, message);
  var sheet = getNotificationsSheet_();
  var id = String(Date.now());
  var sentAt = new Date().toISOString();
  var entry = {
    ID: id, LeaderId: leaderId, LeaderName: leaderName, Phone: phone, Message: message,
    SemaphoreMessageId: result.message_id || "", Status: result.status || "Pending",
    Network: result.network || "", SentAt: sentAt
  };
  var row = NOTIF_COLUMNS.map(function (c) { return entry[c]; });
  sheet.appendRow(row);
  return { success: true, notification: entry };
}

// Re-queries Semaphore for a single message's current status (Pending →
// Sent/Delivered/Failed) and updates the logged row in the Notifications
// sheet to match.
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
      if (!messageId) return { success: false, error: "No Semaphore message id logged for this notification" };
      var res = UrlFetchApp.fetch(
        SEMAPHORE_BASE + "/messages/" + messageId + "?apikey=" + encodeURIComponent(SEMAPHORE_API_KEY),
        { method: "get", muteHttpExceptions: true }
      );
      var body = JSON.parse(res.getContentText());
      var msg = Array.isArray(body) ? body[0] : body;
      var status = (msg && msg.status) || "Unknown";
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
