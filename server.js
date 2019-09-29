const Competidor = require('./model/competidor.js');
const ProblemStatus = require('./model/problem-status.js');
const Problem = require('./model/problem.js')
const Competition = require('./model/competition.js')

const request = require('request');
const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const fs = require('fs');

const hostname = 'localhost';
const dbPath = 'database/db.json';
var db;
const huxley_url = 'https://thehuxley.com/api';
const port = 3000;

var huxleyToken = null;
var clientToken = null;

async function login(username, password) {
  await request.post(huxley_url + '/login', {json: {username: username, password: password}}, (err, res, body) => {
    if (err || body == undefined) {
      console.log(err);
      return;
    }
    huxleyToken = body['access_token'];
    // console.log("huxleyToken " + huxleyToken);
    // initServer();
  });
}

function getHuxleyDateString(date, minuteShift) {
  str = new Date(date);
  str.setMinutes(str.getMinutes() - minuteShift);
  // str.setHours(str.getHours() + 3);
  return str.toJSON().replace('.000Z', '-00:00');
}

async function updateCompetitionsSubmissions() {
  if (huxleyToken == null) {
    console.log('couldn\'t update because huxleyToken is null');
    return;
  }

  // https://www.thehuxley.com/api/v1/submissions?submissionDateGe=2017-10-28T17:22:54-03:00&user=5875&submissionDateLe=2017-10-28T17:22:56-03:00&problem=794
  // Ge == Greater, Le == Less
  let headers = {"Authorization": "Bearer " + huxleyToken, "Content-Type": "application/json"};
  var competitions = db['competitions'], done = 0, totalRequired = 0;
  competitions.forEach(competition => { totalRequired += competition.competidors.length * competition.problems.length; });
  for (var i = 0; i < competitions.length; i ++)
    for (var j = 0; j < competitions[i].competidors.length; j ++) {
      competitions[i].competidors[j].totalTime = competitions[i].competidors[j].totalAccepted = 0;
      for (var k = 0; k < competitions[i].problems.length; k ++) {
        let url = (huxley_url + '/v1/submissions?user=' + competitions[i].competidors[j].id.toString() + '&problem=' + competitions[i].problems[k].id.toString()
                  + '&submissionDateGe=' + getHuxleyDateString(competitions[i].startTime, -1) + '&submissionDateLe=' + getHuxleyDateString(competitions[i].endTime, 1)
                  + '&max=100');
        request.get({url: url, headers: headers, competitionIndex: i, competidorIndex: j, problemIndex: k}, (err, res, body) => {
          if (err || body == undefined) {
            console.log(err);
            return;
          }
          let ci = res.request.competitionIndex, cj = res.request.competidorIndex, ck = res.request.problemIndex;
          let submissions = JSON.parse(body);
          var problemStatus = getById(competitions[ci].competidors[cj].problemsStatus, competitions[ci].problems[ck].id);
          problemStatus.submissions = submissions.length;
          if (submissions.length) {
            problemStatus.accepted = submissions[0].evaluation == 'CORRECT';
            if (submissions[0].evaluation == 'WAITING') problemStatus.submissions --;
          }
          else
            problemStatus.accepted = false;
          if (submissions.length)
            competitions[ci].competidors[cj].totalTime += problemStatus.accepted * Math.ceil((new Date(submissions[0].submissionDate).getTime() - new Date(competitions[ci].startTime).getTime()) / (1000 * 60)
                                                                                             + problemStatus.accepted * (submissions.length - 1) * 15);
          competitions[ci].competidors[cj].totalAccepted += problemStatus.accepted;
          if (++ done == totalRequired) {
            console.log('updated competitions submissions successfully');
            saveDatabase();
          }
        });
      }
    }
}

function loadDatabase() {
  db = fs.readFileSync(dbPath, 'utf8');
  db = JSON.parse(db);
}

function saveDatabase() {
  fs.writeFileSync(dbPath, JSON.stringify(db), 'utf8');
}

function getById(array, id) {
  return array.find(element => element.id == id);
}

function deleteById(array, id) {
  for (var i = 0; i < array.length; i ++)
    if (array[i].id == id) {
      array.splice(i, 1);
      break;
    }
}

function getNextId(array) {
  maximum = -1;
  array.forEach(element => {
    maximum = Math.max(maximum, element.id);
  });
  return maximum + 1;
}

