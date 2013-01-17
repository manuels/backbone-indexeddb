jQuery(document).ready((function ($) {

    var WebShareDB = function () {
        var schema_name = "webshare";
        var schema_version = 2;
        var indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.msIndexedDB;

        var deferred = $.Deferred();

        this.promise = deferred.promise();
        this.store_webshare = 'webshare';
        this.db;

        var self = this;
        var open_req = indexedDB.open(schema_name, schema_version);

        open_req.onerror = function (evt) {
            console.log("Database error code: " + evt.target.errorCode);
            deferred.reject(evt);
        };

        open_req.onsuccess = function (evt) {
            if (typeof self.db === 'undefined') {
                self.db = open_req.result;
            }
            deferred.resolve(evt);
        };

        open_req.onupgradeneeded = function (evt) {
            if (typeof self.db === 'undefined') {
                self.db = open_req.result;
            }

            if (self.db.objectStoreNames.contains(self.store_webshare)) {
                self.db.deleteObjectStore(self.store_webshare);
            }

            self.db.createObjectStore(self.store_webshare, { keyPath:"id", autoIncrement: true});
        };
    }

    WebShareDB.prototype.put = function (items) {
        var d = $.Deferred();
        var self = this;
        this.promise.done(function () {
            var _items = (items instanceof Array) ? items : [items]

            var store = self.db
                .transaction([self.store_webshare], "readwrite")
                .objectStore(self.store_webshare);

            $.each(_items, function (i, _item) {
                var req_add = store.put(_item);
                req_add.onsuccess = function onSuccess(evt) {
                    d.resolve();
                };

                req_add.onerror = function onError(evt) {
                    d.reject("Unable to save");
                };
            });
        });

        this.promise.fail(function () {
            d.reject("Unable to open database");
        });
        return d.promise();
    };

    WebShareDB.prototype.get = function (id) {
        var d = $.Deferred();
        var self = this;
        this.promise.done(function () {
            var store = self.db
                .transaction([self.store_webshare], "readonly")
                .objectStore(self.store_webshare);

            var cursor_req = store.get(id);

            cursor_req.onsuccess = function (e) {
                d.resolve(e.target.result);
            };

            cursor_req.onerror = function onError(event) {
                d.reject("Unable to get record");
            };

            this.promise.fail(function () {
                d.reject("Unable to open database");
            });
        });
        return d.promise();
    };

    WebShareDB.prototype.pop = function() {
         return this.getAll(1);
    }

    WebShareDB.prototype.getAll = function (maximum) {
        var d = $.Deferred();
        var self = this;
        this.promise.done(function () {
            if (maximum === 'undefined' || maximum === null || maximum === 0) {
                maximum = 10;
            }

            var web_shares = []

            var store = self.db
                .transaction([self.store_webshare], "readonly")
                .objectStore(self.store_webshare);

            var cursor_req = store.openCursor(null, "prev");

            cursor_req.onsuccess = function (e) {
                var result = e.target.result;
                if (result && web_shares.length < maximum) {
                    web_shares.push(result.value);
                    result.continue();
                } else {
                    d.resolve(web_shares);
                }
            };

            cursor_req.onerror = function onError(event) {
                d.reject("Unable to get records");
            };
        });
        this.promise.fail(function () {
            d.reject("Unable to open database");
        });
        return d.promise();
    };

    WebShareDB.prototype.delete = function (id) {
        var d = $.Deferred();
        var self = this;
        this.promise.done(function () {
            var store = self.db
                .transaction([self.store_webshare], "readwrite")
                .objectStore(self.store_webshare);

            var req_del = store.delete(id);

            req_del.onsuccess = function onSuccess(event) {
                d.resolve()
            };

            req_del.onerror = function onError(event) {
                d.reject("Unable to delete record");
            };

            this.promise.fail(function () {
                d.reject("Unable to open database");
            });
        });
        return d.promise();
    }

    Backbone.sync = function (method, model, options) {

        var is_collection = model.hasOwnProperty("length");
        var store = is_collection ? model.model.store : model.constructor.store;

        switch (method) {
            case "read":
                if (is_collection) {
                    store.getAll(options["maximum"]).done(function (records) {
                        options.success(records);
                    }).fail(function () {
                            options.error()
                        });
                } else {
                    store.get(model.toJSON()["id"]).done(function (record) {
                        options.success(record);
                    }).fail(function () {
                            options.error()
                        });
                }
                break;
            case "create":
                store.put(model.toJSON()).done(function () {
                    options.success();
                }).fail(function () {
                        options.error()
                });
                break;
            case "update":
                store.put(model.toJSON()).done(function () {
                    options.success();
                }).fail(function () {
                        options.error()
                    });
                break;
            case "delete":
                store.delete(model.toJSON()["id"]).done(function () {
                    options.success();
                }).fail(function () {
                        options.error()
                    });
                break;
        }
    }


    var WebShareItem = Backbone.Model.extend({
    }, {store : new WebShareDB()});

    var WebShareList = Backbone.Collection.extend({
        model:WebShareItem
    });

    var WebShareItemView = Backbone.View.extend({
        template:_.template($('#webshare-item-template').html()),
        initialize:function () {
            _.bindAll(this, 'render'); // every function that uses 'this' as the current object should be in here
        },
        render:function () {
            $(this.el).html(this.template(this.model.toJSON()));
            return this;
        }
    });
    var views = {};

    views.WebShareListView = Backbone.View.extend({
        initialize:function () {

            _.bindAll(this, 'renderAll', 'addToCollection', 'updateView');

            this.webshare_list = new WebShareList();
            this.webshare_list.bind('add', this.updateView, this);
            this.webshare_list.bind('reset', this.renderAll, this);

            this.webshare_list.fetch({"maximum":50});
        },

        renderAll:function () {
            var self = this;
            _(this.webshare_list.models).each(function (item) {
                self.updateView(item);
            }, this);
        },

        addToCollection:function (webshare) {
            var item = new WebShareItem();
            item.set(webshare);
            this.webshare_list.create(item);
        },

        updateView:function (item) {
            var itemView = new WebShareItemView({
                model:item
            });
            $('.web_shares').append(itemView.render().el);
        }
    });

    var listView = new views.WebShareListView();

    views.WebShareCreateFormView = Backbone.View.extend({
        el:$('.container'),
        events:{
            'click button' : 'createWebShare'

        },

        initialize:function () {
            _.bindAll(this, 'createWebShare');
        },

        createWebShare:function () {
            console.log({"url":$("#url").val() , "label":$("#label").val()});
            listView.addToCollection({"url":$("#url").val() , "label":$("#label").val()});
        }
    });

    new views.WebShareCreateFormView();
}));



