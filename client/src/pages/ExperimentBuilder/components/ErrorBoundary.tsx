import React from "react";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
};

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error capturado por ErrorBoundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Estilo visual alternativo, pantalla negra u opaca
      return (
        <div
          style={{
            backgroundColor: "#111",
            color: "#fff",
            padding: "2rem",
            height: "100vh",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <h1>⚠️ Algo salió mal</h1>
          <p>La aplicación encontró un error. Por favor recarga la página.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
