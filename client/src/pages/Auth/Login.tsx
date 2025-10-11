import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../lib/firebase";
import "./index.css";

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorEmail, setErrorEmail] = useState("");
  const [errorPassword, setErrorPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorEmail("");
    setErrorPassword("");
    setSuccess(false);
    setIsSubmitting(true);
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      setSuccess(true);
      setEmail("");
      setPassword("");
      // Guardar usuario en localStorage para persistencia de sesión
      if (userCredential && userCredential.user) {
        const { uid, email } = userCredential.user;
        localStorage.setItem("user", JSON.stringify({ uid, email }));
      }
      // Redirigir a /home después de login exitoso
      navigate("/home");
    } catch (error: any) {
      if (error.code === "auth/user-not-found") {
        setErrorEmail("User not found");
      } else if (error.code === "auth/wrong-password") {
        setErrorPassword("Incorrect password");
      } else {
        setErrorEmail(error.message || "Login failed");
      }
    }
    setIsSubmitting(false);
  };

  return (
    <div className="auth-forms">
      <div
        style={{
          maxWidth: 400,
          margin: "40px auto",
          padding: 24,
          border: "1px solid #eee",
          borderRadius: 8,
        }}
      >
        <h2 className="auth-text-color">Sign In</h2>
        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label className="auth-text-color">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: "100%", padding: 8, marginTop: 4 }}
              required
            />
            {errorEmail && (
              <div style={{ color: "red", fontSize: 14 }}>{errorEmail}</div>
            )}
          </div>
          <div style={{ marginBottom: 16 }}>
            <label className="auth-text-color">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%", padding: 8, marginTop: 4 }}
              required
            />
            {errorPassword && (
              <div style={{ color: "red", fontSize: 14 }}>{errorPassword}</div>
            )}
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: "100%",
              padding: 10,
              background: "#b7950b",
              color: "#fff",
              border: 0,
              borderRadius: 4,
            }}
          >
            {isSubmitting ? "Signing in..." : "Sign In"}
          </button>
          {success && (
            <div style={{ color: "green", marginTop: 16 }}>
              Login successful!
            </div>
          )}
        </form>
        <div
          className="auth-text-color"
          style={{ marginTop: 16, textAlign: "center" }}
        >
          Need an account?{" "}
          <a style={{ color: "#f1c40f" }} href="/auth/register">
            Sign Up
          </a>
        </div>
      </div>
    </div>
  );
};

export default Login;
