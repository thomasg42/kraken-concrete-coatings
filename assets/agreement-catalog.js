(function () {
      "use strict";
      var motion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!motion) document.documentElement.classList.add("js");

      var SYSTEMS = {
        flake: ["Decorative Flake", [
          ["Gravel", "assets/img/flake/gravel.webp"],
          ["Denim", "assets/img/flake/denim.webp"],
          ["Saddle Tan", "assets/img/flake/saddle-tan.webp"],
          ["Domino", "assets/img/flake/domino.webp"],
          ["Wombat", "assets/img/flake/wombat.webp"],
          ["Nightfall", "assets/img/flake/nightfall.webp"],
          ["Tidal Wave", "assets/img/flake/tidal-wave.webp"],
          ["Creekbed", "assets/img/flake/creekbed.webp"],
          ["Cabin Fever", "assets/img/flake/cabin-fever.webp"],
          ["Desert", "assets/img/flake/desert.webp"],
          ["Basalt", "assets/img/flake/basalt.webp"],
          ["Garnet Stone", "assets/img/flake/garnet-stone.webp"],
          ["Obsidian", "assets/img/flake/obsidian.webp"],
          ["Pumice", "assets/img/flake/pumice.webp"],
          ["Schist", "assets/img/flake/schist.webp"]
        ]],
        quartz: ["Quartz", [
          ["Desert Sand", "assets/img/quartz/desert-sand.webp"],
          ["Poise", "assets/img/quartz/poise.webp"],
          ["Caramel", "assets/img/quartz/caramel.webp"],
          ["Slate", "assets/img/quartz/slate.webp"],
          ["Coffee", "assets/img/quartz/coffee.webp"],
          ["Sandalwood", "assets/img/quartz/sandalwood.webp"],
          ["Sage Brush", "assets/img/quartz/sage-brush.webp"],
          ["Light Blue", "assets/img/quartz/light-blue.webp"],
          ["Blue Granite", "assets/img/quartz/blue-granite.webp"],
          ["Black Granite", "assets/img/quartz/black-granite.webp"]
        ]],
      };

      function chipStyle(src) {
        if (src.charAt(0) === "#") return "background:" + src;
        return "background-image:url('" + src + "')";
      }
      function swatch(system, name, src) {
        var label = document.createElement("label");
        label.className = "swatch";
        var input = document.createElement("input");
        input.type = "checkbox";
        input.name = "colors";
        input.value = system + " — " + name;
        var chip = document.createElement("span");
        chip.className = "chip";
        chip.setAttribute("style", chipStyle(src));
        var text = document.createElement("span");
        text.textContent = name;
        label.appendChild(input);
        label.appendChild(chip);
        label.appendChild(text);
        return label;
      }

      var catalog = document.getElementById("catalog");
      ["flake", "quartz"].forEach(function (key) {
        var pack = SYSTEMS[key];
        var family = document.createElement("div");
        family.className = key === "flake" ? "family family-preferred" : "family";
        var heading = document.createElement("h3");
        heading.textContent = key === "flake" ? "Decorative flake" : pack[0];
        family.appendChild(heading);
        if (key === "flake") {
          var prefer = document.createElement("p");
          prefer.className = "prefer";
          prefer.textContent = "We prefer decorative flake. The longevity is much better than quartz.";
          family.appendChild(prefer);
        }
        var grid = document.createElement("div");
        grid.className = "swatches";
        pack[1].forEach(function (row) {
          grid.appendChild(swatch(pack[0], row[0], row[1]));
        });
        family.appendChild(grid);
        catalog.appendChild(family);
      });

      if (!motion && "IntersectionObserver" in window) {
        var revealIO = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("in");
              revealIO.unobserve(entry.target);
            }
          });
        }, { threshold: 0.12 });
        document.querySelectorAll(".reveal").forEach(function (el) { revealIO.observe(el); });
      } else {
        document.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("in"); });
      }
      var bar = document.getElementById("progress");
      window.addEventListener("scroll", function () {
        var h = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + "%";
      }, { passive: true });


})();
