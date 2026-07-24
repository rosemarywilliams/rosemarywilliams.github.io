const API = {
  session: "/admin/api/session",
  artworks: "/admin/api/art",
  media: "/admin/api/media",
};

const MAX_SOURCE_BYTES = 30_000_000;
const DISPLAY_MAX_EDGE = 2400;
const THUMBNAIL_MAX_EDGE = 560;

const elements = {
  form: document.getElementById("art-form"),
  formTitle: document.getElementById("editor-title"),
  cancelEdit: document.getElementById("cancel-edit"),
  id: document.getElementById("art-id"),
  image: document.getElementById("art-image"),
  imagePreviewWrap: document.getElementById("image-preview-wrap"),
  imagePreview: document.getElementById("image-preview"),
  imageSummary: document.getElementById("image-summary"),
  title: document.getElementById("title"),
  altText: document.getElementById("alt-text"),
  medium: document.getElementById("medium"),
  year: document.getElementById("year"),
  dimensions: document.getElementById("dimensions"),
  featured: document.getElementById("featured"),
  hidden: document.getElementById("hidden"),
  formMessage: document.getElementById("form-message"),
  saveButton: document.getElementById("save-button"),
  saveLabel: document.getElementById("save-label"),
  signedInUser: document.getElementById("signed-in-user"),
  loadingState: document.getElementById("loading-state"),
  emptyState: document.getElementById("empty-state"),
  artList: document.getElementById("art-list"),
  cardTemplate: document.getElementById("art-card-template"),
  storageLabel: document.getElementById("storage-label"),
  storageProgress: document.getElementById("storage-progress"),
};

let artworks = [];
let selectedPreviewUrl = "";

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value < 1_000_000) return `${Math.max(0, Math.round(value / 1000))} KB`;
  if (value < 1_000_000_000) return `${(value / 1_000_000).toFixed(1)} MB`;
  return `${(value / 1_000_000_000).toFixed(2)} GB`;
}

function setMessage(message = "", kind = "") {
  elements.formMessage.textContent = message;
  if (kind) {
    elements.formMessage.dataset.kind = kind;
  } else {
    delete elements.formMessage.dataset.kind;
  }
}

function setBusy(isBusy, label = "") {
  elements.saveButton.disabled = isBusy;
  elements.saveLabel.textContent = isBusy ? label : (elements.id.value ? "Save changes" : "Add artwork");
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
  });

  const contentType = response.headers.get("Content-Type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok) {
    const error = new Error(payload?.error || `Request failed with status ${response.status}.`);
    error.code = payload?.code || "request_failed";
    throw error;
  }

  return payload;
}

function showPreview(url, summary, alt = "") {
  elements.imagePreview.src = url;
  elements.imagePreview.alt = alt;
  elements.imageSummary.textContent = summary;
  elements.imagePreviewWrap.hidden = false;
}

function revokeSelectedPreview() {
  if (selectedPreviewUrl) {
    URL.revokeObjectURL(selectedPreviewUrl);
    selectedPreviewUrl = "";
  }
}

function resetForm() {
  revokeSelectedPreview();
  elements.form.reset();
  elements.id.value = "";
  elements.formTitle.textContent = "Add new artwork";
  elements.saveLabel.textContent = "Add artwork";
  elements.cancelEdit.hidden = true;
  elements.imagePreview.removeAttribute("src");
  elements.imagePreviewWrap.hidden = true;
  setMessage();
}

