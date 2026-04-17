import { ParameterType } from "jspsych";

const version = "1.0.0";

const info = {
  name: "FileUploadResponseComponent",
  version,
  parameters: {
    name: {
      type: ParameterType.STRING,
      default: undefined,
    },
    /** Accepted file types. Use MIME types (e.g. "image/*") or extensions (e.g. ".pdf,.docx" or "pdf, docx"). Empty = all types. */
    accept: {
      type: ParameterType.STRING,
      pretty_name: "Accepted File Types",
      default: "",
      description:
        "Accepted file types as MIME types or extensions separated by commas",
    },
    /** Allow the participant to select multiple files at once. */
    multiple: {
      type: ParameterType.BOOL,
      pretty_name: "Allow Multiple Files",
      default: false,
      description: "Allow selecting multiple files at once",
    },
    /** Label displayed on the file selection button. */
    button_label: {
      type: ParameterType.STRING,
      pretty_name: "Button Label",
      default: "Upload File",
      description: "Label shown on the file selection button",
    },
    /** Maximum file size in megabytes. null = no limit. */
    max_file_size_mb: {
      type: ParameterType.INT,
      pretty_name: "Max File Size (MB)",
      default: null,
      description: "Maximum allowed file size in MB (null = no limit)",
    },
    /** Show an image preview thumbnail when the selected file is an image. */
    show_preview: {
      type: ParameterType.BOOL,
      pretty_name: "Show Preview",
      default: true,
      description: "Show a preview thumbnail when an image file is selected",
    },
    /**
     * Upload endpoint URL.
     * Automatically injected by LocalConfiguration (→ /api/participant-files/:id) or
     * PublicConfiguration (→ Firebase Cloud Function URL).
     * Do NOT set this manually in the builder UI.
     */
    upload_endpoint: {
      type: ParameterType.STRING,
      default: "",
    },
    /** Position coordinates. x and y between -1 (left/bottom) and 1 (right/top). */
    coordinates: {
      type: ParameterType.OBJECT,
      default: { x: 0, y: 0 },
    },
    /** Z-index for layering (higher values appear on top). */
    zIndex: {
      type: ParameterType.INT,
      pretty_name: "Z-Index",
      default: 0,
      description: "Layer order — higher values render on top of lower values",
    },
  },
  data: {
    /** Original filename of the uploaded file. If multiple files, a JSON array string. */
    response: {
      type: ParameterType.STRING,
    },
    /** URL or storage reference returned by the server after upload. */
    file_url: {
      type: ParameterType.STRING,
    },
    /** Total size of uploaded file(s) in bytes. */
    file_size: {
      type: ParameterType.INT,
    },
    /** MIME type of the uploaded file (or "mixed" when multiple files differ). */
    file_type: {
      type: ParameterType.STRING,
    },
    /** Response time in milliseconds from component render to successful upload. */
    rt: {
      type: ParameterType.INT,
    },
  },
};

/**
 * FileUploadResponseComponent
 *
 * Response component that lets the participant upload one or more files during a trial.
 *
 * - **Local mode**: files are sent to the local Express server
 *   (`/api/participant-files/:experimentID`) and saved to disk.
 * - **Public mode**: files are sent to a Firebase Cloud Function
 *   (`uploadParticipantFile`) that forwards them to the researcher's configured
 *   storage provider (Google Drive, Dropbox, or OSF).
 *
 * The correct endpoint is automatically injected via the global
 * `window.JSPSYCH_FILE_UPLOAD_ENDPOINT` variable set by the experiment
 * configuration generators. The `upload_endpoint` parameter overrides this
 * global if explicitly provided.
 *
 * Follows the "sketchpad pattern":
 * - Does NOT call finishTrial()
 * - Stores response data internally
 * - Exposes data via getters (getResponse(), getRT(), etc.)
 * - Parent plugin orchestrates trial completion
 */
class FileUploadResponseComponent {
  private jsPsych: any;
  private response: string | null = null;
  private file_url: string | null = null;
  private file_size: number | null = null;
  private file_type: string | null = null;
  private rt: number | null = null;
  private start_time: number | null = null;
  private container: HTMLElement | null = null;
  private isUploading = false;

  static info = info;