function initServer() {
  loadDatabase();
  setInterval(() => updateCompetitionsSubmissions(), 5000);

  huxleyToken = clientToken = null;

  const server = express();
  server.use(bodyParser.json());
  server.use(bodyParser.urlencoded({extended: false}));
  server.use(function(req, res, next){
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS, POST, PUT, DELETE, PATCH");
    res.setHeader("Access-Control-Allow-Headers", "content-type, token");
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Credentials", true);
    next();
  });

  server.get('/competitions', (req, res) => {
    res.json({competitions: db['competitions'], time: Date.now()});
  });

  server.post('/competitions', (req, res) => {
    if (clientToken != req.body.token || clientToken == null) {
      res.sendStatus(403);
      console.log('Not allowed');
      return;
    }
    var newCompetition = req.body.competition;
    console.log(newCompetition);
    newCompetition = new Competition(newCompetition.id, newCompetition.name, newCompetition.startTime, newCompetition.endTime);
    db['competitions'].push(newCompetition);
    saveDatabase();
    res.json(newCompetition);
  });

  server.patch('/competition/:id/changeSchedule', (req, res) => {
    if (clientToken != req.body.token || clientToken == null) {
      res.sendStatus(403);
      console.log('Not allowed');
      return;
    }
    var competition = getById(db['competitions'], req.params.id);
    competition.startTime = new Date(req.body.schedule.startTime);
    competition.endTime = new Date(req.body.schedule.endTime);
    saveDatabase();
    res.json(competition);
  });
  
  server.put('/competition/:id/newCompetidor', (req, res) => {
    if (clientToken != req.body.token || clientToken == null) {
      res.sendStatus(403);
      console.log('Not allowed');
      return;
    }
    var newCompetidor = req.body.competidor;
    var competition = getById(db['competitions'], req.params.id);
    newCompetidor = new Competidor(newCompetidor.id, newCompetidor.name);
    for (var i = 0; i < competition.problems.length; i ++)
      newCompetidor.problemsStatus.push(new ProblemStatus(competition.problems[i].id));
    competition.competidors.push(newCompetidor);
    saveDatabase();
    res.json(newCompetidor);
  });

  server.put('/competition/:id/newProblem', (req, res) => {
    if (clientToken != req.body.token || clientToken == null) {
      res.sendStatus(403);
      console.log('Not allowed');
      return;
    }
    var newProblem = req.body.problem;
    newProblem = new Problem(newProblem.id);
    var competition = getById(db['competitions'], req.params.id);
    competition.problems.push(newProblem);
    for (var i = 0; i < competition.competidors.length; i ++)
      competition.competidors[i].problemsStatus.push(new ProblemStatus(newProblem.id));
    saveDatabase();
    res.json(newProblem);
  });

  server.delete('/competition/:id', (req, res) => {
    if (clientToken != req.headers.token || clientToken == null) {
      res.sendStatus(403);
      console.log('Not allowed');
      return;
    }
    deleteById(db['competitions'], req.params.id);
    saveDatabase();
    res.json(db['competitions']);
  });

  server.delete('/competition/:competitionId/competidor/:competidorId', (req, res) => {
    if (clientToken != req.headers.token || clientToken == null) {
      res.sendStatus(403);
      console.log('Not allowed');
      return;
    }
    var competition = getById(db['competitions'], req.params.competitionId);
    if (competition)
      deleteById(competition.competidors, req.params.competidorId);
    saveDatabase();
    res.json(competition);
  });

  server.delete('/competition/:competitionId/problem/:problemId', (req, res) => {
    if (clientToken != req.headers.token || clientToken == null) {
      res.sendStatus(403);
      console.log('Not allowed');
      return;
    }
    var competition = getById(db['competitions'], req.params.competitionId);
    if (competition)
      deleteById(competition.problems, req.params.problemId);
    saveDatabase();
    res.json(competition);
  });

  server.get('/standings/:id', (req, res) => {
    res.json({standings: getById(db['competitions'], req.params.id), time: Date.now()});
  });

  server.post('/login', (req, res) => {
    login(req.body.username, req.body.password);
    clientToken = crypto.randomBytes(20).toString('hex')
    res.json(clientToken);
  });

  server.post('/valid', (req, res) => {
    res.json(clientToken == req.body.token);
  });
  
  server.listen(port, hostname, () => {
    console.log('Server running at http://${hostname}:${port}/');
  });
}

initServer();