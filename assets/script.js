let changelogLoaded = false;

function activateSection(id) {
  const sections = document.querySelectorAll(".section");

  sections.forEach(sec => {
    sec.hidden = sec.id !== id;
  });

  document.querySelector(".nav-bar .active")?.classList.remove("active");
  document.querySelector(`[data-section="${id}"]`)?.classList.add("active");

  if (id === "changelog" && !changelogLoaded) {
    loadChangelog();
    changelogLoaded = true;
  }
}

async function loadChangelog() {
  try {
    const res = await fetch("https://api.eclipsesdev.my.id/changelog/");

    if (!res.ok) {
      throw new Error("Failed to fetch changelog");
    }

    const logs = await res.json();

    const container = document.getElementById("changelog-logs");
    container.innerHTML = "".trim();

    const fragment = document.createDocumentFragment();

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

document.querySelectorAll(".nav-bar button").forEach(button => {
  button.addEventListener("click", () => {
    const target = button.dataset.section;
    activateSection(target);
  });
});

window.addEventListener("popstate", () => {
  const section = window.location.pathname.split("/")[1] || "home";
  activateSection(section);
});

document.addEventListener("DOMContentLoaded", () => {
  const section = window.location.pathname.split("/")[1] || "home";
  activateSection(section);
});