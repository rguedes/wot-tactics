//Client Side

// Global vars
var stage, map, container, client, selectedTool, nick, drawLayer,room;
var palette = {};

// Close the socket before the window closes to free up memory
$(window).on('beforeunload', function(){
    client.emit('unsubscribe', room);
    client.close();
});

$(document).ready(function() {
	// Init of tactic viewer
	var selector = $("#map-select");
	var shape, down = false;
	
	client = io("http://localhost:3000");
    room = urlParam('room');
    if(room == null)
        room = "general";
    
    console.log(room);
        
    client.emit('subscribe', room);
    
	container = $("#canvas-container");
	stage = new Kinetic.Stage({
		container: "canvas-container",
		width: container.width(),
		height: container.width()
	});

	// Init the draw layer and add it to the stage
	drawLayer = new Kinetic.Layer({
		name: "draw"
	});
	drawLayer.add(new Kinetic.Rect({
		x: 0, y: 0,
		width: container.width(),
		height: container.width(),
		name: "drawBounds"
	}));
	stage.add(drawLayer);

	// Setup event handling for the draw layer
	drawLayer.on("mousedown", function(e) {
		if(!nick) return;

		var id = $.now();

		switch(selectedTool) {
			case "ping-map":
				// TODO: Add line pings
				client.emit("pingMap", {
					x: e.evt.layerX, y: e.evt.layerY,
					colour: palette["ping-map-colour"],
					from: nick,
                    room: room
				});
				break;
			case "draw-square":
				// Start drawing a rect on the client
				var colour = palette["draw-csq-opts-colour"];

				down = true;
				shape = new Kinetic.Rect({
					name: "rect" + id,
					x: e.evt.layerX, y: e.evt.layerY,
					width: 1, height: 1,
					fill: "rgba(" + colour.r + ", " + 
						colour.g + ", " + 
						colour.b + ", 1)",
					draggable: true
				});

				// Set on drag listeners for the rect and draw it
				shape.on("dragstart", function(e) {
					e.target.moveToTop();
				});
				shape.on("dragend", function(e) {
					client.emit("dragNode", {
						name: e.target.attrs.name,
						x: e.target.attrs.x, y: e.target.attrs.y,
						from: nick,
                        room: room
					});
				});
				shape.on("mouseover", function(e) {
					container.css({
						cursor: "move"
					});
				});
				shape.on("mouseout", function(e) {
					container.css({
						cursor: "auto"
					});
				});

				drawLayer.add(shape);
				break;
			case "draw-circle":
				// Start drawing a circle on the client
				var colour = palette["draw-csq-opts-colour"];

				down = true;
				shape = new Kinetic.Circle({
					name: "circle" + id,
					x: e.evt.layerX, y: e.evt.layerY,
					radius: 1,
					fill: "rgba(" + colour.r + ", " + 
						colour.g + ", " + 
						colour.b + ", 1)",
					draggable: true
				});

				// Set on drag listeners for the circle and draw it
				shape.on("dragstart", function(e) {
					e.target.moveToTop();
				});
				shape.on("dragend", function(e) {
					client.emit("dragNode", {
						name: e.target.attrs.name,
						x: e.target.attrs.x, y: e.target.attrs.y,
						from: nick,
                        room: room
					});
				});
				shape.on("mouseover", function(e) {
					container.css({
						cursor: "move"
					});

					new Kinetic.Tween({
						node: shape,
						duration: 0.25,
						easing: Kinetic.Easings.EaseInOut,
						opacity: 0.8
					}).play();
				});
				shape.on("mouseout", function(e) {
					container.css({
						cursor: "auto"
					});

					new Kinetic.Tween({
						node: shape,
						duration: 0.25,
						easing: Kinetic.Easings.EaseInOut,
						opacity: 1
					}).play();
				});

				drawLayer.add(shape);
				break;
			case "draw-line":
				// TODO: Draw a line
				break;
		}
	});

	drawLayer.on("mousemove", function(e) {
		if(!down) return;

		switch(selectedTool) {
			case "draw-square":
				// Update the rect being drawn on the client
				var pos = shape.attrs;

				shape.setWidth(e.evt.layerX - pos.x);
				shape.setHeight(e.evt.layerY - pos.y);
				drawLayer.draw();

				break;
			case "draw-circle":
				// Update the circle being drawn on the client
				var pos = shape.attrs;
				var radius = Math.round(Math.sqrt(Math.pow(e.evt.layerX - pos.x, 2) + Math.pow(e.evt.layerY - pos.y, 2)));

				shape.setRadius(radius);
				drawLayer.draw();

				break;
		}
	});

	drawLayer.on("mouseup", function(e) {
		down = false;

		switch(selectedTool) {
			case "draw-square":
				// Send the new rect to other clients
				var attrs = shape.attrs;

				client.emit("drawNode", {
					type: "rect",
					x: attrs.x, y: attrs.y,
					width: attrs.width, height: attrs.height,
					fill: attrs.fill, 
					name: attrs.name,
					from: nick,
                    room: room
				});
				break;
			case "draw-circle":
				// Send the new circle to other clients
				var attrs = shape.attrs;

				client.emit("drawNode", {
					type: "circle",
					x: attrs.x, y: attrs.y,
					radius: attrs.radius,
					fill: attrs.fill, 
					name: attrs.name,
					from: nick,
                    room: room
				});
				break;
		}
	});

	// Disable all inputs for disconnected states, enabling them only when connected
	disableInputs(true);

	client.on("connect", function() {
		if(!nick) {
			$("#username-submit, #username-input").prop("disabled", false);
		} else {
			disableInputs(false);
		}
	});
	client.on("disconnect", function() {
		disableInputs(true);
	});

	// Setup map changer
	selector.change(function() {
		map = "../img/" + $(this).find(":selected").val() + ".png";
		client.emit("changeMap", {"map": map, room: room});
	});

	// Record any changes to the user's submitted nickname
	$("#username-submit").click(function() {
		if($("#username-input").val()) {
			nick = $("#username-input").val();
		} else {
			$("#username-input").val(nick);
		}

		// Hide inputs if the nickname chosen is empty/undefined
		disableInputs(nick ? false : true);

		if(!nick) {
			$("#username-submit, #username-input").prop("disabled", false);
		}
	});

	// Setup tools
	$(".tool").hide();
	$(".btn").click(function() {
		selectedTool = $(this).attr("id");

		// If the button isn't a tool button then hide all tools
		if(!$(this).hasClass("tool")) {
			$(".tool").hide();
		}

		// Remove the active css + apply it to current button if needed
		$(".btn").removeClass("btn-active");
		if(!$(this).hasClass("btn-no-hold")) {
			$(this).addClass("btn-active");

			// If the button is associated with a tool (or set) then show the tool(s)
			if($(this).data("tool")) {
				$("#" + $(this).data("tool")).show();
				$("label[for='" + $(this).data("tool") + "']").show();
			}
		}

		if($(this).attr("id") == "clear-map") {
			// TODO: Clear the map
			client.emit("clearMap", {room: room});
		}
	});
	// Store all colours in associative array and set on change for each picker
	$(".colour-tool").each(function(element) {
		palette[$(this).attr("id")] = hexToRgb($(this).val());
	}).change(function(element) {
		palette[$(this).attr("id")] = hexToRgb($(this).val());
	});

	// Add maps to the map selector using the mappings JSON
	$.ajax({
		url: "../js/mappings.json",
		success: function(data) {
			var mappings = data["maps"];

			$.each(mappings, function(key, value) {
				selector
					.append($("<option></option>")
					.attr("value", value)
					.text(key));
			});
		}
	});

	// Setup socket events
	// Change the map
	client.on("changeMap", function(data) {
		map = data["map"];
		selector.val(map.replace("../img/", "").replace(".png", ""));
		changeMap();
	});

	// Clear the map 
	client.on("clearMap", function(data) {
		drawLayer.removeChildren();
		drawLayer.add(new Kinetic.Rect({
			x: 0, y: 0,
			width: container.width(),
			height: container.width(),
			name: "drawBounds"
		}));
		drawLayer.draw();
	});

	// Move a node that has been dragged across screen
	client.on("dragNode", function(data) {
		if(data.from == nick) return;

		// Get the node and place it on top of all siblings
		var shape = drawLayer.find("." + data.name)[0];

		if(!shape) {
			socket.emit("redrawNodes", {});
		}

		shape.moveToTop();

		// Animate node to new position
		new Kinetic.Tween({
			node: shape,
			duration: 0.25,
			x: data.x, y: data.y,
			easing: Kinetic.Easings.EaseInOut
		}).play();
	});

	// Draw a new node on the map
	client.on("drawNode", function(data) {
		if(data.from == nick) return;

		var shape;

		// Draw different shapes based on the type to be drawn
		switch(data.type) {
			case "rect":
				shape = new Kinetic.Rect({
					x: data.x, y: data.y,
					width: data.width, height: data.height,
					fill: data.fill,
					name: data.name,
					draggable: true
				});

				break;
			case "circle":
				shape = new Kinetic.Circle({
					x: data.x, y: data.y,
					radius: data.radius,
					fill: data.fill,
					name: data.name,
					draggable: true
				});

				break;
			default:
				return;
		}

		// Set the on drag listeners for the shape and draw it
		shape.on("dragstart", function(e) {
			e.target.moveToTop();
		});
		shape.on("dragend", function(e) {
			client.emit("dragNode", {
				name: e.target.attrs.name,
				x: e.target.attrs.x, y: e.target.attrs.y,
				from: nick
			});
		});
		shape.on("mouseover", function(e) {
			container.css({
				cursor: "move"
			});

			new Kinetic.Tween({
				node: shape,
				duration: 0.25,
				easing: Kinetic.Easings.EaseInOut,
				opacity: 0.8
			}).play();
		});
		shape.on("mouseout", function(e) {
			container.css({
				cursor: "auto"
			});

			new Kinetic.Tween({
				node: shape,
				duration: 0.25,
				easing: Kinetic.Easings.EaseInOut,
				opacity: 1
			}).play();
		});

		drawLayer.add(shape).draw();
	});

	// Add a ping to the map, animate it and remove it with text of origin
	client.on("pingMap", function(data) {
		var ping = new Kinetic.Circle({
			radius: 5,
			fill: "rgba(" + data.colour.r + ", " + 
				data.colour.g + ", " + 
				data.colour.b + ", 1)",
			x: data.x, y: data.y,
			name: "ping"
		});
		var text = new Kinetic.Text({
			text: data.from,
			fill: "rgba(" + data.colour.r + ", " + 
				data.colour.g + ", " + 
				data.colour.b + ", 1)",
			name: "pingText"
		});

		text.x(data.x - text.getWidth() / 2);
		text.y(data.y + 20);

		drawLayer.add(text)
		drawLayer.add(ping);
		drawLayer.draw();		

		new Kinetic.Tween({
			node: ping,
			duration: 0.3,
			radius: 30,
			easing: Kinetic.Easings.EaseInOut,
			opacity: 0,
			onFinish: function() {
				ping.remove();

				new Kinetic.Tween({
					node: text,
					duration: 0.2,
					opacity: 0,
					easing: Kinetic.Easings.EaseInOut,
					onFinish: function() {
						text.remove();
					}
				}).play();
			}
		}).play();
	});
});

