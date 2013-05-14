Backbone.serverSync = Backbone.sync;
Backbone.pingUrl = '/notes';

Backbone.onLine = function () {
    if (navigator.onLine) {
        console.log('Online');
        return true;
    } else {
        console.log('Offline');
        return false;
    }
}


Backbone.localCache = function (collection, action) {
    var pushAlso = false;
    if (action == null) {
        action = 'pull';
        pushAlso = true;
    }

    if (action === 'push') { this.localCachePush(collection); }
    if (action === 'pull') { this.localCachePull(collection, pushAlso); }
}

Backbone.localCachePush = function (collection) {
    console.log('LocalCachePush');

    //Are there any models unpushed?
    var models = collection.models;
    var unpushed = false;
    for (var i = 0; i < models.length; i++) {
        if (!models[i].get('synchronized')) { unpushed = true; break; }
    }
    if (!unpushed) { return; }

    if (Backbone.onLine() === true) { 
        Backbone.localCachePush_(collection);
    }
    /*$.ajax(
    {
        url: Backbone.pingUrl,
        type: 'GET',
        data: "",
        success: function () {
            Backbone.localCachePush_(collection);
        },
        error: function () {
            console.log('Offline');
        }
    });*/
}

Backbone.localCachePush_ = function (collection) {
    if (collection.localCacheActive) {
        console.log('LocalCache already active for this collection - aborting...');
        return;
    }
    console.log('localCachePush_');
    //Upload results to server
    //var models = tempCollection.models;
    var models = collection.models;
    for (var i = 0; i < models.length; i++) {
        var model = models[i];
        if (model.get('synchronized')) { continue; }
        model.change();
        var ClientId = model.id;
        console.log('Client ID ' + ClientId);
        Backbone.serverSync('update', model, {
            success: function (data) {
                console.log('Data ID: ' + data['_id']);
                //if new server will return a different Id
                if (data['_id'] != ClientId) {
                    //delete from localStorage with current Id
                    console.log('Deleting model Id ' + model.get('_id') + ' from local storage');
                    Backbone.sync("delete", model, { success: function () { }, error: function () { } });

                    //save model back into localStorage
                    model.save({ _id: data['_id'] })
                    console.log('Added model Id ' + model.get('_id') + ' to local storage');
                }
                model.save({ synchronized: true });
                collection.localCacheActive = false;
            },
            error: function (jqTHX, textStatus, errorThrown) {
                console.log('Model upload failure:' + textStatus);
                collection.localCacheActive = false;
            }
        });
    }
}

Backbone.localCachePull = function (collection, pushAlso) {
    console.log('LocalCachePull');

    if (Backbone.onLine() === false) { return; }
    if (collection.localCacheActive) {
        console.log('LocalCache already active for this collection - aborting...');
        return;
    }

    collection.localCacheActive = true;

    //save any unpushed local changes into local storage
    var models = collection.models;
    for (var i = 0; i < models.length; i++) {
        var model = models[i];
        model.collection = collection
        if (!model.get('synchronized')) {
            console.log('Saving model Id ' + model.get('_id') + ' to local storage');
            model.change();
            model.save();
        }
    }

    //create temporary collection to store pulled results
    var CollectionType = collection.constructor;
    var tempCollection = new CollectionType();
    tempCollection.sync = Backbone.serverSync;

    //fetch results from server
    tempCollection.fetch(
    {
        success: function () {
            console.log("Downloaded " + tempCollection.models.length + " models");

            //save new pulled items into collection and local storage
            tempCollection.sync = Backbone.sync;
            var tempModels = tempCollection.models;
            var models = collection.models;
            var newCount = 0;
            var updateCount = 0;
            for (var i = 0; i < tempModels.length; i++) {
                var tempModel = tempModels[i];
                var found = false;
                for (var j = 0; j < models.length; j++) {
                    model = models[j];
                    if (tempModel.get('_id') == model.get('_id')) { found = true; break; }
                }
                if (!found) {
                    //tempModel is new
                    newCount++;
                    console.log('New model ' + tempModel.get('_id'));
                    collection.add(tempModel);
                    //console.log(tempModel.collection);
                    tempModel.change();
                    tempModel.save({ synchronized: true });
                }
                else if (model.get('synchronized')) {
                    //client believes it is up-to-date with server
                    //update client
                    console.log('Updating model ' + tempModel.get('_id'));
                    model.set(tempModel.toJSON());
                    model.set({ synchronized: true });
                    model.save();
                }
            }
            console.log("Downloaded models - new: " + newCount);
            collection.localCacheActive = false;

            //push if required
            if (pushAlso) { Backbone.localCachePush(collection); }
        },
        error: function (jqTHX, textStatus, errorThrown) {
            collection.localCacheActive = false;
            console.log("Collection download failure: " + textStatus);
        }
    });
}