function populateForm(artwork) {
  revokeSelectedPreview();
  elements.form.reset();
  elements.id.value = artwork.id;
  elements.title.value = artwork.title || "";
  elements.altText.value = artwork.altText || "";
  elements.medium.value = artwork.medium || "";
  elements.year.value = artwork.year || "";
  elements.dimensions.value = artwork.dimensions || "";
  elements.featured.checked = artwork.featured === true;
  elements.hidden.checked = artwork.hidden === true;
  elements.formTitle.textContent = "Edit artwork";
  elements.saveLabel.textContent = "Save changes";
  elements.cancelEdit.hidden = false;
  showPreview(artwork.imageUrl, "Current gallery image", artwork.altText || artwork.title);
  setMessage("Choose a new image only if you want to replace the current one.");
  document.getElementById("editor").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderCollection() {
  elements.artList.replaceChildren();
  elements.loadingState.hidden = true;
  elements.emptyState.hidden = artworks.length !== 0;

  for (const artwork of artworks) {
    const fragment = elements.cardTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".art-card");
    const image = fragment.querySelector(".card-image");
    const badge = fragment.querySelector(".visibility-badge");
    const details = [artwork.medium, artwork.year].filter(Boolean).join(" · ");

    image.src = artwork.thumbnailUrl || artwork.imageUrl;
    image.alt = artwork.altText || artwork.title;
    badge.hidden = !artwork.hidden;
    fragment.querySelector(".card-title").textContent = artwork.title;
    fragment.querySelector(".card-details").textContent = details || "No medium or year entered";
    fragment.querySelector(".edit-button").addEventListener("click", () => populateForm(artwork));
    fragment.querySelector(".delete-button").addEventListener("click", () => deleteArtwork(artwork));
    card.dataset.artworkId = artwork.id;

    elements.artList.append(fragment);
  }
}

function updateStorage(storage) {
  const used = Number(storage.usedBytes || 0);
  const limit = Number(storage.limitBytes || 1);
  const percent = Math.min(100, Math.max(0, (used / limit) * 100));
  elements.storageLabel.textContent = `${formatBytes(used)} of ${formatBytes(limit)} used`;
  elements.storageProgress.hidden = false;
  elements.storageProgress.value = percent;
  elements.storageProgress.textContent = `${percent.toFixed(1)}%`;
}

async function loadCollection() {
  const [collectionResult, storageResult] = await Promise.allSettled([
    apiRequest(API.artworks),
    apiRequest(API.media),
  ]);

  if (collectionResult.status === "rejected") {
    throw collectionResult.reason;
  }

  const collection = collectionResult.value;
  artworks = Array.isArray(collection) ? collection : [];
  renderCollection();

  if (storageResult.status === "fulfilled") {
    updateStorage(storageResult.value);
  } else {
    elements.storageLabel.textContent = "Storage unavailable";
    elements.storageProgress.hidden = true;
  }
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This browser could not read that image. Please use a JPEG, PNG, or WebP file."));
    };
    image.src = url;
  });
}

async function decodeImage(file) {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      return loadImageElement(file);
    }
  }
  return loadImageElement(file);
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("The browser could not prepare this image for upload."));
        }
      },
      "image/webp",
      quality,
    );
  });
}

async function resizeToWebp(source, maximumEdge, quality) {
  const sourceWidth = source.naturalWidth || source.width;
  const sourceHeight = source.naturalHeight || source.height;
  const scale = Math.min(1, maximumEdge / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const drawingContext = canvas.getContext("2d", { alpha: false });
  if (!drawingContext) {
    throw new Error("Image processing is not supported by this browser.");
  }

  drawingContext.fillStyle = "#ffffff";
  drawingContext.fillRect(0, 0, width, height);
  drawingContext.drawImage(source, 0, 0, width, height);
  return {
    blob: await canvasToBlob(canvas, quality),
    width,
    height,
  };
}

async function prepareImage(file) {
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error("Please choose an image smaller than 30 MB.");
  }

  const decoded = await decodeImage(file);
  try {
    const display = await resizeToWebp(decoded, DISPLAY_MAX_EDGE, 0.84);
    const thumbnail = await resizeToWebp(decoded, THUMBNAIL_MAX_EDGE, 0.78);
    if (display.blob.size > 8_000_000 || thumbnail.blob.size > 1_000_000) {
      throw new Error("The optimized image is still too large. Please choose a smaller source image.");
    }
    return { display, thumbnail };
  } finally {
    if (typeof decoded.close === "function") {
      decoded.close();
    }
  }
}

async function uploadImage(blob, artworkId, variant) {
  return apiRequest(API.media, {
    method: "POST",
    headers: {
      "Content-Type": "image/webp",
      "X-Artwork-Id": artworkId,
      "X-Image-Variant": variant,
      "X-Upload-Size": String(blob.size),
    },
    body: blob,
  });
}

async function cleanUpUploads(keys) {
  for (const key of keys) {
    try {
      await apiRequest(`${API.media}?key=${encodeURIComponent(key)}`, { method: "DELETE" });
    } catch (error) {
      console.error("Could not clean up an unused upload.", error);
    }
  }
}