  constructor(jsPsych: any) {
    this.jsPsych = jsPsych;
  }

  render(
    display_element: HTMLElement,
    trial: any,
    onResponse?: () => void,
  ): void {
    this.start_time = performance.now();

    // Map coordinate values: -1..1 → -50vw/vh..50vw/vh
    const mapValue = (v: number) => v / 2;
    const coords = trial.coordinates ?? { x: 0, y: 0 };
    const left = `calc(50% + ${mapValue(coords.x)}vw)`;
    const top = `calc(50% - ${mapValue(coords.y)}vh)`;

    this.container = document.createElement("div");
    this.container.style.cssText = [
      "position: absolute;",
      `left: ${left};`,
      `top: ${top};`,
      "transform: translate(-50%, -50%);",
      `z-index: ${trial.zIndex ?? 0};`,
      "display: flex;",
      "flex-direction: column;",
      "align-items: center;",
      "gap: 10px;",
    ].join(" ");

    // Hidden native file input
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.id = `jspsych-file-upload-input-${Date.now()}`;
    fileInput.style.display = "none";
    if (trial.accept) {
      // Allow formats like "pdf, docx" or ".pdf, .docx" or "image/*"
      const formattedAccept = trial.accept
        .split(",")
        .map((ext: string) => {
          ext = ext.trim();
          // If it's an extension without a dot and not a mime type, add a dot
          if (ext && !ext.startsWith(".") && !ext.includes("/")) {
            return `.${ext}`;
          }
          return ext;
        })
        .join(",");
      fileInput.accept = formattedAccept;
    }
    if (trial.multiple) fileInput.multiple = true;

    // Visible button that triggers the file picker
    const triggerButton = document.createElement("button");
    triggerButton.className = "jspsych-btn";
    triggerButton.textContent = trial.button_label || "Upload File";
    triggerButton.addEventListener("click", () => fileInput.click());

    // Optional image preview area
    const previewContainer = document.createElement("div");
    previewContainer.style.cssText =
      "display: flex; flex-wrap: wrap; gap: 6px; justify-content: center;";

    // Status message
    const statusText = document.createElement("p");
    statusText.style.cssText = "margin: 0; font-size: 13px; color: #555;";

    fileInput.addEventListener("change", async () => {
      const files = Array.from(fileInput.files || []);
      if (files.length === 0) return;

      // Validate allowed extensions
      if (trial.accept) {
        const allowedExtensions = trial.accept.split(",").map((ext: string) => {
          ext = ext.trim().toLowerCase();
          return ext.startsWith(".")
            ? ext
            : ext.includes("/")
              ? ext
              : `.${ext}`;
        });

        const invalidFile = files.find((f) => {
          const fileName = f.name.toLowerCase();
          const fileType = f.type.toLowerCase();

          return !allowedExtensions.some((ext: string) => {
            if (ext.includes("/")) {
              // Handle MIME types like "image/*" or "application/pdf"
              const [type, subtype] = ext.split("/");
              if (subtype === "*") {
                return fileType.startsWith(`${type}/`);
              }
              return fileType === ext;
            } else {
              // Handle extensions like ".pdf"
              return fileName.endsWith(ext);
            }
          });
        });

        if (invalidFile) {
          statusText.textContent = `File type not allowed. Allowed types: ${trial.accept}`;
          statusText.style.color = "#e74c3c";
          return;
        }
      }

      // Validate file sizes
      if (trial.max_file_size_mb) {
        const maxBytes = trial.max_file_size_mb * 1024 * 1024;
        const oversized = files.find((f) => f.size > maxBytes);
        if (oversized) {
          statusText.textContent = `File "${oversized.name}" exceeds the ${trial.max_file_size_mb} MB limit.`;
          statusText.style.color = "#e74c3c";
          return;
        }
      }

      // Render image previews
      if (trial.show_preview !== false) {
        previewContainer.innerHTML = "";
        files.forEach((file) => {
          if (file.type.startsWith("image/")) {
            const img = document.createElement("img");
            img.style.cssText =
              "max-width: 200px; max-height: 150px; border-radius: 4px; border: 1px solid #ccc; object-fit: contain;";
            const objectUrl = URL.createObjectURL(file);
            img.src = objectUrl;
            img.onload = () => URL.revokeObjectURL(objectUrl);
            previewContainer.appendChild(img);
          }
        });
      }

      // Disable button and show uploading state
      triggerButton.disabled = true;
      this.isUploading = true;
      statusText.textContent = "Uploading\u2026";
      statusText.style.color = "#555";

      try {
        // Resolve upload endpoint:
        // 1. Explicit trial param (overrides global)
        // 2. Global injected by configuration generator
        const endpoint =
          trial.upload_endpoint ||
          (window as any).JSPSYCH_FILE_UPLOAD_ENDPOINT ||
          "";

        if (!endpoint) {
          throw new Error("No upload endpoint configured for this experiment.");
        }

        // Read all files as base64 and send as JSON (compatible with both
        // local Express and Firebase Cloud Function endpoints)
        const encodedFiles = await Promise.all(
          files.map(
            (file) =>
              new Promise<{
                name: string;
                data: string;
                type: string;
                size: number;
              }>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) =>
                  resolve({
                    name: file.name,
                    data: (e.target?.result as string) ?? "",
                    type: file.type,
                    size: file.size,
                  });
                reader.onerror = () =>
                  reject(new Error(`Failed to read file: ${file.name}`));
                reader.readAsDataURL(file);
              }),
          ),
        );

        const body: Record<string, unknown> = { files: encodedFiles };
        const sid =
          (window as any).JSPSYCH_SESSION_ID ||
          localStorage.getItem("jsPsych_currentSessionId");
        if (sid) body.sessionId = sid;
        const eid = (window as any).JSPSYCH_EXPERIMENT_ID;
        if (eid) body.experimentID = eid;

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          throw new Error(errText || `Server returned ${res.status}`);
        }

