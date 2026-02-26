import { Question, UploadedFile } from "../types";

const API_URL = import.meta.env.VITE_API_URL;

type Props = {
  question: Question;
  onUpdate: (updates: Partial<Question>) => void;
  uploadedFiles: UploadedFile[];
};

function ImageSettings({ question, onUpdate, uploadedFiles }: Props) {
  const imageFiles = uploadedFiles.filter(
    (f) =>
      f.type === "img" ||
      f.type === "vid" ||
      f.type.startsWith("image/") ||
      f.type.startsWith("video/"),
  );
  return (
    <>
      <div style={{ marginBottom: "12px" }}>
        <label
          style={{
            display: "block",
            marginBottom: "6px",
            fontWeight: 500,
            fontSize: "13px",
            color: "var(--text-dark)",
          }}
        >
          Image/Video Source
        </label>
        <select
          value={question.imageLink || ""}
          onChange={(e) => onUpdate({ imageLink: e.target.value })}
          style={{
            width: "100%",
            padding: "8px 12px",
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            fontSize: "14px",
            backgroundColor: "var(--neutral-light)",
            color: "var(--text-dark)",
          }}
        >
          <option value="">-- Select File --</option>
          {imageFiles.map((f) => (
            <option key={f.url} value={`${API_URL}/${f.url}`}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px",
          marginBottom: "12px",
        }}
      >
        <div>
          <label
            style={{
              display: "block",
              marginBottom: "6px",
              fontWeight: 500,
              fontSize: "13px",
              color: "var(--text-dark)",
            }}
          >
            Width
          </label>
          <input
            type="text"
            value={question.imageWidth || ""}
            onChange={(e) => onUpdate({ imageWidth: e.target.value })}
            placeholder="300 or 100%"
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "14px",
              backgroundColor: "var(--neutral-light)",
              color: "var(--text-dark)",
            }}
          />
        </div>
        <div>
          <label
            style={{
              display: "block",
              marginBottom: "6px",
              fontWeight: 500,
              fontSize: "13px",
              color: "var(--text-dark)",
            }}
          >
            Height
          </label>
          <input
            type="text"
            value={question.imageHeight || ""}
            onChange={(e) => onUpdate({ imageHeight: e.target.value })}
            placeholder="200 or auto"
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "14px",
              backgroundColor: "var(--neutral-light)",
              color: "var(--text-dark)",
            }}
          />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px",
          marginBottom: "12px",
        }}
      >
        <div>
          <label
            style={{
              display: "block",
              marginBottom: "6px",
              fontWeight: 500,
              fontSize: "13px",
              color: "var(--text-dark)",
            }}
          >
            Image Fit
          </label>
          <select
            value={question.imageFit || "contain"}
            onChange={(e) =>
              onUpdate({
                imageFit: e.target.value as
                  | "none"
                  | "contain"
                  | "cover"
                  | "fill",
              })
            }
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "14px",
              backgroundColor: "var(--neutral-light)",
              color: "var(--text-dark)",
            }}
          >
            <option value="contain">Contain</option>
            <option value="cover">Cover</option>
            <option value="fill">Fill</option>
            <option value="none">None</option>
          </select>
        </div>
        <div>
          <label
            style={{
              display: "block",
              marginBottom: "6px",
              fontWeight: 500,
              fontSize: "13px",
              color: "var(--text-dark)",
            }}
          >
            Content Mode
          </label>
          <select
            value={question.contentMode || "auto"}
            onChange={(e) =>
              onUpdate({
                contentMode: e.target.value as
                  | "auto"
                  | "image"
                  | "video"
                  | "youtube",
              })
            }
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "14px",
              backgroundColor: "var(--neutral-light)",
              color: "var(--text-dark)",
            }}
          >
            <option value="auto">Auto</option>
            <option value="image">Image</option>
            <option value="video">Video</option>
            <option value="youtube">YouTube</option>
          </select>
        </div>
      </div>
    </>
  );
}

export default ImageSettings;
