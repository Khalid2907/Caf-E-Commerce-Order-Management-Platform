/**
 * COMMON GROUND — Customer Sign In Controller ("17 · Sign in")
 *
 * Handles passwordless magic-link email validation and simulated sign-in confirmation.
 */

import { initHeader } from "../components/header.js";

function initSignInPage() {
  initHeader();

  const form = document.getElementById("signin-form");
  const emailInput = document.getElementById("signin-email");
  const feedbackBanner = document.getElementById("signin-feedback-banner");
  const feedbackText = document.getElementById("signin-feedback-text");

  if (!form || !emailInput) return;

  emailInput.setAttribute("aria-invalid", "false");

  emailInput.addEventListener("blur", () => {
    const invalid = emailInput.matches(":user-invalid");
    emailInput.setAttribute("aria-invalid", invalid ? "true" : "false");
  });

  emailInput.addEventListener("input", () => {
    emailInput.classList.remove("user-invalid-fallback");
    emailInput.setAttribute("aria-invalid", "false");
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!emailInput.checkValidity()) {
      emailInput.classList.add("user-invalid-fallback");
      emailInput.setAttribute("aria-invalid", "true");
      emailInput.focus();
      return;
    }

    if (feedbackBanner && feedbackText) {
      feedbackText.textContent = `We sent a sign-in link to ${emailInput.value}. Check your inbox to open your Regulars Club account.`;
      feedbackBanner.hidden = false;
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSignInPage);
} else {
  initSignInPage();
}
