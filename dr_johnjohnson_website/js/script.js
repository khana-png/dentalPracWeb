(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const safeRead = (key, fallback = []) => {
    try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; }
    catch { return fallback; }
  };
  const safeWrite = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { return false; }
  };
  const showMessage = (element, message, type = "error") => {
    if (!element) return;
    element.textContent = message;
    element.className = `form-message ${type}`;
  };
  const markInvalid = (form, invalidFields = []) => {
    $$("input, select, textarea", form).forEach(field => {
      const invalid = invalidFields.includes(field) || (!field.checkValidity() && field.value.trim() !== "");
      field.setAttribute("aria-invalid", invalid ? "true" : "false");
    });
  };
  const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const validSAphone = value => /^(0[6-8][0-9]{8}|\+27[6-8][0-9]{8})$/.test(value.replace(/[\s()-]/g, ""));

  // Shared header, year and South African clock.
  $$("[data-year]").forEach(el => el.textContent = new Date().getFullYear());
  const updateClock = () => {
    const now = new Date();
    $$("[data-clock]").forEach(el => el.textContent = now.toLocaleString("en-ZA", {
      timeZone: "Africa/Johannesburg", dateStyle: "medium", timeStyle: "medium"
    }));
  };
  updateClock();
  window.setInterval(updateClock, 1000);
  const menuButton = $(".menu-toggle");
  const nav = $(".main-nav");
  if (menuButton && nav) {
    menuButton.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      menuButton.setAttribute("aria-expanded", String(open));
      menuButton.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    });
  }

  // Sign-in / sign-up demo. This is not production authentication.
  const authTabs = $$("[data-auth-tab]");
  const signInForm = $("#signinForm");
  const signUpForm = $("#signupForm");
  authTabs.forEach(tab => tab.addEventListener("click", () => {
    const signup = tab.dataset.authTab === "signup";
    signInForm?.classList.toggle("hidden", signup);
    signUpForm?.classList.toggle("hidden", !signup);
    authTabs.forEach(item => {
      const active = item === tab;
      item.classList.toggle("active", active);
      item.setAttribute("aria-selected", String(active));
    });
  }));
  signUpForm?.addEventListener("submit", event => {
    event.preventDefault();
    const name = $("#signupName").value.trim();
    const email = $("#signupEmail").value.trim().toLowerCase();
    const password = $("#signupPassword").value;
    const confirm = $("#signupConfirm").value;
    const terms = $("#terms").checked;
    const message = $("#signupMessage");
    const bad = [];
    if (name.length < 2) bad.push($("#signupName"));
    if (!validEmail(email)) bad.push($("#signupEmail"));
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) bad.push($("#signupPassword"));
    if (confirm !== password || !confirm) bad.push($("#signupConfirm"));
    if (!terms) bad.push($("#terms"));
    markInvalid(signUpForm, bad);
    if (bad.length) {
      showMessage(message, "Please correct the highlighted fields. Use a password with at least 8 characters, including a letter and a number.");
      bad[0].focus();
      return;
    }
    const users = safeRead("djd_demo_users", []);
    if (users.some(user => user.email === email)) {
      showMessage(message, "An account with this email already exists in this browser. Please sign in instead.");
      return;
    }
    // Coursework-only local demo: never use this pattern for real patient accounts.
    users.push({ name, email, password });
    if (!safeWrite("djd_demo_users", users)) {
      showMessage(message, "This browser could not save the demo account. Check browser storage settings.");
      return;
    }
    signUpForm.reset();
    showMessage(message, "Demo account created. You can now sign in using the same email and password.", "success");
    window.setTimeout(() => {
      const signInTab = $('[data-auth-tab="signin"]');
      signInTab?.click();
      const signInEmail = $("#signinEmail");
      if (signInEmail) signInEmail.value = email;
    }, 700);
  });
  signInForm?.addEventListener("submit", event => {
    event.preventDefault();
    const email = $("#signinEmail").value.trim().toLowerCase();
    const password = $("#signinPassword").value;
    const bad = [];
    if (!validEmail(email)) bad.push($("#signinEmail"));
    if (password.length < 8) bad.push($("#signinPassword"));
    markInvalid(signInForm, bad);
    if (bad.length) {
      showMessage($("#signinMessage"), "Enter a valid email and a password with at least 8 characters.");
      bad[0].focus();
      return;
    }
    const user = safeRead("djd_demo_users", []).find(item => item.email === email && item.password === password);
    if (!user) {
      showMessage($("#signinMessage"), "We couldn't find a matching demo account. Sign up first or check your details.");
      return;
    }
    showMessage($("#signinMessage"), `Welcome back, ${user.name}! You are signed in for this browser demo.`, "success");
    signInForm.reset();
  });

  // Date fields: don't allow dates in the past.
  const todayLocal = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  };
  const dateInput = $("#appointmentDate");
  if (dateInput) {
    dateInput.min = todayLocal();
    const requestedService = new URLSearchParams(window.location.search).get("service");
    if (requestedService) {
      const treatment = $("#treatment");
      if (treatment && [...treatment.options].some(option => option.value === requestedService || option.text === requestedService)) {
        treatment.value = [...treatment.options].find(option => option.value === requestedService || option.text === requestedService).value;
      }
    }
  }

  // Appointment request validation and local list.
  const appointmentForm = $("#appointmentForm");
  const appointmentList = $("#appointmentList");
  const renderAppointments = () => {
    if (!appointmentList) return;
    const requests = safeRead("djd_demo_appointments", []);
    if (!requests.length) {
      appointmentList.innerHTML = '<p class="muted">No requests have been submitted in this browser yet.</p>';
      return;
    }
    appointmentList.replaceChildren();
    requests.slice().reverse().forEach(request => {
      const card = document.createElement("article");
      card.className = "appointment-item";
      const title = document.createElement("h3"); title.textContent = request.name;
      const details = [
        `Date: ${request.date}`, `Time: ${request.time}`, `Treatment: ${request.treatment}`,
        `Email: ${request.email}`, `Phone: ${request.phone}`
      ];
      card.append(title);
      details.forEach(detail => { const p = document.createElement("p"); p.textContent = detail; card.append(p); });
      const status = document.createElement("span"); status.className = "status-pill"; status.textContent = "Demo request — not confirmed"; card.append(status);
      appointmentList.append(card);
    });
  };
  appointmentForm?.addEventListener("submit", event => {
    event.preventDefault();
    const name = $("#patientName").value.trim();
    const email = $("#patientEmail").value.trim();
    const phone = $("#patientPhone").value.trim();
    const date = $("#appointmentDate").value;
    const time = $("#appointmentTime").value;
    const treatment = $("#treatment").value;
    const bad = [];
    if (name.length < 2) bad.push($("#patientName"));
    if (!validEmail(email)) bad.push($("#patientEmail"));
    if (!validSAphone(phone)) bad.push($("#patientPhone"));
    if (!date || date < todayLocal()) bad.push($("#appointmentDate"));
    if (!time) bad.push($("#appointmentTime"));
    if (!treatment) bad.push($("#treatment"));
    markInvalid(appointmentForm, bad);
    if (bad.length) {
      showMessage($("#appointmentMessage"), "Please check the highlighted fields. Use a valid email, a South African mobile number and a date that is today or later.");
      bad[0].focus();
      return;
    }
    const requests = safeRead("djd_demo_appointments", []);
    requests.push({ id: `DEMO-${Date.now()}`, name, email, phone, date, time, treatment, notes: $("#appointmentNotes").value.trim() });
    if (!safeWrite("djd_demo_appointments", requests)) {
      showMessage($("#appointmentMessage"), "Could not save this request in your browser. Check storage settings.");
      return;
    }
    appointmentForm.reset();
    dateInput.min = todayLocal();
    showMessage($("#appointmentMessage"), "Your request passed validation and was saved in this browser. It is not a confirmed booking and the practice has not been notified.", "success");
    renderAppointments();
  });
  $("#clearAppointments")?.addEventListener("click", () => {
    if (window.confirm("Clear all appointment requests saved in this browser?")) {
      localStorage.removeItem("djd_demo_appointments");
      renderAppointments();
      showMessage($("#appointmentMessage"), "Local demo requests cleared.", "success");
    }
  });
  renderAppointments();

  // Contact form validation; no email is sent without a backend/form service.
  const contactForm = $("#contactForm");
  contactForm?.addEventListener("submit", event => {
    event.preventDefault();
    const name = $("#contactName").value.trim();
    const email = $("#contactEmail").value.trim();
    const subject = $("#contactSubject").value;
    const messageText = $("#contactMessage").value.trim();
    const bad = [];
    if (name.length < 2) bad.push($("#contactName"));
    if (!validEmail(email)) bad.push($("#contactEmail"));
    if (!subject) bad.push($("#contactSubject"));
    if (messageText.length < 10) bad.push($("#contactMessage"));
    markInvalid(contactForm, bad);
    if (bad.length) {
      showMessage($("#contactFeedback"), "Please correct the highlighted fields. Your message must contain at least 10 characters.");
      bad[0].focus();
      return;
    }
    showMessage($("#contactFeedback"), "Your message passed validation. This demo has not sent it; connect a form service to deliver messages.", "success");
    contactForm.reset();
  });


  // Review carousel controls: scroll by approximately one card.
  const reviewsViewport = $("#reviewsViewport");
  $("#reviewsPrev")?.addEventListener("click", () => {
    if (reviewsViewport) reviewsViewport.scrollBy({ left: -reviewsViewport.clientWidth * 0.8, behavior: "smooth" });
  });
  $("#reviewsNext")?.addEventListener("click", () => {
    if (reviewsViewport) reviewsViewport.scrollBy({ left: reviewsViewport.clientWidth * 0.8, behavior: "smooth" });
  });
  reviewsViewport?.addEventListener("keydown", event => {
    if (event.key === "ArrowRight") reviewsViewport.scrollBy({ left: 280, behavior: "smooth" });
    if (event.key === "ArrowLeft") reviewsViewport.scrollBy({ left: -280, behavior: "smooth" });
  });

  // Reviews are rendered with textContent to avoid injecting user-entered HTML.
  const reviewForm = $("#reviewForm");
  const reviewList = $("#reviewList");

  reviewForm?.addEventListener("submit", event => {
    event.preventDefault();
    const name = $("#reviewName").value.trim();
    const rating = Number($("#reviewRating").value);
    const text = $("#reviewText").value.trim();
    const bad = [];
    if (name.length < 2) bad.push($("#reviewName"));
    if (!(rating >= 1 && rating <= 5)) bad.push($("#reviewRating"));
    if (text.length < 10) bad.push($("#reviewText"));
    markInvalid(reviewForm, bad);
    if (bad.length) {
      showMessage($("#reviewMessage"), "Please provide a name, choose a rating and write at least 10 characters.");
      bad[0].focus();
      return;
    }
    const reviews = safeRead("djd_demo_reviews", []);
    reviews.push({ name, rating, text });
    if (!safeWrite("djd_demo_reviews", reviews)) {
      showMessage($("#reviewMessage"), "Could not save your review in this browser.");
      return;
    }
    reviewForm.reset();
    // Append only newly submitted items once; stored reviews are rendered on page load.
    const card = document.createElement("article"); card.className = "review-card";
    const stars = document.createElement("div"); stars.className = "stars"; stars.textContent = "★".repeat(rating) + "☆".repeat(5 - rating);
    const quote = document.createElement("blockquote"); quote.textContent = `“${text}”`;
    const author = document.createElement("p"); author.className = "review-author"; author.textContent = `— ${name} (demo review)`;
    const book = document.createElement("a"); book.className = "btn btn-outline review-book-btn"; book.href = "appointment.html"; book.textContent = "Book an appointment";
    card.append(stars, quote, author, book); reviewList.append(card);
    showMessage($("#reviewMessage"), "Your review was saved in this browser for the demo.", "success");
  });
  // On initial load, only append saved reviews not already in the static sample area.
  if (reviewList) {
    const savedReviews = safeRead("djd_demo_reviews", []);
    savedReviews.forEach(review => {
      const card = document.createElement("article"); card.className = "review-card";
      const stars = document.createElement("div"); stars.className = "stars"; stars.textContent = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);
      const quote = document.createElement("blockquote"); quote.textContent = `“${review.text}”`;
      const author = document.createElement("p"); author.className = "review-author"; author.textContent = `— ${review.name} (demo review)`;
      const book = document.createElement("a"); book.className = "btn btn-outline review-book-btn"; book.href = "appointment.html"; book.textContent = "Book an appointment";
      card.append(stars, quote, author, book); reviewList.append(card);
    });
  }
  /*
  map to a real map service with an API key and a backend proxy to avoid exposing the key in client-side code. For this demo, we use a static image.
  */
 document.addEventListener("DOMContentLoaded", function () {
  const container = document.getElementById("mapContainer");
  const expandBtn = document.getElementById("expandMapBtn");

  // Replace these coordinates with your practice location.
  const practiceLat = -26.2041;
  const practiceLng = 28.0473;

  const map = L.map("practiceMap").setView(
    [practiceLat, practiceLng],
    14
  );

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(map);

  L.marker([practiceLat, practiceLng])
    .addTo(map)
    .bindPopup("Our practice");

  function toggleMapSize() {
    const expanded = container.classList.toggle("map-expanded");

    expandBtn.textContent = expanded
      ? "✕ Close enlarged map"
      : "⛶ Expand map";

    expandBtn.setAttribute("aria-expanded", String(expanded));

    // Allow the browser to update the layout first.
    requestAnimationFrame(function () {
      map.invalidateSize();
    });
  }

  expandBtn.addEventListener("click", toggleMapSize);

  // Close enlarged map with Escape.
  document.addEventListener("keydown", function (event) {
    if (
      event.key === "Escape" &&
      container.classList.contains("map-expanded")
    ) {
      toggleMapSize();
    }
  });
});

})();