        const data = await res.json();

        // Record response data
        this.rt = Math.round(performance.now() - (this.start_time ?? 0));
        this.response =
          files.length === 1
            ? files[0].name
            : JSON.stringify(files.map((f) => f.name));
        this.file_url =
          data.fileUrl ?? (data.fileUrls ? data.fileUrls[0] : null) ?? "";
        this.file_size = files.reduce((sum, f) => sum + f.size, 0);
        this.file_type =
          files.length === 1
            ? files[0].type
            : [...new Set(files.map((f) => f.type))].join(", ");

        statusText.textContent = "\u2713 Upload complete";
        statusText.style.color = "#27ae60";
        triggerButton.textContent =
          files.length > 0
            ? "Change File"
            : trial.button_label || "Upload File";
        triggerButton.disabled = false;
        this.isUploading = false;

        if (onResponse) onResponse();
      } catch (error: any) {
        statusText.textContent = `Upload failed: ${error?.message ?? "Unknown error"}`;
        statusText.style.color = "#e74c3c";
        triggerButton.disabled = false;
        this.isUploading = false;
      }
    });

    this.container.appendChild(fileInput);
    this.container.appendChild(triggerButton);
    this.container.appendChild(previewContainer);
    this.container.appendChild(statusText);

    display_element.appendChild(this.container);
  }

  /** Original filename (or JSON array of filenames for multi-file uploads). */
  getResponse(): string | null {
    return this.response;
  }

  /** URL or storage reference returned by the server after a successful upload. */
  getFileUrl(): string | null {
    return this.file_url;
  }

  /** Total size of uploaded file(s) in bytes. */
  getFileSize(): number | null {
    return this.file_size;
  }

  /** MIME type (or comma-separated list for mixed types). */
  getFileType(): string | null {
    return this.file_type;
  }

  /** Response time in milliseconds from render to upload completion. */
  getRT(): number | null {
    return this.rt;
  }

  /** True once at least one file has been successfully uploaded. */
  isValid(_trial: any): boolean {
    return this.response !== null && !this.isUploading;
  }

  /** Highlight the component container to signal a required response. */
  showValidationError(): void {
    if (this.container) {
      this.container.classList.add("jspsych-require-response-error");
    }
  }

  /** Remove validation error highlight. */
  clearValidationError(): void {
    if (this.container) {
      this.container.classList.remove("jspsych-require-response-error");
    }
  }

  /** Cleanup: remove DOM elements. */
  destroy(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
  }
}

export default FileUploadResponseComponent;
