export default function DesktopServerOnlyNotice() {
  return (
    <div
      style={{
        padding: "12px 16px",
        background: "#fff3cd",
        border: "1px solid #ffc107",
        borderRadius: 8,
        color: "#856404",
        fontSize: 14,
      }}
    >
      Server setup is only available in the Electron app.
    </div>
  );
}
