// Se ejecuta antes de pintar (script normal en el <head>, sin defer) en toda página del sitio:
//  1. Modo oscuro guardado en este navegador (clase theme-dark). El cambio lo hace js/lib/theme.js.
//  2. Capa de temporada (clase xmas en <html>): Navidad del 2 de noviembre al 7 de enero. Se enciende y se apaga
//     sola por fecha, sin otro deploy. Para probar: ?navidad=1 (fuerza) o ?navidad=0 (apaga); se recuerda en la pestaña.
(function () {
  var root = document.documentElement;
  try {
    if (localStorage.getItem('dev101x_theme') === 'dark') root.classList.add('theme-dark');
  } catch (e) { /* sin almacenamiento: modo claro */ }

  var xmas;
  var d = new Date();
  var m = d.getMonth(); // 10 = noviembre, 11 = diciembre, 0 = enero
  xmas = (m === 10 && d.getDate() >= 2) || m === 11 || (m === 0 && d.getDate() <= 7);
  try {
    var q = /[?&]navidad=([01])/.exec(location.search);
    if (q) sessionStorage.setItem('dev101x_navidad', q[1]);
    var forced = sessionStorage.getItem('dev101x_navidad');
    if (forced === '1') xmas = true;
    else if (forced === '0') xmas = false;
  } catch (e) { /* sin almacenamiento: solo por fecha */ }
  if (xmas) root.classList.add('xmas');
})();
