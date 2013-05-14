$(function(){
$.ajaxSetup({ cache: false });

    // Model
    var Note = Backbone.Model.extend({

        urlRoot: "/notes",
        idAttribute: "_id",
        defaults:{
            _id : null,
            title: "",
            note: "",
            deleted: false
        },

        initialize: function () {

            this.validators = {};

            this.validators.title = function (value) {
                return value.length > 0 ? {isValid: true} : {isValid: false, message: "You must enter a title"};
            };

        },

        validateItem: function (key) {
            return (this.validators[key]) ? this.validators[key](this.get(key)) : {isValid: true};
        },

        // Custom validation function. TODO: Use Backbone's standard validate() method.
        validateAll: function () {

            var messages = {};

            for (var key in this.validators) {
                if(this.validators.hasOwnProperty(key)) {
                    var check = this.validators[key](this.get(key));
                    if (check.isValid === false) {
                        messages[key] = check.message;
                    }
                }
            }

            return _.size(messages) > 0 ? {isValid: false, messages: messages} : {isValid: true};
        }

    });

    // Collection
    var NoteCollection = Backbone.Collection.extend({
        localStorage: new Backbone.LocalStorage("bbnotes"),
        model:Note,
        url: "/notes",
        //soft delete filter
        bydeleted: function(deleted) {
            var filtered = this.filter(function(notes) {
                return notes.get("deleted") === deleted;

            });
                return filtered;
            }
    });

    // Views
    var HeaderView = Backbone.View.extend({

        template:_.template($('#tpl-header').html()),

        initialize: function () {
            this.render();
            //push data when going online
            window.addEventListener("online", function() {
                utils.syncNotes("push");
                console.log('going online');
            }, true);
        },

        render: function () {
            $(this.el).html(this.template());
            return this;
        },

        selectMenuItem: function (menuItem) {
            $('.nav li').removeClass('active');
            if (menuItem) {
                $('.' + menuItem).addClass('active');
            }
        },

        displayNetworkstatus: function(){
            utils.dysplayNetwork();
        }

    });

    var HomeView = Backbone.View.extend({

        template:_.template($('#tpl-home').html()),

        initialize:function () {
            this.render();
        },

        render:function () {
            $(this.el).html(this.template());
            return this;
        }
        
    });

    var NoteListView = Backbone.View.extend({

        initialize: function () {
            this.render();
            utils.syncNotes();
        },

        render: function () {
            var noteslist = new NoteCollection();
            noteslist.fetch();
            //remove deleted items from collection
            var notes = noteslist.bydeleted(false);
            //paging
            var len = notes.length;
            var startPos = (this.options.page - 1) * 8;
            var endPos = Math.min(startPos + 8, len);

            $(this.el).html('<table class="notelist table table-striped"></table>');

            for (var i = startPos; i < endPos; i++) {
                $('.notelist', this.el).append(new NoteListItemView({model: notes[i]}).render().el);
            }

            $(this.el).append(new Paginator({model: this.model, page: this.options.page}).render().el);
            return this;
        }
    });

    var NoteListItemView = Backbone.View.extend({

        template:_.template($('#tpl-list').html()),
        tagName: "tr",

        initialize: function () {
            this.model.bind("change", this.render, this);
            this.model.bind("destroy", this.close, this);
        },

        render: function () {
            $(this.el).html(this.template(this.model.toJSON()));
            return this;
        }

    });

    var Paginator = Backbone.View.extend({

        className: "pagination pagination-centered",

        initialize:function () {
            this.model.bind("reset", this.render, this);
            this.render();
        },

        render:function () {

            var items = this.model.models;
            var len = items.length;
            var pageCount = Math.ceil(len / 8);

            $(this.el).html('<ul />');

            for (var i=0; i < pageCount; i++) {
                $('ul', this.el).append("<li" + ((i + 1) === this.options.page ? " class='active'" : "") + "><a href='#notes/page/"+(i+1)+"'>" + (i+1) + "</a></li>");
            }

            return this;
        }
    });

    var NoteView = Backbone.View.extend({

        template:_.template($('#tpl-note').html()),

        initialize:function () {
            this.render();
        },

        render: function () {
            $(this.el).html(this.template(this.model.toJSON()));
            return this;
        },

        events: {
            "change"        : "change",
            "click .save"   : "beforeSave",
            "click .delete" : "deleteNote"
        },

        change: function (event) {
            utils.hideAlert();
            // Apply the change to the model
            var target = event.target;
            var change = {};
            change[target.name] = target.value;
            this.model.set(change);

            // Run validation rule (if any) on changed item
            var check = this.model.validateItem(target.id);
            if (check.isValid === false) {
                utils.addValidationError(target.id, check.message);
            } else {
                utils.removeValidationError(target.id);
            }

            this.model.set({ synchronized: false });
        },

        beforeSave: function () {
            var self = this;
            var check = this.model.validateAll();
            if (check.isValid === false) {
                utils.displayValidationErrors(check.messages);
                return false;
            }
            this.saveNote();
            return false;
        },

        saveNote: function () {
            var self = this;

            this.model.save(null, {
                success: function (model) {
                    self.render();
                    app.navigate('notes/' + model.id, false);
                    utils.showAlert('Success!', 'Note saved successfully', 'alert-success');
                    //sync data
                    utils.syncNotes("push");
                },
                error: function () {
                    utils.showAlert('Error', 'An error occurred while trying to save this item', 'alert-error');
                }
            });
        },

        deleteNote: function () {
            //soft delete
            var self = this;
            this.model.set({ synchronized: false });
            this.model.set({ deleted: true });
            this.model.save(null, {
                success: function (model) {
                    alert('Note deleted successfully');
                    history.back();
                    //sync data
                    utils.syncNotes("push");
                },
                error: function () {
                    utils.showAlert('Error', 'An error occurred while trying to delete this item', 'alert-error');
                }
            });

            //hard delete
            /*this.model.destroy({
                success: function () {
                    alert('Note deleted successfully');
                    history.back();
                },
                error: function () {
                    utils.showAlert('Error', 'An error occurred while trying to delete this item', 'alert-error');
                }
            });*/
            return false;
        }


    });

    var utils = {

        displayValidationErrors: function (messages) {
            for (var key in messages) {
                if (messages.hasOwnProperty(key)) {
                    this.addValidationError(key, messages[key]);
                }
            }
            this.showAlert('Warning!', 'Fix validation errors and try again', 'alert-warning');
        },

        addValidationError: function (field, message) {
            var controlGroup = $('#' + field).parent().parent();
            controlGroup.addClass('error');
            $('.help-inline', controlGroup).html(message);
        },

        removeValidationError: function (field) {
            var controlGroup = $('#' + field).parent().parent();
            controlGroup.removeClass('error');
            $('.help-inline', controlGroup).html('');
        },

        showAlert: function(title, text, cls) {
            $('.alert').removeClass("alert-error alert-warning alert-success alert-info");
            $('.alert').addClass(cls);
            $('.alert').html('<strong>' + title + '</strong> ' + text);
            $('.alert').show();
        },

        hideAlert: function() {
            $('.alert').hide();
        },

        syncNotes: function(direction){
            var notes = new NoteCollection();
            notes.fetch();
            Backbone.localCache(notes,direction);
        },

        dysplayNetwork: function(){
            if (navigator.onLine) {
                $('#networkstatus').html('<span class="label label-success"><i class="icon-signal icon-white"></i> Working Online</span>');
            } else {
                $('#networkstatus').html('<span class="label label-warning"><i class="icon-signal icon-white"></i> Working Offline</span>');
            }
            window.addEventListener("offline", function(e) {
                $('#networkstatus').hide().html('<span class="label label-warning"><i class="icon-signal icon-white"></i> Working Offline</span>').fadeIn('slow');
            });
            window.addEventListener("online", function(e) {
                $('#networkstatus').hide().html('<span class="label label-success"><i class="icon-signal icon-white"></i> Working Online</span>').fadeIn('slow');
            });
        }
    };

    // Router
    var AppRouter = Backbone.Router.extend({

        routes: {
            ""                  : "home",
            "notes"             : "list",
            "notes/page/:page"  : "list",
            "notes/add"         : "addNote",
            "notes/:id"         : "noteDetails"
        },

        initialize: function () {
            this.headerView = new HeaderView();
            $('header').html(this.headerView.el);
            this.headerView.displayNetworkstatus();
        },

        home: function (id) {
            if (!this.homeView) {
                this.homeView = new HomeView();
            }
            $('#content').html(this.homeView.el);
            this.headerView.selectMenuItem('home-menu');
        },

        list: function(page) {
            var p = page ? parseInt(page, 10) : 1;
            var noteList = new NoteCollection();
            noteList.fetch({success: function(){
                $("#content").html(new NoteListView({model: noteList, page: p}).el);
            }});
            this.headerView.selectMenuItem('browse-menu');
        },

        noteDetails: function (id) {
            var notes = new NoteCollection();
            notes.fetch();
            var note = notes.get(id);
            $("#content").html(new NoteView({model: note}).el);
            this.headerView.selectMenuItem('add-menu');
        },

        addNote: function() {
            var notes = new NoteCollection();
            notes.fetch();
            var note = new Note();
            notes.add(note);
            $('#content').html(new NoteView({model: note}).el);
            this.headerView.selectMenuItem('add-menu');
        }

    });

    var app = new AppRouter();
    Backbone.history.start();

});