﻿//The maximum zoom level to cluster data point data on the map.
var maxClusterZoomLevel = 11;

//The URL to the store location data.
var storeLocationDataUrl = 'data/MARVEL.txt';

//The URL to the icon image.
var iconImageUrl = 'images/avengers.png';
var map, popup, datasource, iconLayer, centerMarker, searchURL;


function initialize() {
    //Initialize a map instance.

    map = new atlas.Map('myMap', {
        center: [-90, 40],
        zoom: 2,
        view: 'Auto',

        //Add your Azure Maps subscription key to the map SDK.
        authOptions: {
            authType: 'subscriptionKey',
            subscriptionKey: 'l2hEdkpZJDfGN0MFUnk8hcHVq0Kn-EWjXSUeI1IdU60'
        }
    });

    //Create a pop-up window, but leave it closed so we can update it and display it later.
    popup = new atlas.Popup();

    //Use SubscriptionKeyCredential with a subscription key
    const subscriptionKeyCredential = new atlas.service.SubscriptionKeyCredential(atlas.getSubscriptionKey());

    //Use subscriptionKeyCredential to create a pipeline
    const pipeline = atlas.service.MapsURL.newPipeline(subscriptionKeyCredential, {
        retryOptions: { maxTries: 4 } // Retry options
    });

    //Create an instance of the SearchURL client.
    searchURL = new atlas.service.SearchURL(pipeline);

    //If the user selects the search button, geocode the value the user passed in.
    document.getElementById('searchBtn').onclick = performSearch;

    //If the user presses Enter in the search box, perform a search.
    document.getElementById('searchTbx').onkeyup = function(e) {
        if (e.keyCode === 13) {
            performSearch();
        }
    };

    //If the user selects the My Location button, use the Geolocation API to get the user's location. Center and zoom the map on that location.
    document.getElementById('myLocationBtn').onclick = setMapToUserLocation;

    //Wait until the map resources are ready.
    map.events.add('ready', function() {

        //Add your post-map load functionality.
        //Add a zoom control to the map.
        map.controls.add(new atlas.control.ZoomControl(), {
            position: 'top-right'
        });

        //Add an HTML marker to the map to indicate the center to use for searching.
        centerMarker = new atlas.HtmlMarker({
            htmlContent: '<div class="mapCenterIcon"></div>',
            position: map.getCamera().center
        });

        map.markers.add(centerMarker);

        //Create a data source, add it to the map, and then enable clustering.
        datasource = new atlas.source.DataSource(null, {
            cluster: true,
            clusterMaxZoom: maxClusterZoomLevel - 1
        });

        map.sources.add(datasource);

        //Load all the store data now that the data source is defined.  
        loadStoreData();

                //Create a bubble layer to render clustered data points.
        var clusterBubbleLayer = new atlas.layer.BubbleLayer(datasource, null, {
            radius: 12,
            color: '#000000',
            strokeColor: 'white',
            strokeWidth: 2,
            filter: ['has', 'point_count'] //Only render data points that have a point_count property; clusters have this property.
        });

        //Create a symbol layer to render the count of locations in a cluster.
        var clusterLabelLayer = new atlas.layer.SymbolLayer(datasource, null, {
            iconOptions: {
                image: 'none' //Hide the icon image.
            },

            textOptions: {
                textField: ['get', 'point_count_abbreviated'],
                size: 12,
                font: ['StandardFont-Bold'],
                offset: [0, 0.4],
                color: 'white'
            }
        });

        map.layers.add([clusterBubbleLayer, clusterLabelLayer]);

        //Load a custom image icon into the map resources.
        map.imageSprite.add('myCustomIcon', iconImageUrl).then(function () {

            //Create a layer to render a coffee cup symbol above each bubble for an individual location.
            iconLayer = new atlas.layer.SymbolLayer(datasource, null, {
                iconOptions: {
                    //Pass in the ID of the custom icon that was loaded into the map resources.
                    image: 'myCustomIcon',

                    //Optionally, scale the size of the icon.
                    font: ['SegoeUi-Bold'],

                    //Anchor the center of the icon image to the coordinate.
                    anchor: 'center',

                    //Allow the icons to overlap.
                    allowOverlap: true
                },

                filter: ['!', ['has', 'point_count']] //Filter out clustered points from this layer.
            });

            map.layers.add(iconLayer);

            //When the mouse is over the cluster and icon layers, change the cursor to a pointer.
            map.events.add('mouseover', [clusterBubbleLayer, iconLayer], function () {
                map.getCanvasContainer().style.cursor = 'pointer';
            });

            //When the mouse leaves the item on the cluster and icon layers, change the cursor back to the default (grab).
            map.events.add('mouseout', [clusterBubbleLayer, iconLayer], function () {
                map.getCanvasContainer().style.cursor = 'grab';
            });

            //Add a click event to the cluster layer. When the user selects a cluster, zoom into it by two levels.  
            map.events.add('click', clusterBubbleLayer, function (e) {
                map.setCamera({
                    center: e.position,
                    zoom: map.getCamera().zoom + 2
                });
            });

            //Add a click event to the icon layer and show the shape that was selected.
            map.events.add('click', iconLayer, function (e) {
                showPopup(e.shapes[0]);
            });

            //Add an event to monitor when the map is finished rendering the map after it has moved.
            map.events.add('render', function () {
                //Update the data in the list.
                updateListItems();
            });
        });

    });
}

