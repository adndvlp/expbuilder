import React, { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import "./index.css";
import { Link } from "react-router-dom";

const Register: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorEmail, setErrorEmail] = useState("");
  const [errorPassword, setErrorPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorConfirmPassword, setErrorConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorEmail("");
    setErrorPassword("");
    setErrorConfirmPassword("");
    setSuccess(false);
    if (password.length < 12) {
      setErrorPassword("Password must be at least 12 characters");
      return;
    }
    if (password !== confirmPassword) {
      setErrorConfirmPassword("Passwords do not match");
      return;
    }
    setIsSubmitting(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;
      await setDoc(doc(db, "users", user.uid), {
        email: user.email,
        uid: user.uid,
        osfToken: "",
        osfTokenValid: false,
        dropboxTokens: null,
        githubTokens: null,
        experiments: [],
      });
      setSuccess(true);
      setEmail("");
      setPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      if (error.code === "auth/weak-password") {
        setErrorPassword("Password is too weak");
      } else if (error.code === "auth/email-already-in-use") {
        setErrorEmail("Email already in use");
      } else {
        setErrorEmail(error.message || "Registration failed");
      }
    }
    setIsSubmitting(false);
  };

  return (
    <div
      style={{
        maxWidth: 400,
        margin: "40px auto",
        padding: 24,
        border: "1px solid #eee",
        borderRadius: 8,
      }}
    >
      <h2 className="auth-text-color">Sign Up</h2>
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
          <div
            style={{
              fontSize: 12,
              color: errorPassword ? "red" : "#cececeff",
            }}
          >
            {errorPassword || "Password must be at least 12 characters"}
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label className="auth-text-color">Confirm Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            style={{ width: "100%", padding: 8, marginTop: 4 }}
            required
          />
          <div
            style={{
              fontSize: 12,
              color: errorConfirmPassword ? "red" : "#cececeff",
            }}
          >
            {errorConfirmPassword || "Repeat your password"}
          </div>
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
          {isSubmitting ? "Creating..." : "Create Account"}
        </button>
        {success && (
          <div style={{ color: "green", marginTop: 16 }}>
            Account created! You can now log in.
          </div>
        )}
      </form>
      <div
        className="auth-text-color"
        style={{ marginTop: 16, textAlign: "center" }}
      >
        Already have an account?{" "}
        <Link style={{ color: "#f1c40f" }} to="/auth/login">
          Sign In
        </Link>
      </div>
    </div>
  );
};

export default Register;
