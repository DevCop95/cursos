// Modo oscuro guardado en este navegador: se aplica antes de pintar (script normal en el <head>, sin defer)
// para que no haya un destello claro al cargar. El cambio lo hace js/lib/theme.js.
(function () {
  try {
    if (localStorage.getItem('dev101x_theme') === 'dark') document.documentElement.classList.add('theme-dark');
  } catch (e) { /* sin almacenamiento: modo claro */ }
})();
