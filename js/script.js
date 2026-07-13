(function () {
  const applyForm = document.getElementById("applyForm");

  // POST endpoint — switch this after deploying the Google Apps Script
  // 1. Open script.google.com, create project, paste email-backend.gs
  // 2. Deploy > Web App > Execute as "You" > Access "Anyone"
  // 3. Copy the deployment URL and paste it below
  const API_ENDPOINT = "https://formsubmit.co/ajax/sangkalbe@gmail.com";
  const formSuccess = document.getElementById("formSuccess");
  const resumeInput = document.getElementById("resume");
  const resumeZone = document.getElementById("resumeZone");
  const resumeStatus = document.getElementById("resumeStatus");
  let uploadedResume = null;

  // Pre-fill role from URL param
  const params = new URLSearchParams(window.location.search);
  const roleParam = params.get("role");
  const roleSelect = document.getElementById("role");
  if (roleParam) {
    const option = Array.from(roleSelect.options).find(
      (o) => o.value === roleParam
    );
    if (option) roleSelect.value = option.value;
  }

  // ---------- Resume Upload UX ----------
  resumeZone.addEventListener("click", () => resumeInput.click());

  document.querySelectorAll("#applyForm input, #applyForm select, #applyForm textarea").forEach((el) => {
    el.addEventListener("focus", () => { el.style.borderColor = ""; });
  });

  resumeZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    resumeZone.classList.add("dragover");
  });
  resumeZone.addEventListener("dragleave", () => {
    resumeZone.classList.remove("dragover");
  });
  resumeZone.addEventListener("drop", (e) => {
    e.preventDefault();
    resumeZone.classList.remove("dragover");
    if (e.dataTransfer.files.length) {
      uploadedResume = e.dataTransfer.files[0];
      handleResume(uploadedResume);
    }
  });
  resumeInput.addEventListener("change", () => {
    if (resumeInput.files.length) {
      uploadedResume = resumeInput.files[0];
      handleResume(uploadedResume);
    }
  });

  async function handleResume(file) {
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["pdf", "docx", "doc"].includes(ext)) {
      setResumeStatus("Unsupported file type. Please upload PDF or DOCX.", "error");
      uploadedResume = null;
      resumeInput.value = "";
      return;
    }
    setResumeStatus(`Parsing ${file.name}...`, "");
    try {
      let text = "";
      if (ext === "pdf") {
        text = await parsePDF(file);
      } else {
        text = await parseDOCX(file);
      }
      if (text.trim().length < 10) throw new Error("Too little text extracted");
      autoFillForm(text);
      setResumeStatus(`${file.name} &mdash; parsed successfully!`, "success");
    } catch (err) {
      setResumeStatus("Could not parse this file. Please fill in the fields manually.", "error");
      uploadedResume = null;
      resumeInput.value = "";
    }
  }

  function setResumeStatus(msg, cls) {
    resumeStatus.innerHTML = msg;
    resumeStatus.className = "resume-status" + (cls ? " " + cls : "");
  }

  // ---------- PDF Parsing (pdf.js) ----------
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  async function parsePDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item) => item.str).join(" ") + "\n";
    }
    return text;
  }

  // ---------- DOCX Parsing (mammoth) ----------
  async function parseDOCX(file) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  }

  // ---------- Auto-Fill Form ----------
  function autoFillForm(text) {
    const firstName = document.getElementById("firstName");
    const lastName = document.getElementById("lastName");
    const email = document.getElementById("email");
    const phone = document.getElementById("phone");
    const skills = document.getElementById("skills");
    const experience = document.getElementById("experience");

    // Name: try first 2-3 lines, find a likely name
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    for (const line of lines.slice(0, 5)) {
      const parts = line.split(/\s+/);
      if (parts.length >= 2 && parts.length <= 4) {
        const maybeFirstName = parts[0].replace(/[^a-zA-ZÀ-ÿ-]/g, "");
        const maybeLastName = parts[parts.length - 1].replace(/[^a-zA-ZÀ-ÿ-]/g, "");
        if (maybeFirstName.length > 1 && maybeLastName.length > 1) {
          firstName.value = maybeFirstName;
          lastName.value = maybeLastName;
          break;
        }
      }
    }

    // Email
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) email.value = emailMatch[0];

    // Phone
    const phoneMatch = text.match(
      /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/
    );
    if (phoneMatch) phone.value = phoneMatch[0];

    // Skills: look for a "Skills" section
    const skillsIdx = text.search(
      /skills|technologies|competencies|expertise/i
    );
    if (skillsIdx !== -1) {
      const block = text.slice(skillsIdx, skillsIdx + 500);
      const lines = block.split("\n").slice(0, 6);
      const extracted = lines
        .flatMap((l) => l.split(/[,•·•\t|]/))
        .map((s) => s.replace(/^[•·•\-\s]+/, "").trim())
        .filter((s) => s.length > 1 && !/skills|technologies|competencies|expertise/i.test(s))
        .slice(0, 15);
      if (extracted.length) skills.value = extracted.join(", ");
    }

    // Experience: grab a block of text after "Experience" heading
    const expIdx = text.search(
      /experience|work history|employment|professional background/i
    );
    if (expIdx !== -1) {
      let block = text.slice(expIdx, expIdx + 800);
      block = block.replace(/experience|work history|employment|professional background/i, "").trim();
      block = block.split(/\n{2,}/).slice(0, 3).join("\n\n");
      if (block.length > 20) experience.value = block;
    }
  }

  // ---------- Form Submission ----------
  let submitting = false;
  applyForm.addEventListener("submit", function (e) {
    e.preventDefault();
    if (submitting) return;

    const required = applyForm.querySelectorAll("[required]");
    let valid = true;
    required.forEach((el) => {
      if (!el.value.trim()) {
        el.style.borderColor = "#c92a2a";
        valid = false;
      } else {
        el.style.borderColor = "";
      }
    });
    if (!valid) return;

    submitting = true;
    const btn = applyForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = "Submitting...";

    const role = document.getElementById("role").value;
    const data = {
      _subject: `New application for ${role}`,
      _captcha: "false",
      _template: "table",
      _honeypot: "",
      "Full Name": `${document.getElementById("firstName").value.trim()} ${document.getElementById("lastName").value.trim()}`,
      Email: document.getElementById("email").value.trim(),
      Phone: document.getElementById("phone").value.trim(),
      Role: role,
      Skills: document.getElementById("skills").value.trim(),
      Experience: document.getElementById("experience").value.trim(),
      "Cover Letter": document.getElementById("cover").value.trim(),
      Resume: uploadedResume ? uploadedResume.name : "Not uploaded",
    };

    fetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          applyForm.classList.add("hidden");
          formSuccess.classList.remove("hidden");
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          throw new Error("Submission failed");
        }
      })
      .catch(() => {
        btn.disabled = false;
        btn.textContent = "Submit Application";
        setResumeStatus("Could not reach the server. Please email your details to sangkalbe@gmail.com", "error");
        submitting = false;
      });
  });
})();