var lines, row, header;

function loadStoreData() {

//Download the store location data.
fetch(storeLocationDataUrl)
    .then(response => response.text())
    .then(function(text) {

        //Parse the tab-delimited file data into GeoJSON features.
        var features = [];
        
        //Split the lines of the file.
        lines = text.split('\n');

        //Grab the header row.
        row = lines[0].split('\t');

        //Parse the header row and index each column to make the code for parsing each row easier to follow.
        header = {};
        var numColumns = row.length;
        for (var i = 0; i < row.length; i++) {
            header[row[i]] = i;
        }

        //Skip the header row and then parse each row into a GeoJSON feature.
        for (var i = 1; i < lines.length; i++) {
            row = lines[i].split('\t');

            //Ensure that the row has the correct number of columns.
            if (row.length >= numColumns) {

                features.push(new atlas.data.Feature(new atlas.data.Point([parseFloat(row[header['Longitude']]), parseFloat(row[header['Latitude']])]), {
                    Movie: row[header['Movie']],
                    AddressLine: row[header['AddressLine']],
                    City: row[header['City']],
                    Country: row[header['Country']],
                    FormalName: row[header['FormalName']]
                }));
            }
        }

        //Add the features to the data source.
        datasource.add(new atlas.data.FeatureCollection(features));

        //Initially, update the list items.
        updateListItems();
    });
}

//Create an array of country ISO 2 values to limit searches to. 
var countrySet = ['US', 'CA', 'GB', 'FR','DE','IT','ES','NL','DK','BR',];

function performSearch() {
    var temp = document.getElementById('searchTbx').value;
    var query = movieExist(temp);

    //if(query != null){
        //Perform a fuzzy search on the users query.
        searchURL.searchFuzzy(atlas.service.Aborter.timeout(3000), query, {
            //Pass in the array of country ISO2 for which we want to limit the search to.
            //countrySet: countrySet
        }).then(results => {
            //Parse the response into GeoJSON so that the map can understand.
            var data = results.geojson.getFeatures();

            if (data.features.length > 0) {
                //Set the camera to the bounds of the results.
                map.setCamera({
                    bounds: data.features[0].bbox,
                    padding: 40
                });
            } else {
                document.getElementById('listPanel').innerHTML = '<div class="statusMessage">403 ERROR: Not Found.</div>';
            }
        });
    //}
    //else{
    //    document.getElementById('listPanel').innerHTML = '<div class="statusMessage">404 ERROR: Not Found.</div>';
    //}
}

function movieExist(query){
    var original = query;
    for (var i = 1; i < lines.length; i++) {
        row = lines[i].split('\t');
        //Ensure that the row has the correct number of columns.
        if((row[header['Movie']]).includes( query.toString().toLowerCase().split(" ").join("").split("-").join(""))){
            return (row[header['Latitude']] + ',' + row[header['Longitude']]);
        }
    }
    return original;
}

function setMapToUserLocation() {
    //Request the user's location.
    navigator.geolocation.getCurrentPosition(function(position) {
        //Convert the Geolocation API position to a longitude and latitude position value that the map can interpret and center the map over it.
        map.setCamera({
            center: [position.coords.longitude, position.coords.latitude],
            zoom: maxClusterZoomLevel + 1
        });
    }, function(error) {
        //If an error occurs when the API tries to access the user's position information, display an error message.
        switch (error.code) {
            case error.PERMISSION_DENIED:
                alert('User denied the request for geolocation.');
                break;
            case error.POSITION_UNAVAILABLE:
                alert('Position information is unavailable.');
                break;
            case error.TIMEOUT:
                alert('The request to get user position timed out.');
                break;
            case error.UNKNOWN_ERROR:
                alert('An unknown error occurred.');
                break;
        }
    });
}

