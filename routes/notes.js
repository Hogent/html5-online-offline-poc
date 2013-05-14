var mongoose = require ("mongoose");
var uristring = process.env.MONGOHQ_URL || "mongodb://localhost/notes";

/* Connect */
mongoose.connect(uristring, function (err, res) {
  if (err) { 
    console.log ('ERROR connecting to: ' + uristring + '. ' + err);
  } else {
    console.log ('Connected to: ' + uristring);
  }
});

var Schema = mongoose.Schema;

var Note = new Schema({
  title: String,
  note: String,
  deleted: Boolean
});

var Note = mongoose.model('Notes', Note);

// CRUD operations
exports.findAll = function(req, res) {
    Note.find({}, function (err, notes) {
        if (!err) {
            return res.send(notes);
        } else {
            return console.log(err);
        } 
    });
};

exports.findById = function(req, res) {
    var id = req.params.id;
    Note.findOne({'_id':id}, function(err, doc) {
        res.send(doc);
    });
};

exports.addNote = function(req, res) {
    var note = new Note();
    note.title = req.body.title;
    note.note = req.body.note;
    note.deleted = req.body.deleted;
    note.save(function (err, doc) {
        if (err) {
            res.send({'error':'An error has occurred'});
        }
        else{
            res.send(doc);
        }
    });
}

exports.updateNote = function(req, res) {
    var id = req.params.id;
    Note.findById(id, function (err, doc){
        
        if(!err) {
            doc.title = req.body.title;
            doc.note = req.body.note;
            doc.deleted = req.body.deleted;
            doc.save(function(err, result) {
                if (err){
                    res.send({'error':'An error has occurred'});
                }
                else {
                    res.send(result);
                }
            });
        }
        else{
            var note = new Note();
            note.title = req.body.title;
            note.note = req.body.note;
            note.deleted = req.body.deleted;
            note.save(function (err, doc) {
                if (err) {
                    res.send({'error':'An error has occurred'});
                }
                else{
                    res.send(doc);
                }
            });    
        }    
    }); 
}

/*exports.deleteNote = function(req, res) {
    var id = req.params.id;
    Note.findOne({ '_id': id }, function(err, doc) {
        doc.remove(function(err) {
            if (err) {
                res.send({'error':'An error has occurred - ' + err});
            } else {
                res.send(req.body);
            }
        });
    });
}*/