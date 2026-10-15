import type { TrialComponent } from "../types";
import type { UploadedFile } from "../../../../../utils/mapFileToUrl";
import { formatMemory, IPHONE_REFERENCE_BYTES } from "./resourceEstimate";
import { useTrialMemory } from "./useTrialMemory";
import "./trialMemoryMeter.css";

export default function TrialMemoryMeter({
  components,
  uploadedFiles = [],
}: {
  components: TrialComponent[];
  uploadedFiles?: UploadedFile[];
}) {
  const result = useTrialMemory(components, uploadedFiles);
  const unknown = result.missing > 0 && result.bytes === 0;
  return (
    <details className="trial-memory" data-level={result.level}>
      <summary>
        <strong>Trial memory</strong>
        <span>
          {unknown
            ? "Not yet measurable"
            : `${formatMemory(result.bytes)} calculated base`}
        </span>
        <span>
          {components.length} components · {result.inventory.resources.length}{" "}
          unique media
        </span>
        {result.pending > 0 ? (
          <span>Reading {result.pending}…</span>
        ) : result.missing > 0 ? (
          <span>Partial estimate</span>
        ) : null}
        {result.level !== "unverified" && (
          <strong className="trial-memory-risk">
            {result.level === "high" ? "Above" : "Near"} the iPhone reference
          </strong>
        )}
      </summary>
      <div className="trial-memory-content">
        <aside className="trial-memory-warning">
          iPhone can reload a memory-heavy experiment even after cleanup. WebKit
          has described a soft reference around 1.5 GB; the actual limit varies
          with device and system memory pressure and may be lower on devices
          with less RAM. Take particular care with devices with 4 GB of RAM or
          less. A low or partial estimate does not establish that the experiment
          is safe.
        </aside>
        <p>
          This trial&apos;s resources, calculated from their actual files and
          source metadata. This is an estimate of resource memory, not a
          measurement of total browser RAM.
        </p>
        <meter
          min={0}
          max={IPHONE_REFERENCE_BYTES}
          value={Math.min(result.bytes, IPHONE_REFERENCE_BYTES)}
          aria-label="Calculated resource base compared with the approximate 1.5 GB iPhone reference"
        />
        <div className="trial-memory-totals">
          <span>
            Calculated base:{" "}
            <b>{unknown ? "Unknown" : formatMemory(result.bytes)}</b>
          </span>
          <span>
            Known file sizes: <b>{formatMemory(result.fileBytes)}</b>
          </span>
          <span>
            Reference: <b>~1.5 GB</b> (not available RAM)
          </span>
        </div>
        <button type="button" onClick={result.refresh}>
          Refresh file metadata
        </button>
        {result.rows.length > 0 && (
          <div className="trial-memory-table">
            <table>
              <thead>
                <tr>
                  <th>Resource</th>
                  <th>Uses</th>
                  <th>File</th>
                  <th>Calculated memory</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.key}>
                    <td>
                      <span
                        className="trial-memory-name"
                        title={
                          row.url.startsWith("data:")
                            ? "Embedded media"
                            : row.url.split("?")[0]
                        }
                      >
                        {row.url.startsWith("data:")
                          ? "Embedded media"
                          : decodeName(row.url)}
                      </span>
                      <small>
                        {row.kind}
                        {row.metadata?.width && row.metadata?.height
                          ? ` · ${row.metadata.width}×${row.metadata.height}px`
                          : ""}
                        {row.metadata?.sampleRate
                          ? ` · ${row.metadata.sampleRate} Hz · ${row.metadata.channels ?? "?"} channels`
                          : ""}
                      </small>
                    </td>
                    <td>{row.instances}</td>
                    <td>
                      {row.fileBytes === undefined
                        ? "Unknown"
                        : formatMemory(row.fileBytes)}
                    </td>
                    <td>
                      {row.bytes > 0 ? formatMemory(row.bytes) : "Unknown"}
                      {row.missing.map((message) => (
                        <small key={message}>{message}</small>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {result.inventory.canvasBytes > 0 && (
          <p>
            Declared HTML canvas buffers:{" "}
            {formatMemory(result.inventory.canvasBytes)}.
          </p>
        )}
        {result.inventory.unresolved.length > 0 && (
          <ul className="trial-memory-unresolved">
            {result.inventory.unresolved.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        )}
        <p>
          Images: original width × height × 4 bytes, once per unique source.
          Audio: duration × source sample rate × channels × 4 bytes for decoded
          PCM; browser resampling can change this. Video: one stored Blob per
          source plus one RGBA frame per player. Video decoder buffers, GPU
          textures, DOM, JavaScript, recording and other trials/preloads add
          memory that is not included. Scaling an image down on the canvas does
          not reduce its source bitmap size.
        </p>
      </div>
    </details>
  );
}

function decodeName(url: string) {
  const name = url.split(/[?#]/)[0].split("/").pop() || url;
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}
