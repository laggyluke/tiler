/**
 * Tiler 0.1.0
 *
 * Library for the displaying of a content as an
 * infinite grid of tiles. For more info visit:
 * https://github.com/borbit/tiler/
 *
 * Copyright (c) 2011-2012 Serge Borbit <serge.borbit@gmail.com>
 *
 * Licensed under the MIT license
 */

(function($) {

/**
 * Constructor
 *
 * @param {jQuery|DOM} element
 * @param {Object} options
 */
function Tiler(element, options) {
  // Initializing options by Extending the default by custom
  this.options = $.extend({}, Tiler.defaults, options)

  // Tiles elements will be saved here
  this.tiles = new Grid()

  // Saving the viewport element as a property
  this.element = element.jquery ? element : $(element)

  // Current coordinates of the top left visible tile
  this.x = this.options.x
  this.y = this.options.y

  // Creating the grid element that will contain tiles. Appending it
  // to the viewport element. Binding 'dragstop' event to the 'refresh'
  // method to sync tiles each time grid was dragged.
  this.grid = $('<div/>')
      .bind('dragstop', $.proxy(this, 'refresh'))
      .css('position', 'absolute')
      .appendTo(element)

  this.calcRowsColsCount()
  this.calcCornersCoords()

  // Arrange grid element
  this.setGridPosition()
  this.setGridSize()
}

/**
 * Default options
 */
Tiler.defaults = {
  sync: null
, tileSize: null
, margin: 2
, x: 0, y: 0
}

var Proto = Tiler.prototype

/**
 * Sets the initial grid position
 *
 * @api private
 */
Proto.setGridPosition = function() {
  this.initialGridPosition = {
    left: -(this.options.tileSize * this.options.margin)
  , top: -(this.options.tileSize * this.options.margin)
  }

  this.grid.css(this.initialGridPosition)
}

/**
 * If arguments are passed - changes current grid coordinates (top left visible tile)
 * and syncs/removes tiles as in the same way as `refresh` method does. If method
 * is called without arguments - returns current grid coordinates.
 *
 * @param {Number} x
 * @param {Number} y
 * @return {Object}
 * @api public
 */
Proto.coords = function(x, y) {
  if (!arguments.length) {
    return {x: this.x, y: this.y}
  }
  
  var offset = {
    x: this.x - x
  , y: this.y - y
  }

  this.x = x
  this.y = y

  this.shiftTilesPosition(offset)

  this.calcRowsColsCount()
  this.calcCornersCoords()

  this.setGridPosition()
  this.setGridSize()

  var removed = this.getHiddenTilesCoords()
    , toSync = this.getTilesCoordsToSync()
  
  this.remove(removed)
  this.syncTiles(toSync, removed)
}

/**
 * Calculates grid offset (how many tiles were hidden by x/y coords)
 * regarding the initial and new (absolute) position of the grid element
 *
 * @param {Object} newPosition {top: {Number}, left: {Number}}
 * @return {Object} offset {x: {Number}, y: {Number}}
 * @api private
 */
Proto.calcGridOffset = function(newPosition) {
  return {
    x: parseInt((newPosition.left - this.initialGridPosition.left) / this.options.tileSize, 10)
  , y: parseInt((newPosition.top - this.initialGridPosition.top) / this.options.tileSize, 10)
  }
}

/**
 * Sets grid size regarding the grid size and tile size
 *
 * @api private
 */
Proto.setGridSize = function() {
  this.grid.height(this.rowsCount * this.options.tileSize)
  this.grid.width(this.colsCount * this.options.tileSize)
}

/**
 * Shifts grid position (absolute) regarding the passed offset
 *
 * @param {Object} offset {x: {Number}, y: {Number}}
 * @api private
 */
Proto.shiftGridPosition = function(offset) {
  var position = this.grid.position()

  if (offset.y != 0) {
    position.top -= offset.y * this.options.tileSize
  }
  if (offset.x != 0) {
    position.left -= offset.x * this.options.tileSize
  }

  this.grid.css(position)
}

/**
 * Removes tiles that don't fall within the current grid coordinates
 * and syncs absent tiles. This method is called automatically after the
 * `dragstop` event triggered by the grid element. You should call this
 * method if grid was dragged in a way that doesn't trigger `dragstop`
 * event or viewport size is changed, also in case unless all tiles are
 * present after the sync and you have to sync absent tiles only.
 * 
 * @api public
 */
Proto.refresh = function() {
  var offset = this.calcGridOffset(this.grid.position())

  this.x -= offset.x
  this.y -= offset.y

  this.calcRowsColsCount()
  this.calcCornersCoords()
  this.setGridSize()

  var removed = this.getHiddenTilesCoords()
    , tosync = this.getTilesCoordsToSync()

  this.remove(removed)
  this.shiftGridPosition(offset)
  this.shiftTilesPosition(offset)
  this.syncTiles(tosync, removed)
}

/**
 * Resyncs all tiles that fall within the grid coordinates
 *
 * @api public
 */
Proto.reload = function() {
  this.syncTiles(this.getAllTilesCoords(), []);
}

/**
 * Removes tiles by passed coordinates
 *
 * @param {Array} coords [[x1, y1], [x2, y2], ...]
 * @api private
 */
Proto.remove = function(x, y) {
  var coords = $.isArray(x) ? x : [[x, y]]
  var removed = []

  for (var i = 0, l = coords.length; i < l; i++) {
    x = coords[i][0]
    y = coords[i][1]

    if (this.tiles.get(x, y)) {
      this.tiles.get(x, y).remove()
      this.tiles.remove(x, y)
      removed.push([x, y])
    }
  }

  return removed
}

/**
 * Shifts tiles position (absolute) regarding the passed offset
 *
 * @param {Object} offset {x: {Number}, y: {Number}}
 * @api private
 */
Proto.shiftTilesPosition = function(offset) {
  this.tiles.each(function(tile) {
    var position = tile.position()
    tile.css({
      'left': position.left + this.options.tileSize * offset.x
    , 'top': position.top + this.options.tileSize * offset.y
    })
  }, this)
}

/**
 * Returns array of tiles coordinates that should be present on a grid
 *
 * @return {Array} [[x1, y1], [x2, y2], ...]
 * @api private
 */
Proto.getTilesCoordsToSync = function() {
  var toSync = []
    , all = this.getAllTilesCoords()
    , x, y

  for(var i = 0, l = all.length; i < l; i++) {
    x = all[i][0]
    y = all[i][1]

    if (!this.tiles.get(x, y)) {
      toSync.push([x, y])
    }
  }
  return toSync
}

/**
 * Returns array of tiles coordinates which coordinates don't fall
 * within the grid area. Method is used to determine which tiles were
 * hidden after the grid was dragged or grid position was changed
 *
 * @return {Array} [[x1, y1], [x2, y2], ...]
 * @api private
 */
Proto.getHiddenTilesCoords = function() {
  var coords = []
    , self = this

  this.tiles.each(function(tile, x, y) {
    if (y < self.corners.y1 || y > self.corners.y2 ||
        x < self.corners.x1 || x > self.corners.x2) {
      coords.push([x, y])
    }
  })
  return coords
}

/**
 * Returns array of tiles coordinates which do fall within the grid area.
 *
 * @return {Array} [[x1, y1], [x2, y2], ...]
 * @api private
 */
Proto.getAllTilesCoords = function() {
  var coords = []

  for(var y = this.corners.y1; y <= this.corners.y2; y++) {
  for(var x = this.corners.x1; x <= this.corners.x2; x++) {
    coords.push([x, y])
  }}
  return coords
}

/**
 * Syncs tiles
 *
 * @param {Array} tosync Array of tiles coordinates that should be synced
 * @param {Array} removed Array of tiles coordinates that were removed/hidden from the grid
 * @api private
 */
Proto.syncTiles = function(tosync, removed) {
  if (tosync.length == 0) {
    return
  }
  if ($.isFunction(this.options.sync)) {
    this.options.sync(tosync, removed);
  }
}

/**
 * Shows tiles
 *
 * @param {Array} tiles - array of coordinates [[x1, y1, elem1], [x2, y2, elem2], ...]
 * @api public
 */
Proto.show = function(x, y, tile) {
  var tiles = $.isArray(x) ? x : [[x, y, tile]];
  var fragment = document.createDocumentFragment()

  for(var i = 0, l = tiles.length; i < l; i++) {
    var tile = tiles[i][2]
    x = tiles[i][0]
    y = tiles[i][1]
    
    !tile.jquery && (tile = $(tile))
    
    if (y < this.corners.y1 || y > this.corners.y2 ||
        x < this.corners.x1 || x > this.corners.x2) {
      continue
    }

    fragment.appendChild(tile.get(0))

    if (this.tiles.get(x, y)) {
      this.tiles.get(x, y).remove()
    }
    this.tiles.set(x, y, tile)
  }

  this.grid.append(fragment)
  this.arrangeTiles()
}

/**
 * Arranges tiles position
 *
 * @api private
 */
Proto.arrangeTiles = function() {
  var size = this.options.tileSize
    , corners = this.corners

  this.tiles.each(function(tile, x, y) {
    tile.css({
      'position': 'absolute'
    , 'left': (x - corners.x1) * size
    , 'top': (y - corners.y1) * size
    })
  })
}

/**
 * Calculates grid's columns count
 *
 * @return {Number}
 * @api private
 */
Proto.calcColsCount = function() {
  var width = this.element.width()
    , op = this.options

  if (width && op.tileSize) {
    return Math.ceil(width / op.tileSize) + op.margin * 2
  }
  return 0
}

/**
 * Calculates grid's rows count
 *
 * @return {Number}
 * @api private
 */
Proto.calcRowsCount = function() {
  var height = this.element.height()
    , op = this.options

  if (height && op.tileSize) {
    return Math.ceil(height / op.tileSize) + op.margin * 2
  }
  return 0
}

/**
 * Calculates and sets current rows and cols count
 *
 * @api private
 */
Proto.calcRowsColsCount = function() {
  this.rowsCount = this.calcRowsCount()
  this.colsCount = this.calcColsCount()
}

/**
 * Calculates and sets the current corner tiles coordinates
 *
 * @api private
 */
Proto.calcCornersCoords = function() {
  var x1 = this.x - this.options.margin
    , y1 = this.y - this.options.margin

  this.corners = {
    x1: x1, y1: y1
  , x2: x1 + this.colsCount - 1
  , y2: y1 + this.rowsCount - 1
  }
}

window.Tiler = Tiler

})(jQuery)