/**
 * Function that enables or disables all inputs on the page
 * @param {Boolean} disable - True to disable inputs, false to enable them.
 */
function disableInputs(disable) {
	$("button, input, select").prop("disabled", disable);
}

/**
 * Function that changes the map to the one provided. Defaults to Karelia.
 */
function changeMap() {
	// Init map to default if its not intialised
	map = map || "../img/01_karelia.jpg";

	// Determine if a map is already loaded
	if(stage.find(".bg").length == 0) {
		var mapLayer = new Kinetic.Layer({
			name: "bg"
		}), mapImageObj = new Image(), 
		overlayImageObj = new Image();

		// Load image into layer and display the new layer
		mapImageObj.onload = function() {
			var mapImage = new Kinetic.Image({
				x: 0, y: 0,
				image: mapImageObj,
				width: 750, height: 750,
				name: "mapImage"
			});

			// Then load the map overlay
			overlayImageObj.onload = function() {
				var overlayImage = new Kinetic.Image({
					x: 0, y: 0,
					image: overlayImageObj,
					width: 750, height: 750,
					name: "overlayImage",
					opacity: 0.5
				});

				// Then set up the map background and render it to the stage
				mapLayer.add(mapImage);
				mapLayer.add(overlayImage);
				stage.add(mapLayer);
				stage.add(drawLayer);
			}
			overlayImageObj.src = "../img/overlay.png";
		};
		mapImageObj.src = map;
	} else {
		// Load image into layer and display the new layer
		var mapImageObj = new Image();

		mapImageObj.onload = function() {
			var bgLayer = stage.find(".bg")[0];

			bgLayer.find(".mapImage").setImage(mapImageObj);
			bgLayer.draw();
		};
		mapImageObj.src = map;
	}

	// If the draw layer is initialised then move it to the front
	if(drawLayer) {
		drawLayer.moveToTop();
	}
}

/**
 * Function that changes a hexadecimal value to rgb values in Object form
 * @param {string} hex - A hexadecimal colour value i.e.: #0000ff
 */
function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

var urlParam = function(name){
    var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(window.location.href);
    if (results==null){
       return null;
    }
    else{
       return results[1] || 0;
    }
}