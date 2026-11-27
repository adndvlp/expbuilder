// Soporte SOLO para la verificación del emulador con Node 26: Node 26 eliminó
// `buffer.SlowBuffer`, que `buffer-equal-constant-time` (dependencia del stack
// de auth de firebase-admin) todavía referencia. No afecta producción.
const buffer = require("buffer");
if (!buffer.SlowBuffer) buffer.SlowBuffer = buffer.Buffer;