function formArtwork(id, existing, media) {
  return {
    id,
    title: elements.title.value,
    altText: elements.altText.value,
    medium: elements.medium.value,
    year: elements.year.value,
    dimensions: elements.dimensions.value,
    featured: elements.featured.checked,
    hidden: elements.hidden.checked,
    imageKey: media?.display?.key || existing?.imageKey || "",
    thumbnailKey: media?.thumbnail?.key || existing?.thumbnailKey || "",
    legacyImageUrl: media ? "" : (existing?.legacyImageUrl || ""),
  };
}

async function saveArtwork(event) {
  event.preventDefault();
  setMessage();

  const editingId = elements.id.value;
  const existing = editingId ? artworks.find((artwork) => artwork.id === editingId) : null;
  const id = editingId || crypto.randomUUID();
  const file = elements.image.files[0];
  const uploadedKeys = [];
  let uploadedMedia = null;

  if (!existing && !file) {
    setMessage("Please choose an image for this artwork.", "error");
    elements.image.focus();
    return;
  }

  setBusy(true, file ? "Preparing image…" : "Saving…");

  try {
    if (file) {
      const prepared = await prepareImage(file);
      setBusy(true, "Uploading display image…");
      const display = await uploadImage(prepared.display.blob, id, "display");
      uploadedKeys.push(display.key);

      setBusy(true, "Uploading thumbnail…");
      const thumbnail = await uploadImage(prepared.thumbnail.blob, id, "thumbnail");
      uploadedKeys.push(thumbnail.key);
      uploadedMedia = { display, thumbnail };
    }

    setBusy(true, "Saving artwork…");
    const artwork = formArtwork(id, existing, uploadedMedia);
    await apiRequest(existing ? `${API.artworks}/${encodeURIComponent(id)}` : API.artworks, {
      method: existing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(artwork),
    });

    resetForm();
    await loadCollection();
    setMessage(existing ? "Artwork updated." : "Artwork added to the gallery.", "success");
  } catch (error) {
    if (uploadedKeys.length > 0) {
      await cleanUpUploads(uploadedKeys);
    }
    setMessage(error.message || "The artwork could not be saved.", "error");
  } finally {
    setBusy(false);
  }
}

async function deleteArtwork(artwork) {
  const confirmed = window.confirm(
    `Permanently remove “${artwork.title}” from the gallery?\n\nTo keep it without showing it publicly, edit it and select “Hide from public gallery” instead.`,
  );
  if (!confirmed) return;

  setMessage(`Removing “${artwork.title}”…`);
  try {
    await apiRequest(`${API.artworks}/${encodeURIComponent(artwork.id)}`, { method: "DELETE" });
    if (elements.id.value === artwork.id) {
      resetForm();
    }
    await loadCollection();
    setMessage(`“${artwork.title}” was removed.`, "success");
  } catch (error) {
    setMessage(error.message || "The artwork could not be removed.", "error");
  }
}

elements.image.addEventListener("change", () => {
  revokeSelectedPreview();
  const file = elements.image.files[0];
  if (!file) {
    const existing = artworks.find((artwork) => artwork.id === elements.id.value);
    if (existing) {
      showPreview(existing.imageUrl, "Current gallery image", existing.altText || existing.title);
    } else {
      elements.imagePreviewWrap.hidden = true;
    }
    return;
  }

  selectedPreviewUrl = URL.createObjectURL(file);
  showPreview(
    selectedPreviewUrl,
    `${file.name} · ${formatBytes(file.size)} · will be optimized before upload`,
    "Preview of the selected artwork",
  );
});

elements.form.addEventListener("submit", saveArtwork);
elements.cancelEdit.addEventListener("click", resetForm);

async function initialize() {
  try {
    const session = await apiRequest(API.session);
    elements.signedInUser.textContent = session.email;
    await loadCollection();
    resetForm();
  } catch (error) {
    elements.loadingState.textContent = error.message || "The gallery manager could not be loaded.";
    elements.storageLabel.textContent = "Storage unavailable";
    elements.storageProgress.hidden = true;
    setMessage(
      error.code === "access_not_configured"
        ? "Cloudflare Access still needs to be configured. Follow BACKEND_SETUP.md."
        : (error.code === "database_not_initialized"
          ? "The Cloudflare D1 migration still needs to be applied."
          : "The administrative service is unavailable."),
      "error",
    );
  }
}

initialize();
