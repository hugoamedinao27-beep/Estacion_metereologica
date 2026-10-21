/* =========================================================
   PetGuard · PetSafe IoT — Interacciones mínimas
   Menú móvil + resaltado de sección activa + scroll suave
   ========================================================= */

(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    var nav = document.getElementById("primaryNav");
    var toggle = document.getElementById("navToggle");

    /* ---------- Menú móvil ---------- */
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

    /* ---------- Cerrar el menú al cambiar de tamaño ---------- */
    var lastWidth = window.innerWidth;
    window.addEventListener("resize", function () {
      if (window.innerWidth > 860 && lastWidth <= 860 && nav) {
        nav.classList.remove("is-open");
        if (toggle) toggle.setAttribute("aria-expanded", "false");
      }
      lastWidth = window.innerWidth;
    });

    /* ---------- Resaltar enlace de la sección visible ---------- */
    var links = Array.prototype.slice.call(
      document.querySelectorAll('.primary-nav a[href^="#"]')
    );
    var sections = links
      .map(function (link) {
        var id = link.getAttribute("href").slice(1);
        return id ? document.getElementById(id) : null;
      })
      .filter(Boolean);

    if ("IntersectionObserver" in window && sections.length) {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            var id = entry.target.id;
            links.forEach(function (link) {
              link.classList.toggle(
                "is-active",
                link.getAttribute("href") === "#" + id
              );
            });
          });
        },
        { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
      );

      sections.forEach(function (section) {
        observer.observe(section);
      });
    }
  });
})();
