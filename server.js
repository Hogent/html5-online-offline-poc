// server.js
var express = require('express'),
    path = require('path'),
    http = require('http');
    note = require('./routes/notes');
 
var app = express();
 
app.configure(function () {
    app.set('port', process.env.VCAP_APP_PORT || 3000);
    app.use(express.logger('dev'));  /* 'default', 'short', 'tiny', 'dev' */
    app.use(express.bodyParser()),
    app.use(express.static(path.join(__dirname, 'public')));
    app.use(express.favicon(__dirname + '/public/img/favicon.png'));
});

/* set the correct content-type header for the manifest file */ 
app.get("/notesapp.appcache", function(req, res){
  res.header("Content-Type", "text/cache-manifest");
  res.end("CACHE MANIFEST");
});
 
app.get('/notes', note.findAll);
app.get('/notes/:id', note.findById);
app.post('/notes', note.addNote);
app.put('/notes/:id', note.updateNote);
//app.delete('/notes/:id', note.deleteNote);
 
http.createServer(app).listen(app.get('port'), function () {
    console.log("Express server listening on port " + app.get('port'));
});