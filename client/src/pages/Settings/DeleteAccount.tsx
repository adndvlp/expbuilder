import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../../lib/firebase";
import { deleteUser } from "firebase/auth";
import { doc, deleteDoc } from "firebase/firestore";

export default function DeleteAccount() {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const navigate = useNavigate();

  const deleteAccount = async () => {
    setIsDeleting(true);
    const user = auth.currentUser;

    if (!user) {
      setIsDeleting(false);
      return;
    }

    try {
      // Borrar datos del usuario en Firestore
      const userDoc = doc(db, "users", user.uid);
      await deleteDoc(userDoc);

      // Borrar usuario de Firebase Auth
      await deleteUser(user);

      // Limpiar localStorage
      localStorage.removeItem("user");

      // Redirigir a página de confirmación o login
      navigate("/auth/login");
    } catch (error: any) {
      console.error(error);
      setIsDeleting(false);

      if (error.code === "auth/requires-recent-login") {
        alert("Please log out and log in again to delete your account.");
      } else {
        alert("Failed to delete account. Please try again.");
      }
    }
  };

  return (
    <>
      <div className="settings-item danger-item">
        <span className="settings-item-label">Delete Account</span>
        <button
          onClick={() => setIsOpen(true)}
          className="token-button disconnect"
        >
          Delete Account
        </button>
      </div>

      {isOpen && (
        <div className="modal-overlay" onClick={() => setIsOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete Account</h3>
              <button className="modal-close" onClick={() => setIsOpen(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p className="warning-text">
                <strong>Are you sure?</strong> This action is final. We cannot
                recover any experiments that are associated with this account
                after deletion.
              </p>
              <p className="info-text">
                Deleting your account will remove all your data from our system.
              </p>
            </div>
            <div className="modal-footer">
              <button
                onClick={() => setIsOpen(false)}
                className="token-button connect"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={deleteAccount}
                disabled={isDeleting}
                className="token-button disconnect"
                style={{ marginLeft: "10px" }}
              >
                {isDeleting ? "Deleting..." : "Delete Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
