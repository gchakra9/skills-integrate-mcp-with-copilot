document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const teacherOnlyMessage = document.getElementById("teacher-only-message");

  const authToggleBtn = document.getElementById("auth-toggle-btn");
  const authStatusLabel = document.getElementById("auth-status-label");
  const authModal = document.getElementById("auth-modal");
  const closeAuthModalBtn = document.getElementById("close-auth-modal");

  const loginView = document.getElementById("login-view");
  const loggedInView = document.getElementById("logged-in-view");
  const loginForm = document.getElementById("login-form");
  const loggedInText = document.getElementById("logged-in-text");
  const logoutBtn = document.getElementById("logout-btn");
  const authMessage = document.getElementById("auth-message");

  let teacherToken = localStorage.getItem("teacherToken") || "";
  let teacherUsername = localStorage.getItem("teacherUsername") || "";

  function isTeacherLoggedIn() {
    return teacherToken.length > 0;
  }

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function showAuthMessage(text, type) {
    authMessage.textContent = text;
    authMessage.className = `auth-message ${type}`;
    authMessage.classList.remove("hidden");
  }

  function clearAuthMessage() {
    authMessage.className = "hidden";
    authMessage.textContent = "";
  }

  function getAuthHeaders() {
    if (!teacherToken) {
      return {};
    }

    return {
      "X-Teacher-Token": teacherToken,
    };
  }

  function clearTeacherSession() {
    teacherToken = "";
    teacherUsername = "";
    localStorage.removeItem("teacherToken");
    localStorage.removeItem("teacherUsername");
  }

  function setTeacherSession(token, username) {
    teacherToken = token;
    teacherUsername = username;
    localStorage.setItem("teacherToken", token);
    localStorage.setItem("teacherUsername", username);
  }

  function updateAuthUI() {
    const loggedIn = isTeacherLoggedIn();

    authStatusLabel.textContent = loggedIn
      ? `Logged in: ${teacherUsername}`
      : "Teacher Login";

    loginView.classList.toggle("hidden", loggedIn);
    loggedInView.classList.toggle("hidden", !loggedIn);
    loggedInText.textContent = loggedIn
      ? `Signed in as ${teacherUsername}`
      : "";

    const formControls = signupForm.querySelectorAll("input, select, button");
    formControls.forEach((control) => {
      control.disabled = !loggedIn;
    });

    teacherOnlyMessage.classList.toggle("hidden", loggedIn);
  }

  function openAuthModal() {
    clearAuthMessage();
    updateAuthUI();
    authModal.classList.remove("hidden");
  }

  function closeAuthModal() {
    authModal.classList.add("hidden");
    loginForm.reset();
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";
      activitySelect.innerHTML =
        '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        const deleteButtonsClass = isTeacherLoggedIn() ? "" : "hidden";

        // Create participants HTML with teacher-only delete icons
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span><button class="delete-btn ${deleteButtonsClass}" data-activity="${name}" data-email="${email}">❌</button></li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    if (!isTeacherLoggedIn()) {
      showMessage("Teacher login required", "error");
      return;
    }

    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        if (response.status === 401) {
          clearTeacherSession();
          updateAuthUI();
          fetchActivities();
        }
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: getAuthHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        if (response.status === 401) {
          clearTeacherSession();
          updateAuthUI();
          fetchActivities();
        }
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("teacher-username").value.trim();
    const password = document.getElementById("teacher-password").value;

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json();

      if (!response.ok) {
        showAuthMessage(result.detail || "Login failed", "error");
        return;
      }

      setTeacherSession(result.token, result.username);
      updateAuthUI();
      fetchActivities();
      showMessage("Teacher login successful", "success");
      closeAuthModal();
    } catch (error) {
      console.error("Error logging in:", error);
      showAuthMessage("Login request failed", "error");
    }
  });

  logoutBtn.addEventListener("click", async () => {
    try {
      await fetch("/auth/logout", {
        method: "POST",
        headers: getAuthHeaders(),
      });
    } catch (error) {
      console.error("Error logging out:", error);
    }

    clearTeacherSession();
    updateAuthUI();
    fetchActivities();
    closeAuthModal();
    showMessage("Logged out", "info");
  });

  authToggleBtn.addEventListener("click", openAuthModal);
  closeAuthModalBtn.addEventListener("click", closeAuthModal);

  authModal.addEventListener("click", (event) => {
    if (event.target === authModal) {
      closeAuthModal();
    }
  });

  // Initialize app
  updateAuthUI();
  fetchActivities();
});
