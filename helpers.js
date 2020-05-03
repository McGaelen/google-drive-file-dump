module.exports = l = function() {
  console.log.apply(this, arguments);
}

/**
 * like pop(), but without actually removing
**/
Array.prototype.peek = function() {
  return this[this.length - 1];
}