var listItemTemplate = '<div class="listItem" onclick="itemSelected(\'{id}\')"><div class="listItem-title">{title}</div>{city}<br />Open until {closes}<br />{distance} miles away</div>';

function updateListItems() {
    //Hide the center marker.
    centerMarker.setOptions({
        visible: false
    });

    //Get the current camera and view information for the map.
    var camera = map.getCamera();
    var listPanel = document.getElementById('listPanel');

    //Check to see whether the user is zoomed out a substantial distance. If they are, tell the user to zoom in and to perform a search or select the My Location button.
    if (camera.zoom < maxClusterZoomLevel) {
        //Close the pop-up window; clusters might be displayed on the map.  
        popup.close(); 
        listPanel.innerHTML = '<div class="statusMessage">Search for a MARVEL movie, click the Avenger log, or select the My Location button to see individual locations.</div>';
    } else {
        //Update the location of the centerMarker property.
        centerMarker.setOptions({
            position: camera.center,
            visible: true
        });

        //List the ten closest locations in the side panel.
        var html = [], properties;

        //Get all the shapes that have been rendered in the bubble layer. 
        var data = map.layers.getRenderedShapes(map.getCamera().bounds, [iconLayer]);

        //Create an index of the distances of each shape.
        var distances = {};

        data.forEach(function (shape) {
            if (shape instanceof atlas.Shape) {

                //Calculate the distance from the center of the map to each shape and store in the index. Round to 2 decimals.
                distances[shape.getId()] = Math.round(atlas.math.getDistanceTo(camera.center, shape.getCoordinates(), 'miles') * 100) / 100;
            }
        });

        //Sort the data by distance.
        data.sort(function (x, y) {
            return distances[x.getId()] - distances[y.getId()];
        });

        data.forEach(function(shape) {
            properties = shape.getProperties();
            html.push('<div class="listItem" onclick="itemSelected(\'', shape.getId(), '\')"><div class="listItem-title">',
            getMovie(properties),
            '</div>',
            //Get a formatted addressLine2 value that consists of City, Municipality, AdminDivision, and PostCode.
            getAddressLine2(properties),
            '<br />',

            properties['AddressLine'],
            '<br />',

            //Get the distance of the shape.
            distances[shape.getId()],
            ' miles away</div>');
        });

        listPanel.innerHTML = html.join('');

        //Scroll to the top of the list panel in case the user has scrolled down.
        listPanel.scrollTop = 0;
    }
}

//When a user selects a result in the side panel, look up the shape by its ID value and display the pop-up window.
function itemSelected(id) {
    //Get the shape from the data source by using its ID.  
    var shape = datasource.getShapeById(id);
    showPopup(shape);

    //Center the map over the shape on the map.
    var center = shape.getCoordinates();
    var offset;

    //If the map is less than 700 pixels wide, then the layout is set for small screens.
    if (map.getCanvas().width < 700) {
        //When the map is small, offset the center of the map relative to the shape so that there is room for the popup to appear.
        offset = [0, -80];
    }

    map.setCamera({
        center: center,
        centerOffset: offset
    });
}

// Determine Formal Movie Name Through Input
function getMovie(properties){
    var movie = properties['FormalName'];
    return 'Marvel Movie：' + movie;
}

function showPopup(shape) {
    var properties = shape.getProperties();

     //Calculate the distance from the center of the map to the shape in miles, round to 2 decimals.
     var distance = Math.round(atlas.math.getDistanceTo(map.getCamera().center, shape.getCoordinates(), 'miles') * 100)/100;

    var html = ['<div class="storePopup">'];
    html.push('<div class="popupTitle">',
        getMovie(properties),
        '<div class="popupSubTitle">',

        getAddressLine2(properties),
        '</div></div><div class="popupContent">',

        properties['AddressLine'],

        //Add the distance information.  
        '<br/>', distance,
        ' miles away',
    );
    html.push('</div></div>');

    //Update the content and position of the pop-up window for the specified shape information.
    popup.setOptions({

        //Create a table from the properties in the feature.
        content:  html.join(''),
        position: shape.getCoordinates()
    });

    //Open the pop-up window.
    popup.open(map);
}

//Create an addressLine2 string that contains City, Municipality, AdminDivision, and PostCode.
function getAddressLine2(properties) {
    var html = [properties['City']];

    if (properties['Country']) {
        html.push(', ', properties['Country']);
    }
    return html.join('');
}


//Initialize the application when the page is loaded.
window.onload = initialize;