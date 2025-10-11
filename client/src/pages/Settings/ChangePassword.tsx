import { useState, useEffect } from "react";
import { auth } from "../../lib/firebase";
import { updatePassword } from "firebase/auth";

export default function ChangePassword() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMatch, setPasswordMatch] = useState(true);
  const [passwordLengthSatisfied, setPasswordLengthSatisfied] = useState(true);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setPasswordMatch(password === confirmPassword);
  }, [password, confirmPassword]);

  useEffect(() => {
    setPasswordLengthSatisfied(password.length >= 6);
  }, [password]);

  const handleChangePassword = async () => {
    setIsSubmitting(true);
    setSuccessMessage("");
    setErrorMessage("");

    const user = auth.currentUser;

    try {
      await updatePassword(user!, password);
      setSuccessMessage("Password changed successfully!");
      setPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setIsOpen(false);
        setSuccessMessage("");
      }, 2000);
    } catch (error: any) {
      console.error(error);
      if (error.code === "auth/requires-recent-login") {
        setErrorMessage(
          "Please log out and log in again to change your password."
        );
      } else {
        setErrorMessage("Failed to change password. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="settings-item">
        <span className="settings-item-label">Password</span>
        <button
          onClick={() => setIsOpen(true)}
          className="token-button connect"
        >
          Change Password
        </button>
      </div>

      {isOpen && (
        <div className="modal-overlay" onClick={() => setIsOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Change Password</h3>
              <button className="modal-close" onClick={() => setIsOpen(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group-settings">
                <label htmlFor="new-password">New Password</label>
                <input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={
                    !passwordLengthSatisfied && password.length > 0
                      ? "input-error"
                      : ""
                  }
                />
                {!passwordLengthSatisfied && password.length > 0 && (
                  <span className="error-message">
                    Password must be at least 6 characters
                  </span>
                )}
              </div>
              <div className="form-group-settings">
                <label htmlFor="confirm-password">Confirm Password</label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={
                    !passwordMatch && confirmPassword.length > 0
                      ? "input-error"
                      : ""
                  }
                />
                {!passwordMatch && confirmPassword.length > 0 && (
                  <span className="error-message">Passwords do not match</span>
                )}
              </div>
              {successMessage && (
                <div className="success-message">{successMessage}</div>
              )}
              {errorMessage && (
                <div className="error-message-box">{errorMessage}</div>
              )}
            </div>
            <div className="modal-footer">
              <button
                onClick={handleChangePassword}
                disabled={
                  !passwordMatch || !passwordLengthSatisfied || isSubmitting
                }
                className="token-button connect"
              >
                {isSubmitting ? "Changing..." : "Change Password"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
