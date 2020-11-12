var express = require('express');
var app = express();
var bodyParser = require('body-parser')
var JiraClient = require("jira-connector");
var requ = require('request-promise');
var Imap = require("imap");
var MailParser = require("mailparser").MailParser;
var Promise = require("bluebird");
Promise.longStackTraces();

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

var jira = new JiraClient({
  host: "", //Add your atlassian host
  basic_auth: {
    email: "", //Add atlassain login id
    api_token: "" //Add atlassain api_token
  },
  strictSSL: false,
});

var imapConfig = {
  user: '', //Add your email id
  password: '', //Add your email password
  host: 'imap.gmail.com',
  port: 993,
  tls: true,
  tlsOptions: {
    servername: 'imap.gmail.com',
  },
};

var imap = new Imap(imapConfig);
Promise.promisifyAll(imap);

imap.once("ready", execute);
imap.once("error", function (err) {
  log.error("Connection error: " + err.stack);
});

imap.connect();

function execute() {
  imap.openBox("INBOX", false, function (err, mailBox) {
    if (err) {
      console.error(err);
      return;
    }
    imap.search(["UNSEEN"], function (err, results) {
      if (!results || !results.length) { console.log("No unread mails"); imap.end(); return; }
      imap.setFlags(results, ['\\Seen'], function(err) {
          if (!err) {
              console.log("marked as read");
          } else {
              console.log(JSON.stringify(err, null, 2));
          }
      });
      var f = imap.fetch(results, { bodies: "" });        
      f.on("message", processMessage);
      f.once("error", function (err) {
        return Promise.reject(err);
      });
      f.once("end", function () {
        console.log("Done fetching all unseen messages.");
        imap.end();
      });
    });
  });
}

function processMessage(msg, seqno) {
  console.log("Processing msg #" + seqno);
  var parser = new MailParser();
  parser.on("headers", function (headers) {
    console.log("Header: " + JSON.stringify(headers));
  });

  parser.on('data', data => {
      if (data.type === 'text') {
        console.log(seqno);
        console.log(data.text);
        jira.issue.createIssue({
          fields: {
            project: { key: "TKT" },
            issuetype: { name: "Bug" },
            summary: "Jira Api",
            description: data.text,
          },
        },
          function (error, issue) {
            requ({
              url: '', //Add your slack webhook
              method: 'POST',
              body: {
                mkdwn: true,
                text: `https://xxx.atlassian.net/xxx/${issue.key}` //Add your atlassian ticket url
              },
              json: true
            })
            console.log("Issue", issue);
            console.log("Error", error);
            return issue
          }
        );
      } else {
        console.log("status: nope");
      }
  });

  msg.on("body", function (stream) {
    stream.on("data", function (chunk) {
      parser.write(chunk.toString("utf8"));
    });
  });
  msg.once("end", function () {
    console.log("Finished msg #" + seqno);
    parser.end();
  });
}
app.listen(2000, () => {
  console.log("The server started on port 2000 !!!!!!");
});