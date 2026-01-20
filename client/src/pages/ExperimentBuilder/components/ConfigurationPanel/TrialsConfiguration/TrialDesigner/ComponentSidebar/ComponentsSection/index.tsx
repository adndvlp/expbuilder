import { useState } from "react";
import { ComponentType } from "../../types";
import GenericComponents from "./GenericComponents";
const API_URL = import.meta.env.VITE_API_URL;

type Props = {
  type: ComponentType;
  label: string;
  images: string[];
  audios: string[];
  videos: string[];
  addComponent: (type: ComponentType) => void;
};

function ComponentsSection({
  type,
  label,
  images,
  audios,
  videos,
  addComponent,
}: Props) {
  const [imageExpanded, setImageExpanded] = useState(false);
  const [videoExpanded, setVideoExpanded] = useState(false);
  const [audioExpanded, setAudioExpanded] = useState(false);
  return (
    <div key={type}>
      {type === "ImageComponent" && (
        <>
          <button
            onClick={() => setImageExpanded(!imageExpanded)}
            style={{
              width: "100%",
              padding: "10px 12px",
              background: "linear-gradient(135deg, #ffffff 0%, #dbeafe 100%)",
              color: "#1e40af",
              border: "1px solid #93c5fd",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "8px",
            }}
          >
            <span>{label}</span>
            <span>{imageExpanded ? "▼" : "▶"}</span>
          </button>
          {imageExpanded && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "6px",
                marginBottom: "12px",
                padding: "8px",
                background: "var(--neutral-light)",
                borderRadius: "4px",
              }}
            >
              {images.length === 0 ? (
                <p
                  style={{
                    gridColumn: "1 / -1",
                    textAlign: "center",
                    color: "#9ca3af",
                    fontSize: "11px",
                    margin: 0,
                  }}
                >
                  No images
                </p>
              ) : (
                images.map((imgUrl, idx) => (
                  <div
                    key={idx}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("fileUrl", imgUrl);
                      e.dataTransfer.setData("type", "ImageComponent");
                    }}
                    style={{
                      cursor: "grab",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      overflow: "hidden",
                      aspectRatio: "1",
                    }}
                  >
                    <img
                      src={`${API_URL}/${imgUrl}`}
                      alt="thumbnail"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      {type === "VideoComponent" && (
        <>
          <button
            onClick={() => setVideoExpanded(!videoExpanded)}
            style={{
              width: "100%",
              padding: "10px 12px",
              background: "linear-gradient(135deg, #ffffff 0%, #dbeafe 100%)",
              color: "#1e40af",
              border: "1px solid #93c5fd",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "8px",
            }}
          >
            <span>{label}</span>
            <span>{videoExpanded ? "▼" : "▶"}</span>
          </button>
          {videoExpanded && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "6px",
                marginBottom: "12px",
                padding: "8px",
                background: "var(--neutral-light)",
                borderRadius: "4px",
              }}
            >
              {videos.length === 0 ? (
                <p
                  style={{
                    gridColumn: "1 / -1",
                    textAlign: "center",
                    color: "#9ca3af",
                    fontSize: "11px",
                    margin: 0,
                  }}
                >
                  No videos
                </p>
              ) : (
                videos.map((vidUrl, idx) => (
                  <div
                    key={idx}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("fileUrl", vidUrl);
                      e.dataTransfer.setData("type", "VideoComponent");
                    }}
                    style={{
                      cursor: "grab",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      overflow: "hidden",
                      aspectRatio: "16/9",
                      background: "#000",
                      position: "relative",
                    }}
                  >
                    <video
                      src={`${API_URL}/${vidUrl}`}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        background: "rgba(0,0,0,0.7)",
                        color: "white",
                        fontSize: "9px",
                        padding: "2px 4px",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {vidUrl.split("/").pop()}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      {type === "AudioComponent" && (
        <>
          <button
            onClick={() => setAudioExpanded(!audioExpanded)}
            style={{
              width: "100%",
              padding: "10px 12px",
              background: "linear-gradient(135deg, #ffffff 0%, #dbeafe 100%)",
              color: "#1e40af",
              border: "1px solid #93c5fd",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "8px",
            }}
          >
            <span>{label}</span>
            <span>{audioExpanded ? "▼" : "▶"}</span>
          </button>
          {audioExpanded && (
            <div
              style={{
                marginBottom: "12px",
                padding: "8px",
                background: "var(--neutral-light)",
                borderRadius: "4px",
              }}
            >
              {audios.length === 0 ? (
                <p
                  style={{
                    textAlign: "center",
                    color: "#9ca3af",
                    fontSize: "11px",
                    margin: 0,
                  }}
                >
                  No audio
                </p>
              ) : (
                audios.map((audUrl, idx) => (
                  <div
                    key={idx}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("fileUrl", audUrl);
                      e.dataTransfer.setData("type", "AudioComponent");
                    }}
                    style={{
                      padding: "8px",
                      border: "1px solid var(--neutral-mid)",
                      borderRadius: "4px",
                      cursor: "grab",
                      background: "var(--neutral-light)",
                      fontSize: "11px",
                      marginBottom: "4px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      color: "var(--text-dark)",
                    }}
                  >
                    <span style={{ fontSize: "16px" }}>🎵</span>
                    <span
                      style={{
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {audUrl.split("/").pop()}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
      {type !== "ImageComponent" &&
        type !== "VideoComponent" &&
        type !== "AudioComponent" && (
          <GenericComponents
            type={type}
            label={label}
            addComponent={addComponent}
          />
        )}
    </div>
  );
}

export default ComponentsSection;
