// Bloque CBAM de la home: recorrido por las pantallas de la aplicación.
// Avanza solo cada pocos segundos, se pausa al pasar el ratón y se puede elegir el paso.
// Sin JavaScript se ve la primera pantalla.
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('.cbam-launch-app').forEach(function (app) {
    var screens = app.querySelectorAll('.cbam-app-screens img');
    var steps = app.querySelectorAll('.cbam-app-steps button');
    if (!screens.length || screens.length !== steps.length) return;
    var current = 0, timer = null, DELAY = 4000;

    function show(i) {
      current = (i + screens.length) % screens.length;
      for (var k = 0; k < screens.length; k++) {
        screens[k].classList.toggle('is-active', k === current);
        steps[k].classList.toggle('is-active', k === current);
        steps[k].setAttribute('aria-pressed', k === current ? 'true' : 'false');
      }
      // Reinicia la barra de progreso del paso activo
      app.classList.remove('is-running');
      void app.offsetWidth;
      if (timer) app.classList.add('is-running');
    }
    function stop() { clearInterval(timer); timer = null; app.classList.remove('is-running'); }
    function start() {
      if (reduce || timer) return;
      timer = setInterval(function () { show(current + 1); }, DELAY);
      app.classList.add('is-running');
    }

    for (var i = 0; i < steps.length; i++) {
      (function (idx) {
        steps[idx].addEventListener('click', function () { stop(); show(idx); start(); });
      })(i);
    }
    app.addEventListener('mouseenter', stop);
    app.addEventListener('mouseleave', start);
    app.addEventListener('focusin', stop);

    // Las imágenes no se cargan ni el carrusel avanza hasta que el bloque es visible
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            for (var k = 0; k < screens.length; k++) screens[k].loading = 'eager';
            show(0); start(); obs.disconnect();
          }
        });
      }, { threshold: 0.3 }).observe(app);
    } else {
      show(0); start();
    }
  });
})();
