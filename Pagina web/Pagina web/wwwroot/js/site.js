/* MeteoGuard — interacciones de la interfaz: menú móvil */
(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    var nav = document.getElementById("primaryNav");
    var toggle = document.getElementById("navToggle");

    if (toggle && nav) {
      toggle.addEventListener("click", function () {
        var isOpen = nav.classList.toggle("is-open");
        toggle.setAttribute("aria-expanded", String(isOpen));
        toggle.setAttribute(
          "aria-label",
          isOpen ? "Cerrar menú de navegación" : "Abrir menú de navegación"
        );
      });

      nav.addEventListener("click", function (event) {
        if (event.target.closest("a")) {
          nav.classList.remove("is-open");
          toggle.setAttribute("aria-expanded", "false");
          toggle.setAttribute("aria-label", "Abrir menú de navegación");
        }
      });
    }

    var lastWidth = window.innerWidth;
    window.addEventListener("resize", function () {
      if (window.innerWidth > 860 && lastWidth <= 860 && nav) {
        nav.classList.remove("is-open");
        if (toggle) toggle.setAttribute("aria-expanded", "false");
      }
      lastWidth = window.innerWidth;
    });
  });
})();
