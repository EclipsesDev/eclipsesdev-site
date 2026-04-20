const EVENTS = {
  NAV: "popstate",
  LOAD: "DOMContentLoaded"
};
const API = ["https://api.", "eclipsesdev", ".top/changelog/"].join("");
let changelogLoaded = false;

function normalizePath(pathname) {
  if (!pathname) return "/";
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

function syncActiveNavButton(id) {
  const nav = document.querySelector(".nav-bar");
  if (!nav) return;

  nav.querySelectorAll("button.active").forEach((button) => {
    button.classList.remove("active");
  });

  let targetButton = nav.querySelector(`[data-section="${id}"]`);

  if (!targetButton) {
    const currentPath = normalizePath(window.location.pathname);
    nav.querySelectorAll("a[href]").forEach((link) => {
      if (targetButton) return;
      const linkPath = normalizePath(new URL(link.href, window.location.origin).pathname);
      if (linkPath === currentPath) {
        const nestedButton = link.querySelector("button");
        if (nestedButton) targetButton = nestedButton;
      }
    });
  }

  if (!targetButton && id === "home") {
    targetButton = nav.querySelector('[data-section="home"]')
      || nav.querySelector('a[href="/"] button');
  }

  targetButton?.classList.add("active");
}

function activateSection(id) {
  const sections = document.querySelectorAll(".section");

  sections.forEach(sec => {
    sec.hidden = sec.id !== id;
  });

  syncActiveNavButton(id);

  if (id === "changelog" && !changelogLoaded) {
    loadChangelog();
    changelogLoaded = true;
  }
}

async function loadChangelog() {
  try {
    const res = await fetch(API);

    if (!res.ok) {
      throw new Error("Failed to fetch changelog");
    }

    const logs = await res.json();

    const container = document.getElementById("changelog-logs");
    container.innerHTML = "".trim();

    const fragment = document.createDocumentFragment();

    // Sort logs by date (newest first) test debug
    logs.sort((a, b) => new Date(b.date) - new Date(a.date));

    logs.forEach(log => {
      const section = document.createElement("div");
      section.className = "log-section";

      const title = document.createElement("div");
      title.className = "log-title";
      title.textContent = `Dev Log ${log.date}`;

      const project = document.createElement("div");
      project.className = "log-project";
      project.textContent = log.project;

      const list = document.createElement("ul");

      log.changes.forEach(change => {
        const li = document.createElement("li");
        li.textContent = change;
        list.appendChild(li);
      });

      section.append(title, project, list);
      fragment.appendChild(section);
    });

    container.appendChild(fragment);

  } catch (err) {
    console.error("Changelog load error:", err);

    const container = document.getElementById("changelog-logs");
    container.innerHTML = "<p>Failed to load changelog.</p>";
  }
}

document.querySelectorAll(".nav-bar button[data-section]").forEach(button => {
  button.addEventListener("click", () => {
    const target = button.dataset.section;
    activateSection(target);
  });
});

window.addEventListener(EVENTS.NAV, () => {
  const section = window.location.pathname.split("/")[1] || "home";
  activateSection(section);
});

document.addEventListener(EVENTS.LOAD, () => {
  const section = window.location.pathname.split("/")[1] || "home";
  activateSection(section);
});