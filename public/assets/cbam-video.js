// Reproductor del vídeo CBAM: botón de play propio sobre el póster y capítulos clicables.
// Sin JavaScript el <video> conserva los controles nativos del navegador.
(function () {
  document.querySelectorAll('.cbam-band--video').forEach(function (section) {
    var player = section.querySelector('.cbam-video-player');
    var video = player && player.querySelector('video');
    var play = player && player.querySelector('.cbam-play');
    if (!video || !play) return;
    var chapters = Array.prototype.slice.call(section.querySelectorAll('.cbam-chapters button'));

    video.controls = false;
    play.hidden = false;

    function start(time) {
      if (typeof time === 'number') video.currentTime = time;
      video.controls = true;
      player.classList.add('is-playing');
      var p = video.play();
      if (p && p.catch) p.catch(function () {});
    }

    play.addEventListener('click', function () { start(); });
    video.addEventListener('play', function () {
      video.controls = true;
      player.classList.add('is-playing');
    });

    chapters.forEach(function (btn) {
      btn.addEventListener('click', function () {
        start(parseFloat(btn.getAttribute('data-time')) || 0);
      });
    });

    video.addEventListener('timeupdate', function () {
      var t = video.currentTime;
      chapters.forEach(function (btn, i) {
        var from = parseFloat(btn.getAttribute('data-time')) || 0;
        var next = chapters[i + 1] ? parseFloat(chapters[i + 1].getAttribute('data-time')) : Infinity;
        btn.classList.toggle('is-active', t >= from && t < next);
      });
    });
  });
})();
