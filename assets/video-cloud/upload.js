const form = document.getElementById("upload-form");
const progressBar = document.getElementById("progress-bar");
const uploadMode = document.getElementById("upload-mode");
const videoFileInput = document.getElementById("video-file");
const videoUrlInput = document.getElementById("video-url");
const inputs = form?.querySelectorAll("input[type='text'], input[type='file'], input[type='url']");

function refreshUploadModeUi() {
  if (!uploadMode || !videoFileInput || !videoUrlInput) return;

  const isUrlMode = uploadMode.value === "url";

  videoFileInput.style.display = isUrlMode ? "none" : "block";
  videoFileInput.required = !isUrlMode;

  videoUrlInput.style.display = isUrlMode ? "block" : "none";
  videoUrlInput.required = isUrlMode;

  if (isUrlMode) {
    videoFileInput.value = "";
  } else {
    videoUrlInput.value = "";
  }
}

if (uploadMode) {
  uploadMode.addEventListener("change", refreshUploadModeUi);
}

refreshUploadModeUi();

if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const isUrlMode = uploadMode?.value === "url";
    const file = videoFileInput?.files?.[0];
    const sourceUrl = videoUrlInput?.value?.trim() || "";

    if (!isUrlMode && !file) {
      alert("Select a video!");
      return;
    }

    if (isUrlMode && !sourceUrl) {
      alert("Paste a video URL!");
      return;
    }

    let parsedUrl = null;
    if (isUrlMode) {
      try {
        parsedUrl = new URL(sourceUrl);
      } catch {
        alert("Please enter a valid URL.");
        return;
      }

      if (!/^https?:$/.test(parsedUrl.protocol)) {
        alert("Only http(s) URLs are allowed.");
        return;
      }
    }

    const titleInput = document.getElementById("video-title");
    const descriptionInput = document.getElementById("video-description");
    const title = titleInput?.value?.trim() || file?.name || "Untitled";
    const description = descriptionInput?.value?.trim() || "";

    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", description);

    if (isUrlMode && parsedUrl) {
      formData.append("url", parsedUrl.href);
    } else if (file) {
      formData.append("file", file);
    }

    if (progressBar) {
      progressBar.style.display = "block";
    }

    const xhr = new XMLHttpRequest();
    const endpoint = isUrlMode ? "/video-api/upload-video-from-url" : "/video-api/upload-video";
    xhr.open("POST", endpoint, true);
    xhr.upload.onprogress = (progressEvent) => {
      if (!progressBar) return;
      if (progressEvent.lengthComputable) {
        progressBar.value = Math.round((progressEvent.loaded / progressEvent.total) * 100);
      }
    };

    xhr.onload = () => {
      if (progressBar) {
        progressBar.value = 100;
        progressBar.style.display = "none";
      }

      alert(xhr.responseText);
      inputs?.forEach((input) => {
        input.value = "";
      });

      if (uploadMode) {
        uploadMode.value = "file";
      }
      refreshUploadModeUi();
    };

    xhr.onerror = () => {
      alert("Upload failed!");
      if (progressBar) {
        progressBar.style.display = "none";
      }
    };

    xhr.send(formData);
  });
}
